// lib/types/reminder.ts
export interface ReminderSettings {
  user_id: string;
  enabled: boolean;
  max_reminders_per_day: number; // default 5
  interval_minutes: number;      // legacy value; derived from interval_seconds
  interval_seconds: number;      // default 3600; valid values are defined below
  reminder_times: string[];      // "HH:MM", minute precision in the user's timezone
  /** @deprecated Digantikan oleh reminder_times; dipertahankan untuk kompatibilitas data lama. */
  active_start_time: string;
  /** @deprecated Digantikan oleh reminder_times; dipertahankan untuk kompatibilitas data lama. */
  active_end_time: string;
  snooze_until: string | null;   // date string "YYYY-MM-DD", nullable
  updated_at: string;
}

export const REMINDER_INTERVAL_OPTIONS = [
  { value: 900, label: '15 menit' },
  { value: 1800, label: '30 menit' },
  { value: 3600, label: '1 jam' },
  { value: 5400, label: '1,5 jam' },
  { value: 7200, label: '2 jam' },
  { value: 10800, label: '3 jam' },
  { value: 14400, label: '4 jam' },
] as const;

export const REMINDER_INTERVAL_SECONDS = REMINDER_INTERVAL_OPTIONS.map(({ value }) => value);

export interface NotificationLog {
  id: string;
  user_id: string;
  sent_at: string;
  status_at_send: 'belum_lapor' | 'session_expired';
  sequence_today: number;
}
