// app/api/settings/reminder/route.ts
// Menyimpan atau memperbarui pengaturan reminder pengguna

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateReminderSettings } from '@/lib/services/reminderSettingsService';
import { z } from 'zod';

const bodySchema = z.object({
  enabled: z.boolean(),
  max_reminders_per_day: z.number().int().min(1).max(20),
  interval_minutes: z.number().int().min(15).max(480),
  active_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  active_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  snooze_until: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data pengaturan reminder tidak valid', details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { error } = await updateReminderSettings(user.id, parsed.data);
  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan reminder' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
