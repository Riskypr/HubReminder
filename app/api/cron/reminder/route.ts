import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { formatCronReminderMessage, type CronReminderMember } from '@/lib/services/cronReminderService';
import { getFoonteConfig, sendFoonteMessage } from '@/lib/services/foonteService';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AttendanceStatus } from '@/lib/types/attendance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SessionRow = { user_id: string; profiles: { full_name: string | null; timezone?: string | null } | null };
type CheckRow = { user_id: string; status: AttendanceStatus; checked_at: string };
type SettingsRow = {
  user_id: string;
  enabled: boolean;
  max_reminders_per_day: number;
  interval_seconds: number;
  interval_minutes: number;
  reminder_times: string[];
  snooze_until: string | null;
};
type NotificationRow = { user_id: string; sent_at: string };

function localDateAndSeconds(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '0';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  const second = Number(value('second'));
  return { date: `${value('year')}-${value('month')}-${value('day')}`, seconds: hour * 3600 + minute * 60 + second };
}

function isReminderTimeDue(times: string[], intervalSeconds: number, now: Date, timezone: string) {
  const nowSeconds = localDateAndSeconds(now, timezone).seconds;
  return times.some((time) => {
    const [hourPart, minutePart, secondPart] = time.split(':');
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    const second = secondPart === undefined ? 0 : Number(secondPart);
    const scheduledSeconds = hour * 3600 + minute * 60 + second;
    return nowSeconds >= scheduledSeconds && nowSeconds - scheduledSeconds < intervalSeconds;
  });
}

function isValidSecret(receivedSecret: string | null): boolean {
  const expectedSecret = process.env.CRON_SECRET_KEY;
  if (!expectedSecret || !receivedSecret) return false;
  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function handleReminder(request: NextRequest) {
  if (!process.env.CRON_SECRET_KEY) {
    return NextResponse.json({ error: 'Konfigurasi cron belum lengkap' }, { status: 500 });
  }
  if (!isValidSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data: sessions, error: sessionError } = await supabase
      .from('maganghub_sessions')
      .select('user_id, profiles(full_name, timezone)')
      .eq('status', 'valid');
    if (sessionError) throw new Error(`Gagal mengambil sesi aktif: ${sessionError.message}`);
    if (!sessions?.length) {
      return NextResponse.json({ success: true, sent: false, reason: 'no_active_sessions' });
    }

    const { data: checks, error: checkError } = await supabase
      .from('attendance_checks')
      .select('user_id, status, checked_at')
      .in('user_id', sessions.map((session) => session.user_id))
      .order('checked_at', { ascending: false });
    if (checkError) throw new Error(`Gagal mengambil status laporan: ${checkError.message}`);

    const latestStatusByUser = new Map<string, AttendanceStatus>();
    for (const check of (checks ?? []) as CheckRow[]) {
      if (!latestStatusByUser.has(check.user_id)) latestStatusByUser.set(check.user_id, check.status);
    }
    const sessionRows = sessions as unknown as SessionRow[];
    const { data: settingsData, error: settingsError } = await supabase
      .from('reminder_settings').select('user_id, enabled, max_reminders_per_day, interval_seconds, interval_minutes, reminder_times, snooze_until')
      .in('user_id', sessionRows.map((session) => session.user_id));
    if (settingsError) throw new Error(`Gagal mengambil pengaturan reminder: ${settingsError.message}`);
    const settingsByUser = new Map((settingsData ?? []).map((settings) => [settings.user_id, settings as SettingsRow]));
    const { data: notificationData, error: notificationError } = await supabase
      .from('notification_logs').select('user_id, sent_at')
      .eq('channel', 'whatsapp')
      .in('user_id', sessionRows.map((session) => session.user_id));
    if (notificationError) throw new Error(`Gagal mengambil riwayat reminder: ${notificationError.message}`);
    const notificationRows = (notificationData ?? []) as NotificationRow[];
    const now = new Date();
    const eligibleSessions = sessionRows.filter((session) => {
      const settings = settingsByUser.get(session.user_id);
      if (!settings?.enabled || latestStatusByUser.get(session.user_id) !== 'belum_lapor') return false;
      const timezone = session.profiles?.timezone || 'Asia/Jakarta';
      const localNow = localDateAndSeconds(now, timezone);
      if (settings.snooze_until === localNow.date) return false;
      const intervalSeconds = settings.interval_seconds ?? settings.interval_minutes * 60;
      if (!isReminderTimeDue(settings.reminder_times?.length ? settings.reminder_times : ['07:00'], intervalSeconds, now, timezone)) return false;
      const todayLogs = notificationRows.filter((log) => log.user_id === session.user_id &&
        localDateAndSeconds(new Date(log.sent_at), timezone).date === localNow.date);
      if (todayLogs.length >= settings.max_reminders_per_day) return false;
      const latestLog = todayLogs.reduce((latest, log) => Math.max(latest, Date.parse(log.sent_at)), 0);
      return !latestLog || now.getTime() - latestLog >= intervalSeconds * 1000;
    });

    if (!eligibleSessions.length) {
      return NextResponse.json({ success: true, sent: false, reason: 'no_reminders_due' });
    }
    const members: CronReminderMember[] = eligibleSessions.map((session) => ({
      name: session.profiles?.full_name?.trim() || 'Peserta MagangHub',
      status: latestStatusByUser.get(session.user_id) ?? 'unknown',
    }));

    const result = await sendFoonteMessage(formatCronReminderMessage(members), getFoonteConfig());
    const { error: logError } = await supabase.from('reminder_logs').insert({
      sent_at: new Date().toISOString(),
      status: result.ok ? 'sent' : 'failed',
      recipient: process.env.FOONTE_WA_GROUP_ID,
      member_count: members.length,
      provider_status: result.status,
      provider_response: result.responseBody || null,
    });
    if (logError) throw new Error(`Gagal menyimpan log reminder: ${logError.message}`);
    if (!result.ok) return NextResponse.json({ error: 'Foonte menolak pengiriman reminder' }, { status: 502 });

    const sentAt = new Date().toISOString();
    const { error: notificationLogError } = await supabase.from('notification_logs').insert(
      eligibleSessions.map((session) => {
        const previousCount = notificationRows.filter((log) => log.user_id === session.user_id &&
          localDateAndSeconds(new Date(log.sent_at), session.profiles?.timezone || 'Asia/Jakarta').date ===
          localDateAndSeconds(new Date(sentAt), session.profiles?.timezone || 'Asia/Jakarta').date).length;
        return {
          user_id: session.user_id,
          sent_at: sentAt,
          status_at_send: 'belum_lapor',
          sequence_today: previousCount + 1,
          channel: 'whatsapp',
        };
      })
    );
    if (notificationLogError) throw new Error(`Gagal menyimpan riwayat pengiriman reminder: ${notificationLogError.message}`);

    return NextResponse.json({ success: true, sent: true, recipients: members.length });
  } catch (error) {
    console.error('[cron/reminder] gagal menjalankan reminder:', error);
    return NextResponse.json({ error: 'Gagal menjalankan reminder' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleReminder(request);
}

export async function GET(request: NextRequest) {
  return handleReminder(request);
}
