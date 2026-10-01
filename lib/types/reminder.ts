// lib/types/reminder.ts
export interface ReminderSettings {
  user_id: string;
  enabled: boolean;
  max_reminders_per_day: number; // default 5
  interval_minutes: number;      // default 60
  active_start_time: string;     // "HH:MM" format, default "07:00"
  active_end_time: string;       // "HH:MM" format, default "21:00"
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
