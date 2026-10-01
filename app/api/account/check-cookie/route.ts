// app/api/account/check-cookie/route.ts
// Backend Proxy: Memeriksa apakah cookie sesi yang tersimpan masih valid atau sudah kedaluwarsa

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDecryptedSessionCookie } from '@/lib/services/accountService';
import { fetchMagangHubProfile, fetchMagangHubAttendance } from '@/lib/services/maganghubService';
import { getUserProfile } from '@/lib/services/profileService';

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
    return NextResponse.json({
      connected: false,
      isValid: false,
      status: 'unverified',
      message: 'Akun MagangHub belum terhubung atau cookie belum dimasukkan.',
    });
  }

  console.log('[check-cookie] Decrypted cookie info:', {
    length: rawCookie.length,
    prefix: rawCookie.substring(0, 30) + '...',
    startsWithEyJ: rawCookie.startsWith('eyJ'),
    hasEquals: rawCookie.includes('='),
  });

  // Uji koneksi live ke MagangHub API
  const [profileRes, attendanceRes] = await Promise.all([
    fetchMagangHubProfile(rawCookie),
    fetchMagangHubAttendance(rawCookie),
  ]);

  const isExpired = profileRes.isSessionExpired || attendanceRes.isSessionExpired;
  const isOk = profileRes.ok || attendanceRes.ok;

  const nowIso = new Date().toISOString();

  if (isExpired || (!isOk && (profileRes.status === 401 || attendanceRes.status === 401))) {
    // Update status sesi menjadi expired di database
    await supabase
      .from('maganghub_sessions')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('user_id', user.id);

    return NextResponse.json({
      connected: true,
      isValid: false,
      status: 'expired',
      checkedAt: nowIso,
      message: 'Sesi MagangHub telah kedaluwarsa. Silakan masukkan cookie baru.',
    });
  }

  if (isOk) {
    // Sesi valid! Update status di database
    await supabase
      .from('maganghub_sessions')
      .update({
        status: 'valid',
        last_verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', user.id);

    // Update profil jika data tersedia
    if (profileRes.data) {
      const u = profileRes.data;
      await supabase
        .from('profiles')
        .update({
          full_name: u.name || undefined,
          company_name: u.internship_company || u.company || undefined,
          photo_url: u.photo_url || undefined,
          internship_period:
            u.internship_start_date && u.internship_end_date
              ? `${u.internship_start_date} – ${u.internship_end_date}`
              : undefined,
          participant_status: u.participant_status?.reason || undefined,
          maganghub_synced_at: nowIso,
        })
        .eq('id', user.id);
    }

    const currentProfile = await getUserProfile(user.id, supabase);

    return NextResponse.json({
      connected: true,
      isValid: true,
      status: 'valid',
      checkedAt: nowIso,
      profile: currentProfile,
      message: `Cookie masih aktif dan valid! Terhubung sebagai ${
        currentProfile?.full_name || 'Peserta'
      }.`,
    });
  }

  // Jika respon tidak jelas (mis. network timeout), jangan langsung klaim expired tapi beri info
  return NextResponse.json({
    connected: true,
    isValid: true,
    status: 'unverified',
    checkedAt: nowIso,
    message: 'Server MagangHub sedang lambat merespon, namun sesi belum terkonfirmasi kedaluwarsa.',
  });
}
