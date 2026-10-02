// lib/attendance/evaluator.ts
// Logika evaluasi apakah push notification layak dikirim ke pengguna

import type { ReminderSettings, NotificationLog } from '@/lib/types/reminder';
import { DEFAULT_TIMEZONE } from '@/lib/utils/time';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export interface EvaluateParams {
  settings: ReminderSettings;
  timezone?: string;
  sentLogsToday: NotificationLog[];
  currentTime?: Date;
}

export interface EvaluateResult {
  shouldSend: boolean;
  reason: string;
}

/**
 * Menilai apakah pengingat harus dikirim saat ini.
 * Memastikan tidak ada pengiriman berulang melebihi kuota dan di luar jam aktif.
 */
export function evaluateReminder({
  settings,
  timezone = DEFAULT_TIMEZONE,
  sentLogsToday,
  currentTime = new Date(),
}: EvaluateParams): EvaluateResult {
  // 1. Cek apakah reminder diaktifkan secara global oleh pengguna
  if (!settings.enabled) {
    return { shouldSend: false, reason: 'reminder_disabled' };
  }

  // 2. Cek apakah ada snooze harian aktif
  const zonedCurrent = toZonedTime(currentTime, timezone);
  const todayStr = format(zonedCurrent, 'yyyy-MM-dd');
  if (settings.snooze_until && settings.snooze_until === todayStr) {
    return { shouldSend: false, reason: 'snoozed_for_today' };
  }

  // 3. Cek jadwal yang dipilih pengguna; rentang jam lama tidak dipakai.
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(currentTime);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => Number(timeParts.find((part) => part.type === type)?.value ?? 0);
  const currentSeconds = partValue('hour') * 3600 + partValue('minute') * 60 + partValue('second');
  const intervalSeconds = settings.interval_seconds ?? settings.interval_minutes * 60;
  const isScheduledTime = (settings.reminder_times?.length ? settings.reminder_times : ['07:00']).some((time) => {
    const [hourPart, minutePart, secondPart] = time.split(':');
    const scheduledSeconds = Number(hourPart) * 3600 + Number(minutePart) * 60 + Number(secondPart ?? 0);
    return currentSeconds >= scheduledSeconds && currentSeconds - scheduledSeconds < intervalSeconds;
  });
  if (!isScheduledTime) {
    return { shouldSend: false, reason: 'outside_reminder_schedule' };
  }

  // 4. Cek apakah sudah mencapai kuota maksimum hari ini
  if (sentLogsToday.length >= settings.max_reminders_per_day) {
    return { shouldSend: false, reason: 'max_daily_quota_reached' };
  }

  // 5. Cek interval jeda dari pengiriman terakhir
  if (sentLogsToday.length > 0) {
    // Cari waktu sent_at terbaru
    const sortedLogs = [...sentLogsToday].sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    const lastSentTime = new Date(sortedLogs[0].sent_at).getTime();
    const diffMinutes = Math.floor((currentTime.getTime() - lastSentTime) / (1000 * 60));

    if (diffMinutes < settings.interval_minutes) {
      return {
        shouldSend: false,
        reason: `interval_not_met: ${diffMinutes}m < ${settings.interval_minutes}m`,
      };
    }
  }

  return { shouldSend: true, reason: 'eligible' };
}
