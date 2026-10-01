// app/api/account/connect/route.ts
// Simpan sesi MagangHub pengguna (terenkripsi)
// PENTING: Validasi cookie dulu ke MagangHub sebelum menyimpan.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveSession } from '@/lib/services/accountService';
import { fetchMagangHubProfile, checkAndUpdateAttendance } from '@/lib/services/maganghubService';
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

  const rawCookie = parsed.data.cookie;

  // 1. VALIDASI DULU: Uji cookie ke MagangHub API sebelum menyimpan
  const validationResult = await fetchMagangHubProfile(rawCookie);

  console.log('[connect] Validation result:', {
    ok: validationResult.ok,
    status: validationResult.status,
    isSessionExpired: validationResult.isSessionExpired,
    hasData: !!validationResult.data,
    error: validationResult.error,
  });

  if (validationResult.isSessionExpired) {
    return NextResponse.json({
      success: false,
      status: 'session_expired',
      error: 'Cookie yang dimasukkan sudah kedaluwarsa atau tidak valid. Pastikan kamu menyalin cookie dari sesi yang masih aktif di browser.',
    }, { status: 400 });
  }

  if (!validationResult.ok) {
    return NextResponse.json({
      success: false,
      status: 'invalid',
      error: validationResult.error || 'Cookie tidak dapat diverifikasi ke server MagangHub. Pastikan cookie yang dimasukkan benar.',
    }, { status: 400 });
  }

  // 2. Cookie valid — simpan ke database (terenkripsi)
  const { error } = await saveSession(user.id, rawCookie, supabase, 'valid');
  if (error) {
    return NextResponse.json({ error: 'Gagal menyimpan sesi' }, { status: 500 });
  }

  // 3. Update status sesi menjadi "valid" dan sinkronisasi profil + attendance
  const syncResult = await checkAndUpdateAttendance(user.id, rawCookie, supabase).catch((err) => {
    console.error('[connect] Sync after save error:', err);
    return null;
  });

  return NextResponse.json({
    success: true,
    status: syncResult?.status ?? 'valid',
    profile: syncResult?.profile ?? null,
    userName: validationResult.data?.name,
  });
}
