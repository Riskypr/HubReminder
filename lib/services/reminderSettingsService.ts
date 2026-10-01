// lib/services/reminderSettingsService.ts

import { createClient } from '@/lib/supabase/server';
import type { ReminderSettings } from '@/lib/types/reminder';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_SETTINGS: Omit<ReminderSettings, 'user_id' | 'updated_at'> = {
  enabled: true,
  max_reminders_per_day: 5,
  interval_minutes: 60,
  active_start_time: '07:00',
  active_end_time: '21:00',
  snooze_until: null,
};

/**
 * Ambil pengaturan reminder pengguna.
 * Bila belum ada, kembalikan default.
 */
export async function getReminderSettings(
  userId: string,
  client?: SupabaseServerClient
): Promise<ReminderSettings> {
  const supabase = client ?? (await createClient());

  const { data } = await supabase
    .from('reminder_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return {
      ...DEFAULT_SETTINGS,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
  }
  return data as ReminderSettings;
}

/**
 * Simpan (upsert) pengaturan reminder pengguna.
 */
export async function updateReminderSettings(
  userId: string,
  settings: Partial<Omit<ReminderSettings, 'user_id' | 'updated_at'>>,
  client?: SupabaseServerClient
): Promise<{ error: string | null }> {
  const supabase = client ?? (await createClient());

  const { error } = await supabase
    .from('reminder_settings')
    .upsert(
      {
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) return { error: error.message };
  return { error: null };
}
