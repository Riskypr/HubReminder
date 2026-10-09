import type { SupabaseClient } from '@supabase/supabase-js';

export interface SystemReminderSettings {
  reminder_mode: 'single' | 'bulk';
  start_time: string;
  interval_seconds: number;
  cookie_warning_count: number;
  cookie_warning_interval_minutes: number;
  /** Batas total reminder (laporan) yang boleh dikirim admin per hari ke grup WA. Proteksi kuota Foonte. */
  max_reminders_per_day: number;
  /** Status pengaktifan pengiriman reminder bersama (bulk / grup) */
  reminder_together_enabled: boolean;
  /** Status pengaktifan layanan Bot WhatsApp (pengiriman pesan & auto-laporan) */
  wa_bot_enabled: boolean;
  updated_at?: string | null;
}

export const DEFAULT_SYSTEM_REMINDER_SETTINGS: SystemReminderSettings = {
  reminder_mode: 'bulk',
  start_time: '08:00',
  interval_seconds: 7200,
  cookie_warning_count: 3,
  cookie_warning_interval_minutes: 60,
  max_reminders_per_day: 10,
  reminder_together_enabled: true,
  wa_bot_enabled: true,
  updated_at: null,
};

export function isReminderAdmin(email?: string | null) {
  const allowed = (process.env.REMINDER_ADMIN_EMAILS ?? '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}

export async function getSystemReminderSettings(client: SupabaseClient): Promise<SystemReminderSettings> {
  const { data, error } = await client.from('system_reminder_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw new Error(`Gagal mengambil pengaturan sistem reminder: ${error.message}`);
  if (!data) return DEFAULT_SYSTEM_REMINDER_SETTINGS;
  return {
    ...DEFAULT_SYSTEM_REMINDER_SETTINGS,
    ...data,
    reminder_together_enabled: typeof data.reminder_together_enabled === 'boolean'
      ? data.reminder_together_enabled
      : DEFAULT_SYSTEM_REMINDER_SETTINGS.reminder_together_enabled,
    wa_bot_enabled: typeof data.wa_bot_enabled === 'boolean'
      ? data.wa_bot_enabled
      : DEFAULT_SYSTEM_REMINDER_SETTINGS.wa_bot_enabled,
  };
}
