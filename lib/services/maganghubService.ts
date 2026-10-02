// lib/services/maganghubService.ts
// Backend Proxy Service untuk berkomunikasi dengan MagangHub Kemnaker API & Dashboard.
// PENTING: Kredensial & cookie sesi hanya diproses di server, tidak pernah diteruskan ke client.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseApiResponse, parseStatus, type MagangHubHomeApiData } from '@/lib/attendance/parser';
import type { AttendanceStatus } from '@/lib/types/attendance';
import type { Profile } from '@/lib/types/session';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MAGANGHUB_API_BASE = 'https://monev-api.maganghub.kemnaker.go.id/api/v1';
const MAGANGHUB_FRONTEND_BUILD_ID = 'fdce5864ab936c3205233ffc340ba593c0136cd2-production';
const TIMEOUT_MS = 12000;

export interface MagangHubUserData {
  id?: number | string;
  name?: string;
  email?: string;
  photo_url?: string;
  internship_company?: string;
  company?: string;
  internship_start_date?: string;
  internship_end_date?: string;
  user_type?: string;
  participant_status?: {
    reason?: string;
    active_internship?: boolean;
    effective_at?: string;
  };
}

/**
 * Ekstrak token JWT dan buat header cookie yang bersih & kompatibel dengan MagangHub.
 */
export function extractAuthInfo(cookieStr: string): {
  cookieHeader: string;
  bearerToken: string | null;
} {
  const cleanStr = cookieStr.trim();
  let bearerToken: string | null = null;

  // 1. Ekstrak JWT (format eyJ...) di mana pun posisinya dalam string
  // Mencakup: raw JWT, 'Bearer eyJ...', 'monev-access-token=eyJ...', 'access_token=eyJ...', JSON token, dsb.
  const jwtMatch = cleanStr.match(/eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/);
  if (jwtMatch) {
    bearerToken = jwtMatch[0];
  } else {
    // 2. Fallback: Cek apakah ada cookie `access_token=...`, `token=...`, atau `session=...`
    const accessMatch = cleanStr.match(/(?:monev-access-token|monev_access_token|access_token|token|session|jwt)=([^;]+)/i);
    if (accessMatch && accessMatch[1]) {
      bearerToken = accessMatch[1].trim();
    }
  }

  // 3. Format cookieHeader agar MagangHub mengenali token sesi
  let cookieHeader = cleanStr;
  if (bearerToken) {
    if (!cleanStr.includes('=')) {
      cookieHeader = `monev-access-token=${bearerToken}; access_token=${bearerToken}`;
    } else {
      // Pastikan monev-access-token ada di header karena dipakai Nuxt MagangHub
      const parts = cleanStr.split(';').map((s) => s.trim()).filter(Boolean);
      if (!parts.some((p) => p.startsWith('monev-access-token='))) {
        parts.push(`monev-access-token=${bearerToken}`);
      }
      cookieHeader = parts.join('; ');
    }
  }

  return { cookieHeader, bearerToken };
}

/**
 * Melakukan HTTP request ke MagangHub API dengan mekanisme retry dan refresh token.
 */
async function fetchMagangHubApi<T>(
  path: string,
  cookiePlaintext: string,
  initOptions: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; isSessionExpired?: boolean; error?: string }> {
  const { cookieHeader, bearerToken } = extractAuthInfo(cookiePlaintext);

  let currentToken = bearerToken;
  const url = `${MAGANGHUB_API_BASE}${path}`;

  const makeHeaders = (token: string | null) => ({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://monev.maganghub.kemnaker.go.id',
    'Referer': 'https://monev.maganghub.kemnaker.go.id/dashboard',
    'X-Frontend-Build-ID': MAGANGHUB_FRONTEND_BUILD_ID,
    'Cookie': cookieHeader,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(initOptions.headers || {}),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[maganghub] Fetching: ${url}`);
    let response = await fetch(url, {
      ...initOptions,
      headers: makeHeaders(currentToken),
      signal: controller.signal,
    });

    console.log(`[maganghub] Initial response: ${response.status} ${response.statusText}`);

    // Jika 401 dan kita punya cookie, coba lakukan POST /auth/refresh
    if (response.status === 401) {
      console.log('[maganghub] Got 401, attempting auth/refresh...');
      try {
        const refreshRes = await fetch(`${MAGANGHUB_API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Cookie': cookieHeader,
            'X-Frontend-Build-ID': MAGANGHUB_FRONTEND_BUILD_ID,
          },
          signal: controller.signal,
        });

        console.log(`[maganghub] Refresh response: ${refreshRes.status}`);

        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json().catch(() => null);
          console.log('[maganghub] Refresh result:', {
            hasAccessToken: !!refreshJson?.access_token,
            tokenPrefix: refreshJson?.access_token?.substring(0, 20),
          });
          if (refreshJson?.access_token) {
            currentToken = refreshJson.access_token;
            // Retry request asli dengan access token baru
            response = await fetch(url, {
              ...initOptions,
              headers: makeHeaders(currentToken),
              signal: controller.signal,
            });
            console.log(`[maganghub] Retry response after refresh: ${response.status}`);
          }
        } else {
          const refreshBody = await refreshRes.text().catch(() => '');
          console.log('[maganghub] Refresh FAILED:', refreshRes.status, refreshBody.substring(0, 200));
        }
      } catch (refreshErr) {
        console.error('[maganghub] Refresh exception:', refreshErr);
      }
    }

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      console.log(`[maganghub] Session expired (final status: ${response.status})`);
      return { ok: false, status: response.status, isSessionExpired: true, error: 'Sesi MagangHub kedaluwarsa' };
    }

    if (!response.ok) {
      console.log(`[maganghub] Non-OK response: ${response.status}`);
      return { ok: false, status: response.status, error: `MagangHub API merespon status ${response.status}` };
    }

    const json = await response.json();
    console.log(`[maganghub] Success! Data keys:`, Object.keys(json.data ?? json));
    return { ok: true, status: response.status, data: (json.data ?? json) as T };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    console.error(`[maganghub] Fetch exception:`, error.message);
    return {
      ok: false,
      status: 0,
      error: error.name === 'AbortError' ? 'Timeout saat mengakses MagangHub' : error.message,
    };
  }
}

/**
 * Fetch profil pengguna dari MagangHub (`/users/me`).
 */
export async function fetchMagangHubProfile(cookiePlaintext: string) {
  return fetchMagangHubApi<MagangHubUserData>('/users/me', cookiePlaintext, {
    method: 'GET',
  });
}

/**
 * Fetch status absensi / laporan hari ini dari MagangHub (`/users/me/home`).
 */
export async function fetchMagangHubAttendance(cookiePlaintext: string) {
  return fetchMagangHubApi<MagangHubHomeApiData>('/users/me/home', cookiePlaintext, {
    method: 'GET',
  });
}

/**
 * Sinkronisasi data profil pengguna ke database Supabase.
 */
export async function syncUserProfileFromMagangHub(
  userId: string,
  cookiePlaintext: string,
  client?: SupabaseServerClient
): Promise<{ success: boolean; profile?: Profile; error?: string; isSessionExpired?: boolean }> {
  const supabase = client ?? (await createClient());

  const profileRes = await fetchMagangHubProfile(cookiePlaintext);

  if (profileRes.isSessionExpired) {
    await supabase
      .from('maganghub_sessions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return { success: false, isSessionExpired: true, error: 'Sesi MagangHub kedaluwarsa' };
  }

  if (!profileRes.ok || !profileRes.data) {
    return { success: false, error: profileRes.error || 'Gagal memuat profil MagangHub' };
  }

  const u = profileRes.data;
  const companyName = u.internship_company || u.company || null;
  const period =
    u.internship_start_date && u.internship_end_date
      ? `${u.internship_start_date} – ${u.internship_end_date}`
      : null;
  const participantStatus = u.participant_status?.reason || (u.participant_status?.active_internship ? 'ACTIVE' : null);

  const updatePayload = {
    full_name: u.name || null,
    company_name: companyName,
    photo_url: u.photo_url || null,
    internship_period: period,
    participant_status: participantStatus,
    maganghub_synced_at: new Date().toISOString(),
  };

  const { data: updatedProfile, error: dbError } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (dbError) {
    return { success: false, error: dbError.message };
  }

  return { success: true, profile: updatedProfile as Profile };
}

/**
 * Pengecekan status laporan hari ini via Backend Proxy & update riwayat.
 */
export async function checkAndUpdateAttendance(
  userId: string,
  cookiePlaintext: string,
  client?: SupabaseServerClient
): Promise<{
  success: boolean;
  status: AttendanceStatus;
  detectedVia: string;
  checkedAt: string;
  profile?: Profile | null;
  error?: string;
}> {
  const supabase = client ?? (await createClient());
  const nowIso = new Date().toISOString();

  // Jalankan pengecekan status dan sinkronisasi profil secara paralel
  const [attendanceRes, profileSyncRes] = await Promise.all([
    fetchMagangHubAttendance(cookiePlaintext),
    syncUserProfileFromMagangHub(userId, cookiePlaintext, supabase).catch(() => null),
  ]);

  console.log('[checkAndUpdateAttendance] attendance response:', {
    ok: attendanceRes.ok,
    status: attendanceRes.status,
    isSessionExpired: attendanceRes.isSessionExpired,
    dataKeys: attendanceRes.data ? Object.keys(attendanceRes.data) : null,
  });

  let finalStatus: AttendanceStatus = 'unknown';
  let finalVia = 'api_check';

  if (attendanceRes.isSessionExpired) {
    // Pastikan bukan false-expired jika profil justru berhasil disinkronkan
    if (profileSyncRes?.success && profileSyncRes.profile) {
      finalStatus = 'belum_lapor';
      finalVia = 'profile_ok_attendance_unrecorded';
    } else {
      finalStatus = 'session_expired';
      finalVia = 'session_expired_401';
    }
  } else if (attendanceRes.ok && attendanceRes.data) {
    const parsed = parseApiResponse(attendanceRes.data);
    finalStatus = parsed.status;
    finalVia = parsed.detectedVia;

    // Jika parseApiResponse belum dapat menyimpulkan (unknown), coba periksa endpoint /attendances
    if (finalStatus === 'unknown') {
      try {
        const attendancesRes = await fetchMagangHubApi<any>('/attendances', cookiePlaintext);
        if (attendancesRes.ok && attendancesRes.data) {
          const list = Array.isArray(attendancesRes.data)
            ? attendancesRes.data
            : (attendancesRes.data as any).data;
          if (Array.isArray(list)) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const foundToday = list.some(
              (item: any) =>
                item?.date?.slice(0, 10) === todayStr ||
                item?.attendance_date?.slice(0, 10) === todayStr
            );
            if (foundToday) {
              finalStatus = 'selesai';
              finalVia = 'api:attendances_list_found_today';
            } else {
              finalStatus = 'belum_lapor';
              finalVia = 'api:attendances_list_empty_today';
            }
          }
        }
      } catch (attErr) {
        console.warn('[maganghub] Fallback /attendances exception:', attErr);
      }
    }
  } else {
    // Fallback: jika API endpoint /users/me/home gagal, coba fetch HTML dashboard
    try {
      const { cookieHeader, bearerToken } = extractAuthInfo(cookiePlaintext);
      const dashboardUrl = 'https://monev.maganghub.kemnaker.go.id/dashboard';
      const htmlRes = await fetch(dashboardUrl, {
        headers: {
          'Cookie': cookieHeader,
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (htmlRes.url.includes('/login') || htmlRes.status === 401 || htmlRes.status === 403) {
        finalStatus = 'session_expired';
        finalVia = 'dashboard_login_redirect';
      } else if (htmlRes.ok) {
        const html = await htmlRes.text();
        const htmlParsed = parseStatus(html);
        finalStatus = htmlParsed.status;
        finalVia = `html_fallback:${htmlParsed.detectedVia}`;
      }
    } catch {
      finalStatus = 'unknown';
      finalVia = attendanceRes.error || 'fetch_failed';
    }
  }

  // RLS hanya mengizinkan service_role menulis ke attendance_checks.
  // Gunakan admin client khusus untuk insert ini; client sesi user akan ditolak.
  const { error: attendanceCheckError } = await createAdminClient()
    .from('attendance_checks')
    .insert({
      user_id: userId,
      status: finalStatus,
      detected_via: finalVia,
      checked_at: nowIso,
    });
  if (attendanceCheckError) {
    console.error('[maganghub] Gagal menyimpan attendance check:', attendanceCheckError.message);
    throw new Error('Gagal menyimpan hasil pengecekan absensi');
  }

  // 2. Perbarui status sesi di maganghub_sessions
  if (finalStatus === 'session_expired') {
    await supabase
      .from('maganghub_sessions')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('user_id', userId);
  } else if (finalStatus !== 'unknown') {
    await supabase
      .from('maganghub_sessions')
      .update({
        status: 'valid',
        last_verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', userId);
  }

  return {
    success: true,
    status: finalStatus,
    detectedVia: finalVia,
    checkedAt: nowIso,
    profile: profileSyncRes?.profile ?? null,
  };
}
