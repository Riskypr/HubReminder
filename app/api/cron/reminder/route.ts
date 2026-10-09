import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { formatAutoReportReminder, formatBulkReportReminder, formatCookieWarningMessage, type CronReminderMember } from '@/lib/services/cronReminderService';
import { getFoonteConfig, getFoonteTargets, sendFoonteMessage, type FoonteSendResult } from '@/lib/services/foonteService';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_SYSTEM_REMINDER_SETTINGS, getSystemReminderSettings } from '@/lib/services/systemReminderSettingsService';
import { decryptSessionSecret } from '@/lib/utils/crypto';
import type { AttendanceStatus } from '@/lib/types/attendance';

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
 * Cek apakah waktu sekarang cocok dengan salah satu reminder_times user.
 * Digunakan di mode single agar setiap user menggunakan jadwalnya sendiri,
 * tidak tergantung jam mulai admin (menghindari tabrakan jadwal).
 */
function isUserReminderTimeDue(now: Date, reminderTimes: string[], timezone: string): boolean {
  if (!reminderTimes.length) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00';
  const currentHHMM = `${get('hour')}:${get('minute')}`;
  // Cron berjalan tiap menit; cocokkan dengan toleransi tepat di menit yang ditentukan.
  return reminderTimes.some((time) => time.slice(0, 5) === currentHHMM);
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

    // Jika bot WA dinonaktifkan oleh admin, jangan kirim pesan apapun ke WhatsApp
    if (!adminSettings.wa_bot_enabled) {
      return NextResponse.json({
        success: true,
        sent: false,
        reason: 'wa_bot_disabled',
        detail: 'Layanan Bot WhatsApp dinonaktifkan oleh admin.',
        waBotEnabled: false,
        reminderTogetherEnabled: adminSettings.reminder_together_enabled,
      });
    }

    const foonte = getFoonteConfig();
    const targets = getFoonteTargets();
    if (!targets.length) throw new Error('Konfigurasikan FOONTE_WA_GROUP_ID atau FOONTE_WA_TARGETS');
    const now = new Date();
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
    const latestStatusByUser = new Map<string, AttendanceStatus>();
    for (const check of (checks ?? []) as CheckRow[]) if (!latestStatusByUser.has(check.user_id)) latestStatusByUser.set(check.user_id, check.status);

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

    const unreportedSessions = eligibleSessions.filter((session) => latestStatusByUser.get(session.user_id) === 'belum_lapor');
    const scheduleUpdatedAt = adminSettings.updated_at ? Date.parse(adminSettings.updated_at) : 0;
    const lastReminderAfterScheduleChange = notificationRows
      .filter((log) => Date.parse(log.sent_at) >= scheduleUpdatedAt)
      .reduce((latest, log) => Math.max(latest, Date.parse(log.sent_at)), 0);
    const bulkIntervalElapsed = !lastReminderAfterScheduleChange ||
      now.getTime() - lastReminderAfterScheduleChange >= adminSettings.interval_seconds * 1000;

    // Hitung total reminder WA yang sudah terkirim hari ini (semua user, mode apapun).
    // Digunakan untuk melindungi kuota Foonte agar tidak jebol.
    const todayJakarta = localDate(now, 'Asia/Jakarta');
    const totalSentToday = notificationRows.filter(
      (log) => localDate(new Date(log.sent_at), 'Asia/Jakarta') === todayJakarta,
    ).length;
    const adminDailyQuotaReached = totalSentToday >= adminSettings.max_reminders_per_day;

    // Status apakah reminder bersama dinonaktifkan
    const reminderTogetherDisabled = adminSettings.reminder_mode === 'bulk' && !adminSettings.reminder_together_enabled;

    // Mode bulk: ikuti jadwal global admin (start_time + interval).
    // Mode single: tiap user ikuti reminder_times-nya sendiri, BUKAN jadwal admin —
    //   ini mencegah tabrakan saat admin mengatur jam yang berbeda dari jadwal user.
    const dueReportSessions = (adminDailyQuotaReached || reminderTogetherDisabled) ? [] : adminSettings.reminder_mode === 'bulk'
      // Bulk follows the admin's global schedule and includes every connected participant
      // whose latest attendance status is still unreported, regardless of personal snooze/quota.
      ? (!globalDue || !bulkIntervalElapsed ? [] : unreportedSessions)
      // Single mode: setiap user diperiksa berdasarkan reminder_times-nya sendiri.
      // globalDue TIDAK digunakan di sini agar jadwal user tidak tabrakan dengan jadwal admin.
      : unreportedSessions.filter((session) => {
        const settings = settingsByUser.get(session.user_id);
        if (!settings?.enabled) return false;
        const timezone = session.profiles?.timezone || 'Asia/Jakarta';
        const today = localDate(now, timezone);
        if (settings.snooze_until === today) return false;
        const todayLogs = notificationRows.filter((log) => log.user_id === session.user_id && localDate(new Date(log.sent_at), timezone) === today);
        if (todayLogs.length >= settings.max_reminders_per_day) return false;
        // Cek apakah waktu sekarang cocok dengan salah satu reminder_times user.
        // Tidak bergantung pada jadwal admin sehingga bebas tabrakan.
        if (!isUserReminderTimeDue(now, settings.reminder_times ?? [], timezone)) return false;
        const latestLog = todayLogs
          .filter((log) => Date.parse(log.sent_at) >= scheduleUpdatedAt)
          .reduce((latest, log) => Math.max(latest, Date.parse(log.sent_at)), 0);
        // Pastikan interval minimum terpenuhi sejak reminder terakhir.
        return !latestLog || now.getTime() - latestLog >= (settings.interval_seconds ?? adminSettings.interval_seconds) * 1000;
      });

    let reportSent = false;
    let reportProviderFailures: ProviderFailure[] = [];
    if (dueReportSessions.length) {
      const members: CronReminderMember[] = dueReportSessions.map((session) => ({ name: session.profiles?.full_name?.trim() || 'Peserta MagangHub', status: 'belum_lapor' }));
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
    const reason = reportSent || cookieWarningsSent > 0
      ? undefined
      : reminderTogetherDisabled
        ? 'reminder_together_disabled'
        : adminDailyQuotaReached
          ? 'admin_daily_quota_reached'
          : !globalDue && adminSettings.reminder_mode === 'bulk' && sessionsStillUnreported > 0
            ? 'global_schedule_not_due'
            : sessionsStillUnreported === 0 && warningSessions.length === 0
              ? 'no_unreported_or_cookie_warning_sessions'
              : 'participants_blocked_by_settings_or_interval';
    return NextResponse.json({
      success: true,
      sent: reportSent || cookieWarningsSent > 0,
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
      sessionsWithAttendanceCheck: latestStatusByUser.size,
      sessionsStillUnreported,
      adminDailyQuotaReached,
      totalSentToday,
      maxRemindersPerDay: adminSettings.max_reminders_per_day,
      reminderTogetherEnabled: adminSettings.reminder_together_enabled,
      waBotEnabled: adminSettings.wa_bot_enabled,
    });
  } catch (error) {
    console.error('[cron/reminder] gagal menjalankan reminder:', error);
    return NextResponse.json({ error: 'Gagal menjalankan reminder', detail: error instanceof Error ? error.message : 'Kesalahan tidak diketahui' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) { return handleReminder(request); }
export async function GET(request: NextRequest) { return handleReminder(request); }
