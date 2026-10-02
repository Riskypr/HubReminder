// app/api/attendance/check/route.ts
// Backend Proxy: Mengecek status laporan MagangHub terkini secara on-demand & sinkronisasi data

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDecryptedSession } from '@/lib/services/accountService';
import { checkAndUpdateAttendance } from '@/lib/services/maganghubService';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionMaterial = await getDecryptedSession(user.id, supabase);
  if (!sessionMaterial) {
    return NextResponse.json(
      { error: 'Akun MagangHub belum terhubung atau sesi telah kedaluwarsa' },
      { status: 400 }
    );
  }

  const checkResult = await checkAndUpdateAttendance(user.id, sessionMaterial, supabase);

  return NextResponse.json({
    success: true,
    status: checkResult.status,
    detectedVia: checkResult.detectedVia,
    checkedAt: checkResult.checkedAt,
    profile: checkResult.profile,
  });
}

export async function GET() {
  return POST();
}
