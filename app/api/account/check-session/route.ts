import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDecryptedSession } from '@/lib/services/accountService';
import { fetchMagangHubProfile, fetchMagangHubAttendance } from '@/lib/services/maganghubService';
import { getUserProfile } from '@/lib/services/profileService';
import { updateSessionTokens } from '@/lib/services/accountService';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionMaterial = await getDecryptedSession(user.id, supabase);
  if (!sessionMaterial) {
    return NextResponse.json({ connected: false, isValid: false, status: 'unverified', message: 'Akun MagangHub belum terhubung.' });
  }

  const [profileRes, attendanceRes] = await Promise.all([
    fetchMagangHubProfile(sessionMaterial, (accessToken, refreshToken) => updateSessionTokens(user.id, accessToken, refreshToken, supabase)),
    fetchMagangHubAttendance(sessionMaterial, (accessToken, refreshToken) => updateSessionTokens(user.id, accessToken, refreshToken, supabase)),
  ]);
  const now = new Date().toISOString();
  const valid = profileRes.ok || attendanceRes.ok;
  const expired = profileRes.isSessionExpired || attendanceRes.isSessionExpired;
  const status = expired ? 'expired' : valid ? 'valid' : 'unverified';

  if (status !== 'unverified') {
    await supabase.from('maganghub_sessions').update({
      status,
      ...(valid ? { last_verified_at: now } : {}),
      updated_at: now,
    }).eq('user_id', user.id);
  }

  if (profileRes.data) {
    const userData = profileRes.data;
    await supabase.from('profiles').update({
      full_name: userData.name || undefined,
      company_name: userData.internship_company || userData.company || undefined,
      photo_url: userData.photo_url || undefined,
      internship_period: userData.internship_start_date && userData.internship_end_date
        ? `${userData.internship_start_date} – ${userData.internship_end_date}`
        : undefined,
      participant_status: userData.participant_status?.reason || undefined,
      maganghub_synced_at: now,
    }).eq('id', user.id);
  }

  const profile = await getUserProfile(user.id, supabase);
  return NextResponse.json({
    connected: true,
    isValid: valid && !expired,
    status,
    checkedAt: now,
    profile,
    message: valid ? `Sesi aktif${profile?.full_name ? ` untuk ${profile.full_name}` : ''}.` : expired ? 'Sesi MagangHub telah kedaluwarsa.' : 'Sesi belum dapat diverifikasi karena server MagangHub tidak merespons.',
  });
}
