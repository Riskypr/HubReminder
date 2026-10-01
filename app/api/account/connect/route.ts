// app/api/account/connect/route.ts
// Simpan sesi MagangHub pengguna (terenkripsi)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveSession } from '@/lib/services/accountService';
import { z } from 'zod';

const bodySchema = z.object({
  cookie: z.string().min(10),
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
    return NextResponse.json({ error: 'Cookie tidak valid' }, { status: 400 });
  }

  const { error } = await saveSession(user.id, parsed.data.cookie);
  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan sesi' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
