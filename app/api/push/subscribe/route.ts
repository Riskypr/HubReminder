// app/api/push/subscribe/route.ts
// Simpan push subscription browser ke database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveSubscription } from '@/lib/services/pushService';
import { z } from 'zod';

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data subscription tidak valid' }, { status: 400 });
  }

  const { error } = await saveSubscription(user.id, parsed.data);
  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan subscription' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
