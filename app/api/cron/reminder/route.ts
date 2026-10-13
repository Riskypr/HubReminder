import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { formatAutoReportReminder, formatBulkReportReminder, formatCookieWarningMessage, type CronReminderMember } from '@/lib/services/cronReminderService';
import { getFoonteConfig, getFoonteTargets, sendFoonteMessage, type FoonteSendResult } from '@/lib/services/foonteService';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_SYSTEM_REMINDER_SETTINGS, getSystemReminderSettings } from '@/lib/services/systemReminderSettingsService';
import { decryptSessionSecret } from '@/lib/utils/crypto';
import { checkAndUpdateAttendance } from '@/lib/services/maganghubService';
import { isTodayInTz } from '@/lib/utils/time';
import type { AttendanceStatus } from '@/lib/types/attendance';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SessionRow = { user_id: string; status: 'valid' | 'expired' | 'unverified'; updated_at: string; encrypted_session: string; profiles: { full_name: string | null; timezone?: string | null } | null };
type CheckRow = { user_id: string; status: AttendanceStatus; checked_at: string };
type SettingsRow = { user_id: string; enabled: boolean; max_reminders_per_day: number; interval_seconds: number; interval_minutes: number; reminder_times: string[]; snooze_until: string | null };
type NotificationRow = { user_id: string; sent_at: string };
type CookieLogRow = { user_id: string; sent_at: string; session_updated_at: string; status: 'sent' | 'failed' };
type ProviderFailure = { status: number; reason: string };

function isValidSecret(receivedSecret: string | null): boolean {
  const expectedSecret = process.env.CRON_SECRET_KEY;
  if (!expectedSecret || !receivedSecret) return false;
  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function jakartaSeconds(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

function isGlobalReminderDue(now: Date, startTime: string, intervalSeconds: number) {
  const [hour, minute] = startTime.split(':').map(Number);
  const elapsed = jakartaSeconds(now) - (hour * 3600 + minute * 60);
  // cron-job.org runs once per minute; allow a little execution delay around the scheduled minute.
  return elapsed >= 0 && elapsed % intervalSeconds < 120;
}

/**
 * Menentukan apakah seorang peserta sudah saatnya (due) menerima reminder
 * berdasarkan pengaturan pribadi masing-masing (enabled, snooze, reminder_times,
 * interval jeda, kuota maks per hari, dan zona waktu).
 */
export function isParticipantReminderDue({
  settings,
  userTimezone,
  userTodayLogs,
  now,
}: {
  settings: SettingsRow;
  userTimezone: string;
  userTodayLogs: NotificationRow[];
  now: Date;
}): boolean {
  // 1. Pengaturan aktif pengguna
  if (!settings.enabled) return false;

  // 2. Snooze hari ini
  const today = localDate(now, userTimezone);
  if (settings.snooze_until === today) return false;

  // 3. Batas maksimum reminder harian per pengguna
  if (userTodayLogs.length >= settings.max_reminders_per_day) return false;

  // 4. Cek jadwal waktu reminder pengguna
  const reminderTimes = settings.reminder_times?.length
    ? settings.reminder_times
    : ['07:00'];

  const scheduledSecondsList = reminderTimes
    .map((t) => {
      const [h = '0', m = '0'] = t.slice(0, 5).split(':');
      return Number(h) * 3600 + Number(m) * 60;
    })
    .sort((a, b) => a - b);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: userTimezone,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const currentSeconds = getPart('hour') * 3600 + getPart('minute') * 60 + getPart('second');

  // Belum mencapai waktu pengingat paling awal hari ini
  if (currentSeconds < scheduledSecondsList[0]) {
    return false;
  }

  // Pengingat pertama hari ini (waktu awal telah tercapai)
  if (userTodayLogs.length === 0) {
    return true;
  }

  const latestLogTime = userTodayLogs.reduce(
    (latest, log) => Math.max(latest, Date.parse(log.sent_at)),
    0
  );

  const intervalSeconds = settings.interval_seconds > 0
    ? settings.interval_seconds
    : (settings.interval_minutes ? settings.interval_minutes * 60 : 3600);

  // Ambil checkpoint jadwal yang sudah tiba saat ini
  const arrivedCheckpoints = scheduledSecondsList.filter((sec) => currentSeconds >= sec);
  const latestArrivedCheckpoint = arrivedCheckpoints[arrivedCheckpoints.length - 1];

  // Hitung detik waktu pengiriman terakhir dalam zona waktu pengguna
  const logParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: userTimezone,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(latestLogTime));
  const getLogPart = (type: Intl.DateTimeFormatPartTypes) => Number(logParts.find((p) => p.type === type)?.value ?? 0);
  const latestLogSeconds = getLogPart('hour') * 3600 + getLogPart('minute') * 60 + getLogPart('second');

  // Jika checkpoint jadwal terbaru ini BELUM pernah dikirimi reminder hari ini
  // (misal log sebelumnya dikirim sebelum jam checkpoint ini tiba, atau user baru saja mengubah jam pengingat),
  // maka reminder harus segera dieksekusi tanpa tertahan oleh jeda interval pengiriman sebelumnya.
  const hasLogSinceLatestCheckpoint = latestLogSeconds >= latestArrivedCheckpoint;
  if (!hasLogSinceLatestCheckpoint) {
    if (scheduledSecondsList.length > 1) {
      return userTodayLogs.length < arrivedCheckpoints.length;
    }
    return true;
  }

  // Jika checkpoint ini SUDAH pernah dikirimi reminder hari ini:
  // Jeda minimum (interval) antar pengiriman wajib dipenuhi agar tidak spam
  if (now.getTime() - latestLogTime < intervalSeconds * 1000) {
    return false;
  }

  // Jika user mengatur beberapa waktu (misal: ['08:00', '13:00', '17:00']),
  // pengingat hanya dikirim sesuai jumlah checkpoint yang telah tiba
  if (scheduledSecondsList.length > 1) {
    return userTodayLogs.length < arrivedCheckpoints.length;
  }

  // Jika 1 waktu pengingat (mode recurring interval setelah checkpoint pertama),
  // izinkan pengiriman ulang berkala hingga kuota maks tercapai
  return userTodayLogs.length < settings.max_reminders_per_day;
}

function localDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function accessTokenExpiry(encrypted: string): Promise<number | null> {
  try {
    const plaintext = await decryptSessionSecret(encrypted);
    let token = plaintext;
    try { token = JSON.parse(plaintext).accessToken || plaintext; } catch { /* legacy token */ }
    const jwt = token.match(/^[^.]+\.([^.]+)\./)?.[1];
    if (!jwt) return null;
    const payload = JSON.parse(Buffer.from(jwt, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch { return null; }
}

async function sendToTargets(message: string, targets: string[], fetcherConfig: ReturnType<typeof getFoonteConfig>) {
  const results: FoonteSendResult[] = [];
  for (let index = 0; index < targets.length; index += 5) {
    results.push(...await Promise.all(targets.slice(index, index + 5).map((target) => sendFoonteMessage(message, fetcherConfig, fetch, target))));
  }
  return results;
}

function summarizeProviderFailure(result: FoonteSendResult): ProviderFailure {
  const reason = result.status === 0
    ? result.responseBody
    : result.responseBody === 'target_not_configured'
      ? 'target_not_configured'
      : 'provider_rejected';
  return { status: result.status, reason };
}

async function handleReminder(request: NextRequest) {
  if (!process.env.CRON_SECRET_KEY) return NextResponse.json({ error: 'Konfigurasi cron belum lengkap' }, { status: 500 });
  if (!isValidSecret(request.headers.get('x-cron-secret'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    let adminSettings = DEFAULT_SYSTEM_REMINDER_SETTINGS;
    try { adminSettings = await getSystemReminderSettings(supabase); } catch { /* allows deploy before migration */ }

    // 1. Jika bot WA dinonaktifkan oleh admin, jangan kirim pesan apapun ke WhatsApp
    if (!adminSettings.wa_bot_enabled) {
      return NextResponse.json({
        success: true,
        sent: false,
        reason: 'wa_bot_disabled',
        detail: 'Layanan Bot WhatsApp dinonaktifkan oleh admin.',
        waBotEnabled: false,
        weekendReminderEnabled: adminSettings.weekend_reminder_enabled,
        reminderTogetherEnabled: adminSettings.reminder_together_enabled,
      });
    }

    const now = new Date();

    // 2. Jika hari ini akhir pekan (Sabtu & Minggu) dan reminder weekend dinonaktifkan karena libur
    const jakartaDayOfWeek = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
    }).format(now);
    const isWeekend = jakartaDayOfWeek === 'Sat' || jakartaDayOfWeek === 'Sun';

    if (isWeekend && !adminSettings.weekend_reminder_enabled) {
      return NextResponse.json({
        success: true,
        sent: false,
        reason: 'weekend_reminder_disabled',
        detail: 'Pengiriman reminder WhatsApp dinonaktifkan pada hari libur akhir pekan (Sabtu & Minggu).',
        waBotEnabled: adminSettings.wa_bot_enabled,
        weekendReminderEnabled: false,
        reminderTogetherEnabled: adminSettings.reminder_together_enabled,
      });
    }

    const foonte = getFoonteConfig();
    const targets = getFoonteTargets();
    if (!targets.length) throw new Error('Konfigurasikan FOONTE_WA_GROUP_ID atau FOONTE_WA_TARGETS');
    const globalDue = isGlobalReminderDue(now, adminSettings.start_time, adminSettings.interval_seconds);

    const { data: sessionData, error: sessionError } = await supabase
      .from('maganghub_sessions').select('user_id, status, updated_at, encrypted_session, profiles(full_name, timezone)');
    if (sessionError) throw new Error(`Gagal mengambil sesi peserta: ${sessionError.message}`);
    const sessions = (sessionData ?? []) as unknown as SessionRow[];
    if (!sessions.length) return NextResponse.json({ success: true, sent: false, reason: 'no_sessions', detail: 'Belum ada akun MagangHub yang terhubung.' });

    const eligibleSessions = sessions.filter((session) => session.status === 'valid');
    const eligibleIds = eligibleSessions.map((session) => session.user_id);
    const { data: checks, error: checkError } = eligibleIds.length
      ? await supabase.from('attendance_checks').select('user_id, status, checked_at').in('user_id', eligibleIds).order('checked_at', { ascending: false })
      : { data: [], error: null };
    if (checkError) throw new Error(`Gagal mengambil status laporan: ${checkError.message}`);

    // Filter status terbaru KHUSUS HARI INI saja (jangan gunakan status dari hari sebelumnya / kemarin)
    const latestTodayStatusByUser = new Map<string, AttendanceStatus>();
    for (const check of (checks ?? []) as CheckRow[]) {
      if (!latestTodayStatusByUser.has(check.user_id)) {
        const session = eligibleSessions.find((s) => s.user_id === check.user_id);
        const tz = session?.profiles?.timezone || 'Asia/Jakarta';
        if (isTodayInTz(check.checked_at, tz)) {
          latestTodayStatusByUser.set(check.user_id, check.status);
        }
      }
    }

    const ids = sessions.map((session) => session.user_id);
    const [{ data: settingsData, error: settingsError }, { data: notificationData, error: notificationError }, { data: cookieLogData, error: cookieLogError }] = await Promise.all([
      supabase.from('reminder_settings').select('user_id, enabled, max_reminders_per_day, interval_seconds, interval_minutes, reminder_times, snooze_until').in('user_id', ids),
      supabase.from('notification_logs').select('user_id, sent_at').eq('channel', 'whatsapp').in('user_id', ids),
      supabase.from('cookie_warning_logs').select('user_id, sent_at, session_updated_at, status').in('user_id', ids),
    ]);
    if (settingsError) throw new Error(`Gagal mengambil pengaturan reminder: ${settingsError.message}`);
    if (notificationError) throw new Error(`Gagal mengambil riwayat reminder: ${notificationError.message}`);
    if (cookieLogError) throw new Error(`Gagal mengambil riwayat warning cookie: ${cookieLogError.message}`);
    const settingsByUser = new Map((settingsData ?? []).map((row) => [row.user_id, row as SettingsRow]));
    const notificationRows = (notificationData ?? []) as NotificationRow[];
    const cookieLogs = (cookieLogData ?? []) as CookieLogRow[];

    const scheduleUpdatedAt = adminSettings.updated_at ? Date.parse(adminSettings.updated_at) : 0;
    const lastReminderAfterScheduleChange = notificationRows
      .filter((log) => Date.parse(log.sent_at) >= scheduleUpdatedAt)
      .reduce((latest, log) => Math.max(latest, Date.parse(log.sent_at)), 0);
    const bulkIntervalElapsed = !lastReminderAfterScheduleChange ||
      now.getTime() - lastReminderAfterScheduleChange >= adminSettings.interval_seconds * 1000;

    // Hitung total eksekusi pengiriman reminder WA hari ini ke WhatsApp (proteksi kuota Foonte)
    const todayJakarta = localDate(now, 'Asia/Jakarta');
    const distinctSendRunsToday = new Set(
      notificationRows
        .filter((log) => localDate(new Date(log.sent_at), 'Asia/Jakarta') === todayJakarta)
        .map((log) => log.sent_at)
    ).size;
    const adminDailyQuotaReached = distinctSendRunsToday >= adminSettings.max_reminders_per_day;

    // Status apakah reminder bersama dinonaktifkan
    const reminderTogetherDisabled = adminSettings.reminder_mode === 'bulk' && !adminSettings.reminder_together_enabled;

    // Evaluasi apakah reminder berpotensi dikirim saat ini
    const isPotentiallyDue = !adminDailyQuotaReached && !reminderTogetherDisabled;

    // LIVE VERIFICATION: Jika reminder berpotensi dikirim saat ini, verifikasi peserta
    // yang belum tercatat 'selesai' hari ini langsung ke MagangHub untuk mencegah
    // nama peserta yang SUDAH absen keliru dikirim sebagai belum absen!
    if (isPotentiallyDue) {
      const candidatesToVerify = eligibleSessions.filter((session) => {
        return latestTodayStatusByUser.get(session.user_id) !== 'selesai';
      });

      if (candidatesToVerify.length > 0) {
        const concurrency = 4;
        for (let index = 0; index < candidatesToVerify.length; index += concurrency) {
          const batch = candidatesToVerify.slice(index, index + concurrency);
          await Promise.allSettled(
            batch.map(async (session) => {
              try {
                const plaintext = await decryptSessionSecret(session.encrypted_session);
                if (!plaintext) return;
                const checkResult = await checkAndUpdateAttendance(session.user_id, plaintext, supabase);
                if (checkResult.success && checkResult.status !== 'unknown') {
                  latestTodayStatusByUser.set(session.user_id, checkResult.status);
                }
              } catch (verifyError) {
                console.warn(`[cron/reminder] Live verification gagal untuk peserta ${session.user_id}:`, verifyError);
              }
            })
          );
        }
      }
    }

    // Ambil daftar peserta yang BENAR-BENAR belum lapor untuk hari ini
    // Jika status belum diketahui (undefined/unknown), anggap belum lapor agar tidak terlewat.
    const unreportedSessions = eligibleSessions.filter((session) => {
      const status = latestTodayStatusByUser.get(session.user_id);
      return status !== 'selesai' && status !== 'session_expired';
    });

    // Evaluasi peserta yang jatuh tempo reminder berdasarkan preferensi waktu masing-masing
    const userDueSessions = unreportedSessions.filter((session) => {
      const settings = settingsByUser.get(session.user_id) ?? {
        user_id: session.user_id,
        enabled: true,
        max_reminders_per_day: 5,
        interval_seconds: 3600,
        interval_minutes: 60,
        reminder_times: ['07:00'],
        snooze_until: null,
      };
      if (!settings.enabled) return false;
      const profileData = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
      const timezone = profileData?.timezone || 'Asia/Jakarta';
      const today = localDate(now, timezone);
      const userTodayLogs = notificationRows.filter(
        (log) => log.user_id === session.user_id && localDate(new Date(log.sent_at), timezone) === today
      );
      return isParticipantReminderDue({
        settings,
        userTimezone: timezone,
        userTodayLogs,
        now,
      });
    });

    // Mode bulk & single: kirim reminder bagi peserta yang sedang jatuh tempo sesuai jadwal masing-masing
    const dueReportSessions = (adminDailyQuotaReached || reminderTogetherDisabled) ? [] : userDueSessions;

    let reportSent = false;
    let reportProviderFailures: ProviderFailure[] = [];
    if (dueReportSessions.length) {
      const members: CronReminderMember[] = dueReportSessions.map((session) => {
        const profileData = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
        return { name: profileData?.full_name?.trim() || 'Peserta MagangHub', status: 'belum_lapor' };
      });
      const useAutoReport = !!process.env.GEMINI_API_KEY;
      const formatFn = useAutoReport ? formatAutoReportReminder : formatBulkReportReminder;
      const messages = adminSettings.reminder_mode === 'bulk'
        ? [{ userIds: dueReportSessions.map(({ user_id }) => user_id), targets, message: formatFn(members) }]
        : dueReportSessions.map((session, index) => ({ userIds: [session.user_id], targets, message: formatFn([members[index]]) }));
      const sendOutcomes: { userIds: string[]; targets: string[]; results: FoonteSendResult[] }[] = [];
      for (const item of messages) sendOutcomes.push({ userIds: item.userIds, targets: item.targets, results: await sendToTargets(item.message, item.targets, foonte) });
      reportProviderFailures = sendOutcomes.flatMap((outcome) => outcome.results.filter((result) => !result.ok).map(summarizeProviderFailure));
      const sentUsers = [...new Set(sendOutcomes.flatMap((outcome) => outcome.results.every((result) => result.ok) ? outcome.userIds : []))];
      const auditEntries = sendOutcomes.flatMap((outcome) => outcome.results.map((result, index) => ({
        sent_at: now.toISOString(), status: result.ok ? 'sent' : 'failed', recipient: outcome.targets[index],
        member_count: adminSettings.reminder_mode === 'bulk' ? dueReportSessions.length : 1,
        provider_status: result.status, provider_response: result.responseBody || null,
      })));
      const { error: auditError } = auditEntries.length ? await supabase.from('reminder_logs').insert(auditEntries) : { error: null };
      if (auditError) throw new Error(`Gagal menyimpan audit reminder: ${auditError.message}`);
      if (sentUsers.length) {
        const { error } = await supabase.from('notification_logs').insert(sentUsers.map((user_id) => {
          const today = localDate(now, 'Asia/Jakarta');
          const previousCount = notificationRows.filter((log) => log.user_id === user_id && localDate(new Date(log.sent_at), 'Asia/Jakarta') === today).length;
          return { user_id, sent_at: now.toISOString(), status_at_send: 'belum_lapor', sequence_today: previousCount + 1, channel: 'whatsapp' };
        }));
        if (error) throw new Error(`Gagal menyimpan riwayat reminder: ${error.message}`);
        reportSent = true;
      }
    }

    // Web Push Notifications: kirim push notification browser ke semua peserta yang due
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    let pushSentCount = 0;
    if (vapidPublic && vapidPrivate && vapidSubject && userDueSessions.length > 0) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      const pushUserIds = userDueSessions.map((s) => s.user_id);
      const { data: pushSubs } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')
        .in('user_id', pushUserIds);
      if (pushSubs?.length) {
        const pushPayload = JSON.stringify({
          title: 'HubReminder — Reminder Laporan',
          body: 'Laporan harian MagangHub kamu belum diisi. Tap untuk isi sekarang.',
          url: 'https://monev.maganghub.kemnaker.go.id/dashboard',
        });
        await Promise.allSettled(
          pushSubs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                pushPayload
              );
              pushSentCount++;
            } catch (pushErr: unknown) {
              const errStatus = (pushErr as { statusCode?: number })?.statusCode;
              // 404 atau 410 berarti subscription sudah tidak valid, hapus dari database
              if (errStatus === 404 || errStatus === 410) {
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
              console.warn(`[cron/reminder] Push gagal ke ${sub.endpoint.slice(0, 40)}:`, pushErr);
            }
          })
        );
      }
    }

    const warningCandidates = await Promise.all(sessions.map(async (session) => {
      if (session.status === 'valid') {
        const expiry = await accessTokenExpiry(session.encrypted_session);
        if (!expiry || expiry > now.getTime() + 3 * 24 * 60 * 60 * 1000) return null;
        return { session, expiringSoon: expiry > now.getTime() };
      }
      return session.status === 'expired' ? { session, expiringSoon: false } : null;
    }));
    const warningMembers: { name: string; expiringSoon: boolean }[] = [];
    const warningSessions: SessionRow[] = [];
    for (const candidate of warningCandidates) {
      if (!candidate) continue;
      const { session, expiringSoon } = candidate;
      const logs = cookieLogs.filter((log) => log.user_id === session.user_id && Date.parse(log.sent_at) >= Date.parse(session.updated_at));
      const latest = logs.reduce((value, log) => Math.max(value, Date.parse(log.sent_at)), 0);
      const successfulRuns = new Set(logs.filter((log) => log.status === 'sent').map((log) => log.sent_at)).size;
      if (successfulRuns >= adminSettings.cookie_warning_count) continue;
      if (latest && now.getTime() - latest < adminSettings.cookie_warning_interval_minutes * 60_000) continue;
      warningSessions.push(session);
      warningMembers.push({ name: session.profiles?.full_name?.trim() || 'Peserta MagangHub', expiringSoon });
    }

    let cookieWarningsSent = 0;
    let cookieProviderFailures: ProviderFailure[] = [];
    if (warningSessions.length) {
      const warningBatches = adminSettings.reminder_mode === 'bulk'
        ? [{ sessions: warningSessions, members: warningMembers, targets }]
        : warningSessions.map((session, index) => ({ sessions: [session], members: [warningMembers[index]], targets }));
      for (const batch of warningBatches) {
        const hubUrl = process.env.APP_URL || request.nextUrl.origin;
        if (new URL(hubUrl).protocol !== 'https:') throw new Error('APP_URL untuk warning cookie harus menggunakan HTTPS');
        const results = await sendToTargets(formatCookieWarningMessage(batch.members, hubUrl), batch.targets, foonte);
        cookieProviderFailures.push(...results.filter((result) => !result.ok).map(summarizeProviderFailure));
        const sentAt = new Date().toISOString();
        const { error } = await supabase.from('cookie_warning_logs').insert(batch.sessions.flatMap((session) => results.map((result) => ({
          user_id: session.user_id, sent_at: sentAt, session_updated_at: session.updated_at,
          status: result.ok ? 'sent' : 'failed', provider_status: result.status, provider_response: result.responseBody || null,
        }))));
        if (error) throw new Error(`Gagal menyimpan riwayat warning cookie: ${error.message}`);
        if (results.some((result) => result.ok)) cookieWarningsSent += batch.sessions.length;
      }
    }

    const sessionsStillUnreported = unreportedSessions.length;
    const totalSentToday = distinctSendRunsToday;
    const reason = reportSent || cookieWarningsSent > 0 || pushSentCount > 0
      ? undefined
      : reminderTogetherDisabled
        ? 'reminder_together_disabled'
        : adminDailyQuotaReached
          ? 'admin_daily_quota_reached'
          : sessionsStillUnreported === 0 && warningSessions.length === 0
            ? 'no_unreported_or_cookie_warning_sessions'
            : userDueSessions.length === 0
              ? 'no_participants_due_at_this_time'
              : 'participants_blocked_by_settings_or_interval';
    return NextResponse.json({
      success: true,
      sent: reportSent || cookieWarningsSent > 0 || pushSentCount > 0,
      reason,
      reportSent,
      reportMemberCount: dueReportSessions.length,
      cookieWarningsSent,
      reportProviderFailures,
      cookieProviderFailures,
      reminderMode: adminSettings.reminder_mode,
      globalReminderDue: globalDue,
      startTime: adminSettings.start_time,
      intervalSeconds: adminSettings.interval_seconds,
      activeSessions: eligibleSessions.length,
      sessionsWithAttendanceCheck: latestTodayStatusByUser.size,
      sessionsStillUnreported,
      adminDailyQuotaReached,
      totalSentToday,
      maxRemindersPerDay: adminSettings.max_reminders_per_day,
      reminderTogetherEnabled: adminSettings.reminder_together_enabled,
      waBotEnabled: adminSettings.wa_bot_enabled,
      weekendReminderEnabled: adminSettings.weekend_reminder_enabled,
      pushSentCount,
    });
  } catch (error) {
    console.error('[cron/reminder] gagal menjalankan reminder:', error);
    return NextResponse.json({ error: 'Gagal menjalankan reminder', detail: error instanceof Error ? error.message : 'Kesalahan tidak diketahui' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) { return handleReminder(request); }
export async function GET(request: NextRequest) { return handleReminder(request); }
