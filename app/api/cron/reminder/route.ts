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
type NotificationRow = { user_id: string; sent_at: string; channel?: 'push' | 'whatsapp' };
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

export function isGlobalReminderDue(now: Date, startTime: string, intervalSeconds: number) {
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
  if (arrivedCheckpoints.length === 0) {
    return false;
  }
  const latestArrivedCheckpoint = arrivedCheckpoints[arrivedCheckpoints.length - 1];

  // Hitung detik waktu pengiriman setiap log hari ini dalam zona waktu pengguna
  const logSecondsToday = userTodayLogs.map((log) => {
    const logParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: userTimezone,
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.parse(log.sent_at)));
    const getLogPart = (type: Intl.DateTimeFormatPartTypes) => Number(logParts.find((p) => p.type === type)?.value ?? 0);
    return getLogPart('hour') * 3600 + getLogPart('minute') * 60 + getLogPart('second');
  });

  // Cek apakah checkpoint terbaru yang sudah tiba ini SUDAH pernah dikirimi reminder hari ini
  // (yaitu ada pengiriman yang terjadi pada atau setelah jam checkpoint tersebut).
  // Menghindari bug pengiriman berulang pada browser (hanya kirim 1x per checkpoint).
  const hasLogForLatestCheckpoint = logSecondsToday.some((sec) => sec >= latestArrivedCheckpoint);
  if (hasLogForLatestCheckpoint) {
    return false;
  }

  // Jika checkpoint ini BELUM pernah dikirimi pengingat, pastikan jeda cooldown minimum (60 detik)
  // dari pengiriman sebelumnya telah terpenuhi agar tidak spam jika cron tereksekusi dua kali dalam jendela waktu dekat.
  if (userTodayLogs.length > 0) {
    const latestLogTime = userTodayLogs.reduce(
      (latest, log) => Math.max(latest, Date.parse(log.sent_at)),
      0
    );
    if (now.getTime() - latestLogTime < 60 * 1000) {
      return false;
    }
  }

  return true;
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

    const now = new Date();

    const jakartaDayOfWeek = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
    }).format(now);
    const isWeekend = jakartaDayOfWeek === 'Sat' || jakartaDayOfWeek === 'Sun';

    const isWaBotActive = !!adminSettings.wa_bot_enabled;
    const isWeekendAllowed = !isWeekend || !!adminSettings.weekend_reminder_enabled;
    const isWaAllowed = isWaBotActive && isWeekendAllowed;

    let foonte: ReturnType<typeof getFoonteConfig> | null = null;
    let targets: string[] = [];
    if (isWaAllowed) {
      try {
        foonte = getFoonteConfig();
        targets = getFoonteTargets();
      } catch (err) {
        console.warn('[cron/reminder] Gagal inisialisasi Foonte:', err);
      }
    }

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
        const profileData = Array.isArray(session?.profiles) ? session?.profiles[0] : session?.profiles;
        const tz = profileData?.timezone || 'Asia/Jakarta';
        if (isTodayInTz(check.checked_at, tz)) {
          latestTodayStatusByUser.set(check.user_id, check.status);
        }
      }
    }

    const ids = sessions.map((session) => session.user_id);

    // Filter notification_logs ke 2 hari terakhir agar tidak memuat seluruh history
    // dan menghindari bug timezone saat membandingkan tanggal hari ini.
    const twoDaysAgoIso = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: settingsData, error: settingsError },
      { data: notificationData, error: notificationError },
      { data: cookieLogData, error: cookieLogError },
      { data: phoneMappingData },
    ] = await Promise.all([
      supabase.from('reminder_settings').select('user_id, enabled, max_reminders_per_day, interval_seconds, interval_minutes, reminder_times, snooze_until, updated_at').in('user_id', ids).order('updated_at', { ascending: false }),
      supabase.from('notification_logs').select('user_id, sent_at, channel').in('user_id', ids).gte('sent_at', twoDaysAgoIso),
      supabase.from('cookie_warning_logs').select('user_id, sent_at, session_updated_at, status').in('user_id', ids).gte('sent_at', twoDaysAgoIso),
      supabase.from('wa_phone_mappings').select('user_id, phone_number').in('user_id', ids),
    ]);
    if (settingsError) throw new Error(`Gagal mengambil pengaturan reminder: ${settingsError.message}`);
    if (notificationError) throw new Error(`Gagal mengambil riwayat reminder: ${notificationError.message}`);
    if (cookieLogError) throw new Error(`Gagal mengambil riwayat warning cookie: ${cookieLogError.message}`);

    // Petakan nomor WhatsApp yang terhubung ke masing-masing pengguna
    const phoneNumbersByUser = new Map<string, string[]>();
    for (const mapping of (phoneMappingData ?? []) as { user_id: string; phone_number: string }[]) {
      const existing = phoneNumbersByUser.get(mapping.user_id) ?? [];
      if (!existing.includes(mapping.phone_number)) {
        existing.push(mapping.phone_number);
      }
      phoneNumbersByUser.set(mapping.user_id, existing);
    }

    // Bangun Map settings per user, ambil yang paling baru (updated_at terbesar) jika ada duplikat
    // Duplikat bisa terjadi jika primary key constraint tidak berlaku pada tabel lama.
    const settingsByUser = new Map<string, SettingsRow>();
    for (const row of (settingsData ?? []) as (SettingsRow & { updated_at?: string })[]) {
      if (!settingsByUser.has(row.user_id)) {
        // Normalisasi reminder_times: DB mengembalikan time[] sebagai 'HH:MM:SS', potong ke 'HH:MM'
        const normalized: SettingsRow = {
          ...row,
          reminder_times: (row.reminder_times ?? ['07:00']).map((t) => t.slice(0, 5)),
        };
        settingsByUser.set(row.user_id, normalized);
      }
    }

    const notificationRows = (notificationData ?? []) as NotificationRow[];
    const cookieLogs = (cookieLogData ?? []) as CookieLogRow[];

    const waNotificationRows = notificationRows.filter((log) => log.channel === 'whatsapp');
    const pushNotificationRows = notificationRows.filter((log) => log.channel === 'push');

    // 1. Jadwal Pengingat WhatsApp Grup (Admin Bulk Mode)
    const todayJakarta = localDate(now, 'Asia/Jakarta');

    // Hitung admin start_time dalam UTC milisecond agar bisa dibandingkan dengan sent_at log
    const [adminStartHour = 8, adminStartMinute = 0] = adminSettings.start_time.split(':').map(Number);
    const adminStartSeconds = adminStartHour * 3600 + adminStartMinute * 60;
    const currentJakartaSec = jakartaSeconds(now);
    const adminStartTimeReached = currentJakartaSec >= adminStartSeconds;

    // Kuota harian admin hanya menghitung pengiriman WA yang terjadi SETELAH start_time hari ini.
    // Pengiriman dari jadwal lama (sebelum admin mengubah start_time) tidak ikut menghitung,
    // sehingga perubahan start_time langsung efektif pada hari yang sama.
    const adminStartUtcMs = new Date(
      `${todayJakarta}T${String(adminStartHour).padStart(2, '0')}:${String(adminStartMinute).padStart(2, '0')}:00+07:00`
    ).getTime();
    const todayWaLogsFromStartTime = waNotificationRows.filter((log) => {
      const logMs = Date.parse(log.sent_at);
      return localDate(new Date(logMs), 'Asia/Jakarta') === todayJakarta && logMs >= adminStartUtcMs;
    });

    const distinctWaRunsToday = new Set(todayWaLogsFromStartTime.map((log) => log.sent_at)).size;
    const adminDailyQuotaReached = distinctWaRunsToday >= adminSettings.max_reminders_per_day;

    // Interval admin:
    // 1. Jika belum ada pengiriman WA sejak start_time hari ini (pengiriman perdana untuk jadwal start_time ini):
    //    Cukup pastikan tidak double-send dalam rentang 60 detik terakhir (debounce) dari pengiriman WA apapun hari ini.
    //    Pengiriman perdana TIDAK boleh diblokir oleh interval dari pengiriman jadwal lama sebelum start_time.
    // 2. Jika sudah pernah ada pengiriman WA sejak start_time hari ini:
    //    Pengiriman berikutnya wajib mematuhi interval_seconds dari pengiriman terakhir setelah start_time.
    const lastWaRunSinceStartTime = todayWaLogsFromStartTime.reduce(
      (latest, log) => Math.max(latest, Date.parse(log.sent_at)),
      0
    );
    const lastAnyWaRunToday = waNotificationRows
      .filter((log) => localDate(new Date(log.sent_at), 'Asia/Jakarta') === todayJakarta)
      .reduce((latest, log) => Math.max(latest, Date.parse(log.sent_at)), 0);

    const adminIntervalElapsed = todayWaLogsFromStartTime.length === 0
      ? (!lastAnyWaRunToday || now.getTime() - lastAnyWaRunToday >= 60 * 1000)
      : (now.getTime() - lastWaRunSinceStartTime >= adminSettings.interval_seconds * 1000);

    const isBulkReminderDue = isWaAllowed &&
      adminSettings.reminder_mode === 'bulk' &&
      adminSettings.reminder_together_enabled &&
      !adminDailyQuotaReached &&
      adminStartTimeReached &&
      adminIntervalElapsed;

    // LIVE VERIFICATION: Verifikasi peserta yang belum tercatat 'selesai' hari ini langsung ke MagangHub
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

    // Ambil daftar peserta yang BENAR-BENAR belum lapor untuk hari ini
    const unreportedSessions = eligibleSessions.filter((session) => {
      const status = latestTodayStatusByUser.get(session.user_id);
      return status !== 'selesai' && status !== 'session_expired';
    });

    // 2. Evaluasi Web Push per peserta berdasarkan preferensi jadwal personal masing-masing
    const userDuePushSessions = unreportedSessions.filter((session) => {
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
      const userTodayPushLogs = pushNotificationRows.filter(
        (log) => log.user_id === session.user_id && localDate(new Date(log.sent_at), timezone) === today
      );
      return isParticipantReminderDue({
        settings,
        userTimezone: timezone,
        userTodayLogs: userTodayPushLogs,
        now,
      });
    });

    // 3. Evaluasi sesi untuk pengiriman WhatsApp:
    // A. Jadwal Bulk Admin (Reminder Bersama Grup):
    const bulkReportSessions = unreportedSessions.filter((session) => {
      const settings = settingsByUser.get(session.user_id);
      if (!settings) return true;
      if (!settings.enabled) return false;
      const profileData = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
      const timezone = profileData?.timezone || 'Asia/Jakarta';
      const today = localDate(now, timezone);
      if (settings.snooze_until === today) return false;
      return true;
    });

    // B. Jadwal Personal Per-User (Reminder Per User via WhatsApp):
    // Memeriksa peserta belum lapor yang jadwal pengingat pribadinya (reminder_times) sedang jatuh tempo.
    // Menjamin bahwa saat jadwal user tiba, notifikasi terkirim ke Web Push DAN WhatsApp.
    const personalWaDueSessions = isWaAllowed
      ? unreportedSessions.filter((session) => {
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
          const userTodayWaLogs = waNotificationRows.filter(
            (log) => log.user_id === session.user_id && localDate(new Date(log.sent_at), timezone) === today
          );
          return isParticipantReminderDue({
            settings,
            userTimezone: timezone,
            userTodayLogs: userTodayWaLogs,
            now,
          });
        })
      : [];

    let reportSent = false;
    let reportProviderFailures: ProviderFailure[] = [];
    let waReportUserCount = 0;

    if (isWaAllowed && foonte) {
      const useAutoReport = !!process.env.GEMINI_API_KEY;
      const formatFn = useAutoReport ? formatAutoReportReminder : formatBulkReportReminder;
      const messages: { userIds: string[]; targets: string[]; message: string }[] = [];

      // 1. Eksekusi Reminder Bersama (Admin Bulk):
      // Jika mode bulk aktif, jadwal admin tiba, kuota admin belum habis, dan ada peserta yang belum lapor
      if (isBulkReminderDue && bulkReportSessions.length > 0 && targets.length > 0) {
        const members: CronReminderMember[] = bulkReportSessions.map((session) => {
          const profileData = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
          return { name: profileData?.full_name?.trim() || 'Peserta MagangHub', status: 'belum_lapor' };
        });
        messages.push({
          userIds: bulkReportSessions.map(({ user_id }) => user_id),
          targets,
          message: formatFn(members),
        });
      }

      // 2. Eksekusi Reminder Per-User (Personal WhatsApp Reminder):
      // Kirim pesan WhatsApp ke nomor peserta dan/atau grup sesuai jam pengingat masing-masing.
      // Jika di menit ini pesan bulk admin sudah mencakup peserta tersebut, hindari duplikasi pesan di menit yang sama.
      const bulkCoveredUserIds = isBulkReminderDue
        ? new Set(bulkReportSessions.map((s) => s.user_id))
        : new Set<string>();

      const standalonePersonalSessions = personalWaDueSessions.filter(
        (s) => !bulkCoveredUserIds.has(s.user_id)
      );

      for (const session of standalonePersonalSessions) {
        const profileData = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;
        const memberName = profileData?.full_name?.trim() || 'Peserta MagangHub';
        const singleMessage = formatFn([{ name: memberName }]);

        const userPhones = phoneNumbersByUser.get(session.user_id) ?? [];
        // Jika nomor WA sudah ter-mapping atau sudah mengirim chat via pribadi, kirim HANYA ke chat pribadi (tidak ke grup).
        // Grup WA hanya digunakan sebagai fallback jika peserta belum memiliki nomor WA yang termapping.
        const destTargets = userPhones.length > 0
          ? userPhones
          : targets;

        if (destTargets.length > 0) {
          messages.push({
            userIds: [session.user_id],
            targets: destTargets,
            message: singleMessage,
          });
        }
      }

      waReportUserCount = new Set(messages.flatMap((m) => m.userIds)).size;

      if (messages.length > 0) {
        const sendOutcomes: { userIds: string[]; targets: string[]; results: FoonteSendResult[] }[] = [];
        for (const item of messages) {
          sendOutcomes.push({
            userIds: item.userIds,
            targets: item.targets,
            results: await sendToTargets(item.message, item.targets, foonte),
          });
        }

        reportProviderFailures = sendOutcomes.flatMap((outcome) =>
          outcome.results.filter((result) => !result.ok).map(summarizeProviderFailure)
        );

        const sentUsers = [...new Set(sendOutcomes.flatMap((outcome) =>
          outcome.results.every((result) => result.ok) ? outcome.userIds : []
        ))];

        const auditEntries = sendOutcomes.flatMap((outcome) =>
          outcome.results.map((result, index) => ({
            sent_at: now.toISOString(),
            status: result.ok ? ('sent' as const) : ('failed' as const),
            recipient: outcome.targets[index] || 'unknown',
            member_count: outcome.userIds.length,
            provider_status: result.status,
            provider_response: result.responseBody || null,
          }))
        );

        const { error: auditError } = auditEntries.length
          ? await supabase.from('reminder_logs').insert(auditEntries)
          : { error: null };
        if (auditError) console.error('[cron/reminder] Gagal menyimpan audit reminder:', auditError.message);

        if (sentUsers.length > 0) {
          const today = localDate(now, 'Asia/Jakarta');
          const notificationLogEntries = sentUsers.map((user_id) => {
            const previousCount = waNotificationRows.filter(
              (log) => log.user_id === user_id && localDate(new Date(log.sent_at), 'Asia/Jakarta') === today
            ).length;
            return {
              user_id,
              sent_at: now.toISOString(),
              status_at_send: 'belum_lapor' as const,
              sequence_today: previousCount + 1,
              channel: 'whatsapp' as const,
            };
          });

          const { error: notifError } = await supabase.from('notification_logs').insert(notificationLogEntries);
          if (notifError) console.error('[cron/reminder] Gagal menyimpan riwayat reminder:', notifError.message);
          reportSent = true;
        }
      }
    }

    // Web Push Notifications: kirim push notification browser ke peserta yang due sesuai jadwal personalnya
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;
    let pushSentCount = 0;
    const successfulPushUserIds: string[] = [];
    if (vapidPublic && vapidPrivate && vapidSubject && userDuePushSessions.length > 0) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      const pushUserIds = userDuePushSessions.map((s) => s.user_id);
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
              successfulPushUserIds.push(sub.user_id);
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

    // Catat log pengiriman Web Push agar tidak dikirim berulang setiap menit
    const distinctPushUsers = [...new Set(successfulPushUserIds)];
    if (distinctPushUsers.length > 0) {
      const today = localDate(now, 'Asia/Jakarta');
      const pushLogEntries = distinctPushUsers.map((user_id) => {
        const previousCount = pushNotificationRows.filter(
          (log) => log.user_id === user_id && localDate(new Date(log.sent_at), 'Asia/Jakarta') === today
        ).length;
        return {
          user_id,
          sent_at: now.toISOString(),
          status_at_send: 'belum_lapor' as const,
          sequence_today: previousCount + 1,
          channel: 'push' as const,
        };
      });
      const { error: pushLogError } = await supabase.from('notification_logs').insert(pushLogEntries);
      if (pushLogError) {
        console.error('[cron/reminder] Gagal mencatat notification_logs untuk push:', pushLogError.message);
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
    if (warningSessions.length && foonte && targets.length) {
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
    const totalSentToday = distinctWaRunsToday;
    const reason = reportSent || cookieWarningsSent > 0 || pushSentCount > 0
      ? undefined
      : !adminSettings.reminder_together_enabled && adminSettings.reminder_mode === 'bulk'
        ? 'reminder_together_disabled'
        : !adminSettings.wa_bot_enabled
          ? 'wa_bot_disabled'
          : !isWeekendAllowed
            ? 'weekend_reminder_disabled'
            : adminDailyQuotaReached
              ? 'admin_daily_quota_reached'
              : sessionsStillUnreported === 0 && warningSessions.length === 0
                ? 'no_unreported_or_cookie_warning_sessions'
                : waReportUserCount === 0 && userDuePushSessions.length === 0
                  ? 'no_participants_due_at_this_time'
                  : 'participants_blocked_by_settings_or_interval';
    return NextResponse.json({
      success: true,
      sent: reportSent || cookieWarningsSent > 0 || pushSentCount > 0,
      reason,
      reportSent,
      reportMemberCount: waReportUserCount,
      cookieWarningsSent,
      reportProviderFailures,
      cookieProviderFailures,
      reminderMode: adminSettings.reminder_mode,
      globalReminderDue: isBulkReminderDue,
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
