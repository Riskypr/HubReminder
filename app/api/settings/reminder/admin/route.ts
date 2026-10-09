import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_SYSTEM_REMINDER_SETTINGS,
  getSystemReminderSettings,
  isReminderAdmin,
} from '@/lib/services/systemReminderSettingsService';

export const dynamic = 'force-dynamic';

const schema = z.object({
  reminder_mode: z.enum(['single', 'bulk']),
  start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  interval_seconds: z.number().int().refine((value) => [900, 1800, 3600, 5400, 7200, 10800, 14400].includes(value)),
  cookie_warning_count: z.number().int().min(1).max(20),
  cookie_warning_interval_minutes: z.number().int().min(15).max(1440),
  /** Batas pengiriman reminder laporan per hari (proteksi kuota Foonte). */
  max_reminders_per_day: z.number().int().min(1).max(50),
  reminder_together_enabled: z.boolean().default(true),
  wa_bot_enabled: z.boolean().default(true),
});

async function authorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (!isReminderAdmin(user.email)) return { response: NextResponse.json({ error: 'Akses admin diperlukan' }, { status: 403 }), user: null };
  return { response: null, user };
}

export async function GET() {
  const auth = await authorized();
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ settings: await getSystemReminderSettings(createAdminClient()) });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil pengaturan admin' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorized();
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pengaturan admin tidak valid' }, { status: 400 });
  const settings = { ...parsed.data, updated_at: new Date().toISOString() };
  const { error } = await createAdminClient().from('system_reminder_settings').upsert({ id: true, ...settings }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: 'Gagal menyimpan pengaturan admin' }, { status: 500 });
  return NextResponse.json({ success: true, settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorized();
  if (auth.response) return auth.response;
  const partialSchema = schema.partial();
  const parsed = partialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Pengaturan admin tidak valid' }, { status: 400 });
  }
  const current = await getSystemReminderSettings(createAdminClient()).catch(() => DEFAULT_SYSTEM_REMINDER_SETTINGS);
  const settings = { ...current, ...parsed.data, updated_at: new Date().toISOString() };
  const { error } = await createAdminClient().from('system_reminder_settings').upsert({ id: true, ...settings }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: 'Gagal memperbarui pengaturan admin' }, { status: 500 });
  return NextResponse.json({ success: true, settings });
}

