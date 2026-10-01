// app/api/profile/route.ts
// Mengambil profil pengguna (termasuk data MagangHub yang telah disinkronkan)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/services/profileService';
import { getDecryptedSessionCookie } from '@/lib/services/accountService';
import { syncUserProfileFromMagangHub } from '@/lib/services/maganghubService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let profile = await getUserProfile(user.id, supabase);

  // Jika profile belum pernah disinkronkan dari MagangHub, cek apakah ada sesi aktif untuk auto-sync
  if (!profile?.maganghub_synced_at) {
    const rawCookie = await getDecryptedSessionCookie(user.id, supabase);
    if (rawCookie) {
      const syncRes = await syncUserProfileFromMagangHub(user.id, rawCookie, supabase).catch(() => null);
      if (syncRes?.success && syncRes.profile) {
        profile = syncRes.profile;
      }
    }
  }

  return NextResponse.json({ profile });
}
