import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { saveSession } from '@/lib/services/accountService';
import {
  checkAndUpdateAttendance,
  fetchMagangHubProfile,
  loginToMagangHub,
  parseMagangHubCookieInput,
  type MagangHubAuthTokens,
} from '@/lib/services/maganghubService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});
const cookieSchema = z.string().trim().min(1).max(16_384);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Silakan masuk ke HubReminder terlebih dahulu.' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  let tokens: MagangHubAuthTokens | undefined;

  if (body && typeof body === 'object' && 'mode' in body && body.mode === 'cookie') {
    const parsedCookie = cookieSchema.safeParse('cookie' in body ? body.cookie : null);
    if (!parsedCookie.success) {
      return NextResponse.json({ error: 'Tempel cookie akses MagangHub yang valid.' }, { status: 400 });
    }
    tokens = parseMagangHubCookieInput(parsedCookie.data) ?? undefined;
    if (!tokens) {
      return NextResponse.json({
        error: 'Cookie tidak berisi access token MagangHub yang dikenali. Gunakan monev-access-token, monev_access_token, atau access_token.',
      }, { status: 400 });
    }
  } else {
    const parsedCredentials = credentialsSchema.safeParse(body);
    if (!parsedCredentials.success) {
      return NextResponse.json({ error: 'Email dan kata sandi MagangHub wajib diisi.' }, { status: 400 });
    }
    const auth = await loginToMagangHub(parsedCredentials.data.email, parsedCredentials.data.password);
    if (!auth.tokens) return NextResponse.json({ error: auth.error || 'Login MagangHub gagal.' }, { status: 502 });
    tokens = auth.tokens;
  }

  if (!tokens) return NextResponse.json({ error: 'Sesi MagangHub tidak dapat dibaca.' }, { status: 400 });

  const sessionMaterial = JSON.stringify(tokens);
  const profile = await fetchMagangHubProfile(sessionMaterial);
  if (!profile.ok || !profile.data) {
    if (profile.status === 401) {
      return NextResponse.json({ error: 'Cookie MagangHub tidak valid atau sudah kedaluwarsa. Ambil cookie sesi baru lalu coba lagi.' }, { status: 401 });
    }
    if (profile.status === 403) {
      return NextResponse.json({ error: 'API MagangHub menolak verifikasi cookie (HTTP 403). Pastikan cookie berasal dari sesi Monev yang aktif.' }, { status: 502 });
    }
    return NextResponse.json({ error: profile.error || 'Login berhasil, tetapi sesi belum dapat diverifikasi.' }, { status: 502 });
  }

  const saved = await saveSession(user.id, tokens.accessToken, tokens.refreshToken, supabase, 'valid');
  if (saved.error) return NextResponse.json({ error: 'Sesi berhasil diverifikasi tetapi gagal disimpan.' }, { status: 500 });

  const attendance = await checkAndUpdateAttendance(user.id, sessionMaterial, supabase).catch((error) => {
    console.error('[maganghub/login] attendance sync failed:', error);
    return null;
  });

  return NextResponse.json({
    success: true,
    profile: attendance?.profile ?? null,
    userName: profile.data.name ?? null,
  });
}
