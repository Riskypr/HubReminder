import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { saveSession } from '@/lib/services/accountService';
import { checkAndUpdateAttendance, fetchMagangHubProfile, loginToMagangHub } from '@/lib/services/maganghubService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// MagangHub login follows an external SSO flow and then verifies the profile.
// Allow enough time for those sequential network requests on Vercel.
export const maxDuration = 60;

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Silakan masuk ke HubReminder terlebih dahulu.' }, { status: 401 });

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Email dan kata sandi MagangHub wajib diisi.' }, { status: 400 });

  const auth = await loginToMagangHub(parsed.data.email, parsed.data.password);
  if (!auth.tokens) return NextResponse.json({ error: auth.error || 'Login MagangHub gagal.' }, { status: 502 });

  const profile = await fetchMagangHubProfile(auth.tokens.accessToken);
  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: profile.error || 'Login berhasil, tetapi sesi belum dapat diverifikasi.' }, { status: 502 });
  }

  const saved = await saveSession(user.id, auth.tokens.accessToken, auth.tokens.refreshToken, supabase, 'valid');
  if (saved.error) return NextResponse.json({ error: 'Sesi berhasil diverifikasi tetapi gagal disimpan.' }, { status: 500 });

  const attendance = await checkAndUpdateAttendance(user.id, auth.tokens.accessToken, supabase).catch((error) => {
    console.error('[maganghub/login] attendance sync failed:', error);
    return null;
  });

  return NextResponse.json({
    success: true,
    profile: attendance?.profile ?? null,
    userName: profile.data.name ?? null,
  });
}
