// supabase/functions/check-attendance/fetcher.ts
// Mengambil status dan profil dari MagangHub API dengan fallback ke HTML dashboard
// PENTING: Wajib menyertakan timeout & error handling agar tidak menggantung

const MAGANGHUB_API_BASE = 'https://monev-api.maganghub.kemnaker.go.id/api/v1';
const MAGANGHUB_DASHBOARD_URL = 'https://monev.maganghub.kemnaker.go.id/dashboard';
const MAGANGHUB_BUILD_ID = 'fdce5864ab936c3205233ffc340ba593c0136cd2-production';
const TIMEOUT_MS = 12000;

export interface FetchDashboardResult {
  ok: boolean;
  html?: string;
  apiData?: {
    home?: {
      has_attendance?: boolean;
      is_scheduled_off_day?: boolean;
      is_holiday?: boolean;
      date?: string;
    };
    user?: {
      name?: string;
      internship_company?: string;
      company?: string;
      photo_url?: string;
      internship_start_date?: string;
      internship_end_date?: string;
      participant_status?: {
        reason?: string;
      };
    };
  };
  isLoginRedirect?: boolean;
  error?: string;
  refreshedAccessToken?: string;
  refreshedRefreshToken?: string | null;
}

export async function fetchDashboard(cookiePlaintext: string, refreshToken: string | null = null): Promise<FetchDashboardResult> {
  const cleanStr = cookiePlaintext.trim();
  let bearerToken: string | null = null;

  // 1. Ekstrak JWT (format eyJ...) di mana pun posisinya dalam string
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
      const parts = cleanStr.split(';').map((s) => s.trim()).filter(Boolean);
      if (!parts.some((p) => p.startsWith('monev-access-token='))) {
        parts.push(`monev-access-token=${bearerToken}`);
      }
      cookieHeader = parts.join('; ');
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let refreshedAccessToken: string | undefined;
  let refreshedRefreshToken: string | null | undefined;

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://monev.maganghub.kemnaker.go.id',
      'Referer': 'https://monev.maganghub.kemnaker.go.id/dashboard',
      'X-Frontend-Build-ID': MAGANGHUB_BUILD_ID,
      'Cookie': cookieHeader,
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    // 1. Coba fetch API endpoint /users/me/home
    let homeRes = await fetch(`${MAGANGHUB_API_BASE}/users/me/home`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    // Jika 401, coba auth refresh
    if (homeRes.status === 401) {
      try {
        const refreshRes = await fetch(`${MAGANGHUB_API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: {
            'User-Agent': headers['User-Agent'],
            'Accept': 'application/json, text/plain, */*',
            'Cookie': refreshToken ? `${cookieHeader}; refresh_token=${refreshToken}` : cookieHeader,
            'X-Frontend-Build-ID': MAGANGHUB_BUILD_ID,
          },
          signal: controller.signal,
        });

        if (refreshRes.ok) {
          const refreshJson = await refreshRes.json().catch(() => null);
          if (refreshJson?.access_token) {
            refreshedAccessToken = refreshJson.access_token;
            if ('refresh_token' in refreshJson) refreshedRefreshToken = refreshJson.refresh_token ?? null;
            headers['Authorization'] = `Bearer ${refreshJson.access_token}`;
            homeRes = await fetch(`${MAGANGHUB_API_BASE}/users/me/home`, {
              method: 'GET',
              headers,
              signal: controller.signal,
            });
          }
        }
      } catch {
        // Abaikan refresh error
      }
    }

    if (homeRes.status === 401 || homeRes.status === 403) {
      clearTimeout(timeoutId);
      return { ok: false, isLoginRedirect: true };
    }

    if (homeRes.ok) {
      const homeJson = await homeRes.json().catch(() => null);
      const homeData = homeJson?.data ?? homeJson;

      // Juga ambil data profil jika memungkinkan
      let userData = undefined;
      try {
        const userRes = await fetch(`${MAGANGHUB_API_BASE}/users/me`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (userRes.ok) {
          const userJson = await userRes.json().catch(() => null);
          userData = userJson?.data ?? userJson;
        }
      } catch {
        // Profil gagal, tapi status home sukses
      }

      clearTimeout(timeoutId);
      return {
        ok: true,
        apiData: {
          home: homeData,
          user: userData,
        },
        refreshedAccessToken,
        refreshedRefreshToken,
      };
    }

    // 2. Fallback: jika API endpoint tidak mengembalikan 200, fetch HTML dashboard
    const htmlResponse = await fetch(MAGANGHUB_DASHBOARD_URL, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': headers['User-Agent'],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (
      htmlResponse.url.includes('/login') ||
      htmlResponse.url.includes('/auth') ||
      htmlResponse.status === 401 ||
      htmlResponse.status === 403
    ) {
      return { ok: false, isLoginRedirect: true };
    }

    const html = await htmlResponse.text();
    return { ok: true, html, refreshedAccessToken, refreshedRefreshToken };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    return {
      ok: false,
      error: error.name === 'AbortError' ? 'Timeout saat mengakses MagangHub (12s)' : error.message,
    };
  }
}
