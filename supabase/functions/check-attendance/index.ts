// supabase/functions/check-attendance/index.ts
// Supabase Edge Function: check-attendance
// Menjalankan pengecekan berkala terhadap status laporan MagangHub semua user aktif

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { fetchDashboard } from './fetcher.ts';
import { parseStatus } from './parser.ts';
import { sendWebPushNotification } from './notifier.ts';
import { isReminderTimeDue } from './reminder.ts';

// AES-GCM decryption helper untuk Deno runtime
async function decryptSessionSecret(encrypted: string, rawKey: string): Promise<string> {
  const [ivHex, ciphertextB64] = encrypted.split('.');
  if (!ivHex || !ciphertextB64) throw new Error('Format cookie terenkripsi tidak valid');

  const keyBuffer = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, ['decrypt']);

  // Convert hex to Uint8Array
  const match = ivHex.match(/.{1,2}/g);
  const iv = new Uint8Array(match ? match.map((byte) => parseInt(byte, 16)) : []);

  // Convert base64 to Uint8Array
  const binaryString = atob(ciphertextB64);
  const ciphertext = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    ciphertext[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

async function encryptSession(value: string, rawKey: string): Promise<string> {
  const keyBuffer = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(value));
  const ivHex = [...iv].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const bytes = new Uint8Array(ciphertext);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `${ivHex}.${btoa(binary)}`;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const encryptionKey = Deno.env.get('SESSION_ENCRYPTION_KEY') ?? '';

    const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') ?? '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@hubreminder.local';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase credentials missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Ambil seluruh session yang bukan 'expired'
    const { data: sessions, error: sessionErr } = await supabase
      .from('maganghub_sessions')
      .select('id, user_id, encrypted_session, encrypted_refresh_token, status, profiles(timezone)')
      .neq('status', 'expired');

    if (sessionErr) {
      return new Response(JSON.stringify({ error: sessionErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const session of sessions || []) {
      try {
        const accessToken = await decryptSessionSecret(session.encrypted_session, encryptionKey);
        const refreshToken = session.encrypted_refresh_token
          ? await decryptSessionSecret(session.encrypted_refresh_token, encryptionKey)
          : null;

        // a. Fetch data MagangHub API / dashboard
        const fetchRes = await fetchDashboard(accessToken, refreshToken);

        if (fetchRes.refreshedAccessToken) {
          await supabase.from('maganghub_sessions').update({
            encrypted_session: await encryptSession(fetchRes.refreshedAccessToken, encryptionKey),
            ...(fetchRes.refreshedRefreshToken !== undefined
              ? { encrypted_refresh_token: fetchRes.refreshedRefreshToken
                  ? await encryptSession(fetchRes.refreshedRefreshToken, encryptionKey)
                  : null }
              : {}),
            updated_at: new Date().toISOString(),
          }).eq('id', session.id);
        }

        let detectedStatus: 'belum_lapor' | 'selesai' | 'unknown' | 'session_expired' = 'unknown';
        let detectedVia = 'fetch_failure';

        if (fetchRes.isLoginRedirect) {
          detectedStatus = 'session_expired';
          detectedVia = 'login_redirect';
        } else if (fetchRes.apiData?.home) {
          const home = ((fetchRes.apiData.home as any).data ?? fetchRes.apiData.home) as Record<string, any>;
          if (home.is_scheduled_off_day || home.is_holiday) {
            detectedStatus = 'selesai';
            detectedVia = 'api:off_day_or_holiday';
          } else if (
            home.has_attendance === true ||
            home.has_attendance === 1 ||
            home.has_attendance === 'true' ||
            home.status === 'filled' ||
            home.status === 'selesai' ||
            (home.attendance && typeof home.attendance === 'object' && Object.keys(home.attendance).length > 0)
          ) {
            detectedStatus = 'selesai';
            detectedVia = 'api:has_attendance=true';
          } else {
            detectedStatus = 'belum_lapor';
            detectedVia = 'api:has_attendance=false';
          }

          // Sinkronisasi data profil jika tersedia
          if (fetchRes.apiData.user) {
            const u = fetchRes.apiData.user;
            await supabase
              .from('profiles')
              .update({
                full_name: u.name || undefined,
                company_name: u.internship_company || u.company || undefined,
                photo_url: u.photo_url || undefined,
                internship_period:
                  u.internship_start_date && u.internship_end_date
                    ? `${u.internship_start_date} – ${u.internship_end_date}`
                    : undefined,
                participant_status: u.participant_status?.reason || undefined,
                maganghub_synced_at: new Date().toISOString(),
              })
              .eq('id', session.user_id);
          }
        } else if (fetchRes.ok && fetchRes.html) {
          const parseRes = parseStatus(fetchRes.html);
          detectedStatus = parseRes.status;
          detectedVia = parseRes.detectedVia;
        }

        // b. Update attendance_checks
        await supabase.from('attendance_checks').insert({
          user_id: session.user_id,
          status: detectedStatus,
          detected_via: detectedVia,
          checked_at: new Date().toISOString(),
        });

        // c. Update session status
        if (detectedStatus === 'session_expired') {
          await supabase
            .from('maganghub_sessions')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', session.id);
        } else if (detectedStatus !== 'unknown' && session.status !== 'valid') {
          await supabase
            .from('maganghub_sessions')
            .update({
              status: 'valid',
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id);
        }

        // d. Ambil push subscriptions user
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', session.user_id);

        // e. Evaluasi notifikasi jika belum_lapor
        if (detectedStatus === 'belum_lapor') {
          // Ambil reminder settings
          const { data: settings } = await supabase
            .from('reminder_settings')
            .select('*')
            .eq('user_id', session.user_id)
            .single();

          if (settings && settings.enabled) {
            const timezone = session.profiles?.timezone || 'Asia/Jakarta';
            const intervalSeconds = settings.interval_seconds ?? settings.interval_minutes * 60;
            const reminderTimes = (settings.reminder_times ?? ['07:00']) as string[];
            const isDue = isReminderTimeDue(reminderTimes, intervalSeconds, new Date(), timezone);

            if (!isDue) {
              results.push({ user_id: session.user_id, status: detectedStatus, success: true, reminder: 'not_due' });
              continue;
            }
            // Hitung log hari ini
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const { data: todayLogs } = await supabase
              .from('notification_logs')
              .select('*')
              .eq('user_id', session.user_id)
              .gte('sent_at', todayStart.toISOString())
              .order('sent_at', { ascending: false });

            const logs = todayLogs || [];
            const countToday = logs.length;

            if (countToday < settings.max_reminders_per_day) {
              let intervalOk = true;
              if (logs.length > 0) {
                const lastSent = new Date(logs[0].sent_at).getTime();
                const diffSeconds = (Date.now() - lastSent) / 1000;
                if (diffSeconds < intervalSeconds) {
                  intervalOk = false;
                }
              }

              if (intervalOk && subs && subs.length > 0) {
                for (const sub of subs) {
                  await sendWebPushNotification(
                    sub,
                    {
                      title: 'HubReminder',
                      body: 'Laporan hari ini belum diisi — tap untuk isi sekarang.',
                      url: 'https://monev.maganghub.kemnaker.go.id/dashboard',
                    },
                    {
                      publicKey: vapidPublicKey,
                      privateKey: vapidPrivateKey,
                      subject: vapidSubject,
                    }
                  );
                }

                await supabase.from('notification_logs').insert({
                  user_id: session.user_id,
                  sent_at: new Date().toISOString(),
                  status_at_send: 'belum_lapor',
                  sequence_today: countToday + 1,
                });
              }
            }
          }
        }

        results.push({ user_id: session.user_id, status: detectedStatus, success: true });
      } catch (userErr: unknown) {
        const error = userErr as Error;
        results.push({ user_id: session.user_id, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
