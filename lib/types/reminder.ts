// lib/types/reminder.ts
export interface ReminderSettings {
  user_id: string;
  enabled: boolean;
  max_reminders_per_day: number; // default 5
  interval_minutes: number;      // legacy value; derived from interval_seconds
  interval_seconds: number;      // default 3600; 15 is available for testing
  reminder_times: string[];      // "HH:MM" or "HH:MM:SS", in the user's timezone
  /** @deprecated Digantikan oleh reminder_times; dipertahankan untuk kompatibilitas data lama. */
  active_start_time: string;
  /** @deprecated Digantikan oleh reminder_times; dipertahankan untuk kompatibilitas data lama. */
  active_end_time: string;
  snooze_until: string | null;   // date string "YYYY-MM-DD", nullable
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  sent_at: string;
  status_at_send: 'belum_lapor' | 'session_expired';
  sequence_today: number;
}
