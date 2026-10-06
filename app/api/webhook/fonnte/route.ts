// app/api/webhook/fonnte/route.ts
// Webhook endpoint untuk menerima pesan masuk dari Fonnte.
// Alur: user balas WA → Fonnte webhook → lookup user → Gemini generate → submit → konfirmasi.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSessionSecret } from '@/lib/utils/crypto';
import { generateReport } from '@/lib/services/geminiService';
import { submitReportToMagangHub } from '@/lib/services/reportSubmitService';
import { updateSessionTokens } from '@/lib/services/accountService';
import { getFoonteConfig, sendFoonteMessage } from '@/lib/services/foonteService';
import { parseFoonteIncomingMessage, parseLinkCommand } from '@/lib/services/fonnteWebhookUtils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Fonnte mengirim webhook agak besar; timeout perlu cukup longgar.
export const maxDuration = 60;

/** Tanggal hari ini di WIB */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Kirim pesan WA ke nomor tertentu via Fonnte */
async function replyToUser(phone: string, message: string) {
  try {
    const config = getFoonteConfig();
    const result = await sendFoonteMessage(message, config, fetch, phone);
    if (!result.ok) {
      console.error('[webhook/fonnte] Fonnte menolak balasan:', {
        phone,
        status: result.status,
        response: result.responseBody,
      });
    }
    return result.ok;
  } catch (err) {
    console.error('[webhook/fonnte] Gagal kirim balasan:', err);
    return false;
  }
}

/**
 * Coba cocokkan nomor WA ke user_id.
 * Prioritas:
 * 1. Cek tabel wa_phone_mappings (sudah pernah di-link)
 * 2. Cari user dengan nama mirip dari pesan (fallback)
 */
async function findUserByPhone(phone: string, fonnteName?: string) {
  const supabase = createAdminClient();

  // 1. Cek mapping yang sudah ada
  const { data: mapping, error } = await supabase
    .from('wa_phone_mappings')
    .select('user_id')
    .eq('phone_number', phone)
    .maybeSingle();

  if (error) {
    console.error('[webhook/fonnte] Gagal mencari mapping nomor:', error);
  }

  if (mapping) return mapping.user_id;

  // 2. Auto-link jika nama kontak dari Fonnte cocok dengan nama profil
  if (fonnteName && fonnteName.trim().length >= 2) {
    const searchName = fonnteName.trim().toLowerCase();
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .not('full_name', 'is', null);

    if (profiles?.length) {
      const match = profiles.find((p) => {
        const dbName = (p.full_name || '').toLowerCase();
        return dbName === searchName || dbName.includes(searchName) || searchName.includes(dbName);
      });

      if (match) {
        console.log(`[webhook/fonnte] Auto-linking phone ${phone} to user ${match.full_name} (${match.id}) via Fonnte contact name "${fonnteName}"`);
        await supabase
          .from('wa_phone_mappings')
          .upsert({ user_id: match.id, phone_number: phone, linked_at: new Date().toISOString() }, { onConflict: 'phone_number' });
        return match.id;
      }
    }
  }

  // 3. Fallback: Jika hanya ada 1 profil terdaftar di database, auto-link langsung
  const { data: singleProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('full_name', 'is', null);

  if (singleProfiles && singleProfiles.length === 1) {
    const user = singleProfiles[0];
    console.log(`[webhook/fonnte] Auto-linking single registered user ${user.full_name} (${user.id}) to phone ${phone}`);
    await supabase
      .from('wa_phone_mappings')
      .upsert({ user_id: user.id, phone_number: phone, linked_at: new Date().toISOString() }, { onConflict: 'phone_number' });
    return user.id;
  }

  return null;
}

/**
 * Link nomor WA ke user berdasarkan nama yang dikirim user.
 * User harus mengirim "link [nama di HubReminder]" untuk pertama kali.
 */
async function linkPhoneToUser(phone: string, nameInput: string): Promise<{
  userId?: string;
  userName?: string;
  error?: string;
}> {
  const supabase = createAdminClient();
  const searchName = nameInput.trim().toLowerCase();

  // Cari profil dengan nama mirip
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('full_name', 'is', null);

  if (profileError) {
    console.error('[webhook/fonnte] Gagal mencari profil untuk proses link:', profileError);
    return { error: 'Gagal memeriksa profil HubReminder. Coba lagi beberapa saat.' };
  }

  if (!profiles?.length) return { error: 'Belum ada peserta yang terdaftar di HubReminder.' };

  // Cocokkan nama secara fuzzy
  const match = profiles.find((p) => {
    const dbName = (p.full_name || '').toLowerCase();
    return dbName === searchName ||
      dbName.includes(searchName) ||
      searchName.includes(dbName);
  });

  if (!match) {
    const availableNames = profiles
      .filter((p) => p.full_name)
      .map((p) => `• ${p.full_name}`)
      .join('\n');
    return {
      error: `Nama "${nameInput}" tidak ditemukan.\n\nDaftar peserta terdaftar:\n${availableNames}\n\nBalas: link [nama lengkap kamu]`,
    };
  }

  // Simpan mapping
  const { error: insertError } = await supabase
    .from('wa_phone_mappings')
    .upsert(
      { user_id: match.id, phone_number: phone, linked_at: new Date().toISOString() },
      { onConflict: 'phone_number' },
    );

  if (insertError) {
    console.error('[webhook/fonnte] Gagal simpan mapping:', insertError);
    return { error: 'Gagal menyimpan koneksi nomor WA.' };
  }

  return { userId: match.id, userName: match.full_name || nameInput };
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'HubReminder Fonnte Webhook',
    timestamp: new Date().toISOString(),
  });
}

/** Robustly extract payload from JSON, FormData, or URL-encoded request body */
async function extractPayload(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  // 1. Try JSON if content-type matches
  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      // fallback
    }
  }

  // 2. Try FormData (handles application/x-www-form-urlencoded & multipart/form-data)
  try {
    const formData = await request.formData();
    const result: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      result[key] = value;
    });
    if (Object.keys(result).length > 0) return result;
  } catch {
    // fallback
  }

  // 3. Try URLSearchParams / plain text parsing
  try {
    const text = await request.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        const result: Record<string, unknown> = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        if (Object.keys(result).length > 0) return result;
      }
    }
  } catch {
    // fallback
  }

  return {};
}

export async function POST(request: NextRequest) {
  const payload = await extractPayload(request);
  console.log('[webhook/fonnte] Incoming payload:', JSON.stringify(payload));

  const incoming = parseFoonteIncomingMessage(payload);
  if (!incoming) {
    console.log('[webhook/fonnte] Message skipped (invalid payload or empty content)');
    return NextResponse.json({ ok: true, skipped: 'empty_or_invalid_message' });
  }
  const { phone, message, isGroup } = incoming;

  console.log('[webhook/fonnte] Parsed incoming:', { phone, message: message.slice(0, 100), isGroup });

  // === COMMAND: link [nama] — link nomor WA ke akun HubReminder ===
  const nameInput = parseLinkCommand(message);
  if (nameInput) {
    const result = await linkPhoneToUser(phone, nameInput);
    if (result.error) {
      await replyToUser(phone, result.error);
    } else {
      await replyToUser(phone, `✅ Nomor WA kamu berhasil dihubungkan ke akun *${result.userName}*.\n\nSekarang kamu bisa balas pesan ini kapan saja dengan kegiatan magang kamu untuk auto-generate laporan.\n\nContoh: "hari ini belajar react dan bikin komponen dashboard"`);
    }
    return NextResponse.json({ ok: true, action: 'link' });
  }

    const fonnteContactName = typeof payload.name === 'string' ? payload.name : undefined;

    // === COMMAND: status — cek status laporan hari ini ===
    if (/^status$/i.test(message)) {
      const userId = await findUserByPhone(phone, fonnteContactName);
    if (!userId) {
      await replyToUser(phone, '⚠️ Nomor WA kamu belum terhubung.\nBalas: link [nama lengkap kamu]');
      return NextResponse.json({ ok: true, action: 'status_unlinked' });
    }
    const supabase = createAdminClient();
    const today = todayWIB();
    const { data: session } = await supabase
      .from('wa_report_sessions')
      .select('status, submitted_at')
      .eq('user_id', userId)
      .eq('report_date', today)
      .maybeSingle();

    const statusText = session
      ? session.status === 'submitted'
        ? `✅ Laporan hari ini sudah dikirim pada ${session.submitted_at}.`
        : `📋 Status: ${session.status}`
      : '📝 Belum ada laporan hari ini. Balas dengan kegiatan magang kamu untuk generate otomatis.';

    await replyToUser(phone, statusText);
    return NextResponse.json({ ok: true, action: 'status' });
  }

  // === MAIN: Auto-generate laporan dari input kegiatan ===
  const userId = await findUserByPhone(phone, fonnteContactName);
  if (!userId) {
    const isLikelyBotMessage = /^link\b/i.test(message) ||
      /^status$/i.test(message) ||
      /\b(laporan|magang|absen|kehadiran)\b/i.test(message);

    if (isGroup && !isLikelyBotMessage) {
      // Abaikan percakapan umum di grup dari member yang belum terhubung agar tidak membanjiri grup
      return NextResponse.json({ ok: true, skipped: 'unlinked_group_chat' });
    }

    await replyToUser(
      phone,
      '👋 Hai! Untuk menggunakan fitur auto-laporan, hubungkan nomor WA kamu dulu.\n\nBalas: *link [nama lengkap kamu]*\n\nContoh: link Risky Prasetyo',
    );
    return NextResponse.json({ ok: true, action: 'unlinked' });
  }

  const supabase = createAdminClient();
  const today = todayWIB();

  // Cek apakah sudah submit hari ini
  const { data: existingSession } = await supabase
    .from('wa_report_sessions')
    .select('status')
    .eq('user_id', userId)
    .eq('report_date', today)
    .maybeSingle();

  if (existingSession?.status === 'submitted') {
    await replyToUser(phone, '✅ Laporan hari ini sudah terkirim sebelumnya. Tidak perlu mengisi ulang.');
    return NextResponse.json({ ok: true, action: 'already_submitted' });
  }

  // Buat / update sesi
  const { error: upsertError } = await supabase
    .from('wa_report_sessions')
    .upsert(
      {
        user_id: userId,
        wa_number: phone,
        report_date: today,
        user_input: message,
        status: 'generating',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,report_date' },
    );

  if (upsertError) {
    console.error('[webhook/fonnte] Gagal upsert session:', upsertError);
    await replyToUser(phone, '❌ Terjadi kesalahan saat memproses pesan kamu. Coba lagi nanti.');
    return NextResponse.json({ ok: false, error: 'session_upsert_failed' }, { status: 500 });
  }

  // Ambil profil user untuk konteks Gemini
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, position')
    .eq('id', userId)
    .maybeSingle();

  await replyToUser(phone, '⏳ Sedang meng-generate laporan menggunakan AI...');

  // 1. Generate laporan dengan Gemini AI
  const genResult = await generateReport(message, {
    name: profile?.full_name,
    company: profile?.company_name,
    position: profile?.position,
  });

  if (genResult.error || !genResult.report) {
    await supabase
      .from('wa_report_sessions')
      .update({ status: 'failed', error_message: genResult.error, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('report_date', today);
    await replyToUser(phone, `❌ Gagal generate laporan: ${genResult.error}\n\nCoba kirim ulang kegiatan kamu.`);
    return NextResponse.json({ ok: false, error: 'generation_failed' });
  }

  const report = genResult.report;

  // Simpan hasil generate
  await supabase
    .from('wa_report_sessions')
    .update({
      generated_report: report,
      status: 'submitting',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('report_date', today);

  // 2. Ambil sesi MagangHub user
  const { data: sessionData } = await supabase
    .from('maganghub_sessions')
    .select('encrypted_session, encrypted_refresh_token, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sessionData || sessionData.status === 'expired' || !sessionData.encrypted_session) {
    await supabase
      .from('wa_report_sessions')
      .update({ status: 'failed', error_message: 'Sesi MagangHub expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('report_date', today);
    await replyToUser(
      phone,
      `📝 Laporan berhasil di-generate, tapi sesi MagangHub kamu sudah kedaluwarsa.\n\nSilahkan perbarui sesi di:\n${process.env.APP_URL || 'https://hub-reminder.vercel.app'}\n\n*Preview laporan:*\n\n*Aktivitas:*\n${report.activity}\n\n*Pelajaran:*\n${report.lesson}\n\n*Kendala:*\n${report.challenge}`,
    );
    return NextResponse.json({ ok: false, error: 'session_expired' });
  }

  let cookiePlaintext: string;
  try {
    const accessToken = await decryptSessionSecret(sessionData.encrypted_session);
    const refreshToken = sessionData.encrypted_refresh_token
      ? await decryptSessionSecret(sessionData.encrypted_refresh_token)
      : null;
    cookiePlaintext = refreshToken ? JSON.stringify({ accessToken, refreshToken }) : accessToken;
  } catch {
    await supabase
      .from('wa_report_sessions')
      .update({ status: 'failed', error_message: 'Gagal dekripsi sesi', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('report_date', today);
    await replyToUser(phone, '❌ Gagal mengakses sesi MagangHub. Coba perbarui sesi di dashboard HubReminder.');
    return NextResponse.json({ ok: false, error: 'decrypt_failed' });
  }

  // 3. Submit ke MagangHub
  const submitResult = await submitReportToMagangHub(
    cookiePlaintext,
    report,
    userId,
    (accessToken, refreshToken) => updateSessionTokens(userId, accessToken, refreshToken),
  );

  if (submitResult.ok) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('wa_report_sessions')
      .update({ status: 'submitted', submitted_at: nowIso, updated_at: nowIso })
      .eq('user_id', userId)
      .eq('report_date', today);

    await replyToUser(
      phone,
      `✅ *Laporan berhasil dikirim ke MagangHub!*\n\n*Aktivitas:*\n${report.activity}\n\n*Pelajaran:*\n${report.lesson}\n\n*Kendala:*\n${report.challenge}\n\n_Laporan di-generate otomatis oleh AI berdasarkan input kamu._`,
    );
    return NextResponse.json({ ok: true, action: 'submitted' });
  }

  // Submit gagal
  await supabase
    .from('wa_report_sessions')
    .update({
      status: 'failed',
      error_message: submitResult.error,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('report_date', today);

  if (submitResult.isSessionExpired) {
    await supabase
      .from('maganghub_sessions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  // Tetap kirim preview laporan agar user bisa copy-paste manual
  await replyToUser(
    phone,
    `⚠️ Laporan berhasil di-generate tapi gagal submit otomatis: ${submitResult.error}\n\n*Kamu bisa copy-paste laporan di bawah ini ke MagangHub:*\nhttps://monev.maganghub.kemnaker.go.id/dashboard\n\n*Aktivitas:*\n${report.activity}\n\n*Pelajaran:*\n${report.lesson}\n\n*Kendala:*\n${report.challenge}`,
  );

  return NextResponse.json({ ok: false, error: 'submit_failed', detail: submitResult.error });
}
