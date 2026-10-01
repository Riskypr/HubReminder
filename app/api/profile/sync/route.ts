// app/api/profile/sync/route.ts
// Backend Proxy: Sinkronisasi data profil langsung dari MagangHub

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDecryptedSessionCookie } from '@/lib/services/accountService';
import { syncUserProfileFromMagangHub } from '@/lib/services/maganghubService';

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

  const rawCookie = await getDecryptedSessionCookie(user.id, supabase);
  if (!rawCookie) {
    return NextResponse.json(
      { error: 'Akun MagangHub belum terhubung atau sesi telah kedaluwarsa' },
      { status: 400 }
    );
  }

  const syncResult = await syncUserProfileFromMagangHub(user.id, rawCookie, supabase);

  if (!syncResult.success) {
    return NextResponse.json(
      {
        error: syncResult.error || 'Gagal menyinkronkan profil dari MagangHub',
        isSessionExpired: syncResult.isSessionExpired,
      },
      { status: syncResult.isSessionExpired ? 401 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    profile: syncResult.profile,
    message: 'Profil berhasil diperbarui dari MagangHub',
  });
}
