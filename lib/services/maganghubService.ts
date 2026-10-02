// lib/services/maganghubService.ts
// Backend Proxy Service untuk berkomunikasi dengan MagangHub Kemnaker API & Dashboard.
// PENTING: Kredensial dan token sesi hanya diproses di server, tidak pernah diteruskan ke client.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseApiResponse, parseStatus, type MagangHubHomeApiData } from '@/lib/attendance/parser';
import type { AttendanceStatus } from '@/lib/types/attendance';
import type { Profile } from '@/lib/types/session';
import { updateSessionTokens } from '@/lib/services/accountService';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MAGANGHUB_API_BASE = 'https://monev-api.maganghub.kemnaker.go.id/api/v1';
const MAGANGHUB_FRONTEND_BUILD_ID = 'fdce5864ab936c3205233ffc340ba593c0136cd2-production';
const TIMEOUT_MS = 12000;
const LOGIN_TIMEOUT_MS = 30000;
// SIAPKerja menempatkan WAF di depan halaman autentikasi. Gunakan header yang
// konsisten pada request halaman dan request XHR agar cookie challenge yang
// diterbitkan pada langkah pertama tetap berlaku pada langkah berikutnya.
const SIAPKERJA_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const SIAPKERJA_ACCEPT_LANGUAGE = 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7';

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

export interface MagangHubAuthTokens {
  accessToken: string;
  refreshToken: string | null;
}

type SessionCookie = { name: string; value: string; domain: string; path: string };

function isOfficialKemnakerUrl(url: URL): boolean {
  return url.protocol === 'https:' &&
    (url.hostname === 'kemnaker.go.id' || url.hostname.endsWith('.kemnaker.go.id'));
}

export function splitSetCookieHeader(header: string): string[] {
  const cookies: string[] = [];
  let start = 0;
  let inExpiresAttribute = false;

  for (let index = 0; index < header.length; index += 1) {
    if (header.slice(index, index + 8).toLowerCase() === 'expires=') {
      inExpiresAttribute = true;
      index += 7;
      continue;
    }
    if (header[index] === ';' && inExpiresAttribute) {
      inExpiresAttribute = false;
      continue;
    }
    if (header[index] === ',' && !inExpiresAttribute && /^\s*[^=;,\s]+=/u.test(header.slice(index + 1))) {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }

  const finalCookie = header.slice(start).trim();
  if (finalCookie) cookies.push(finalCookie);
  return cookies;
}

function getSetCookies(response: Response): string[] {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const setCookie = response.headers.get('set-cookie');
  // `Headers.get()` pada beberapa runtime Node menggabungkan banyak Set-Cookie
  // menjadi satu string. Pecah hanya pada awal cookie baru; tanggal `Expires`
  // mengandung koma dan tidak boleh dipisahkan.
  return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function addResponseCookies(jar: SessionCookie[], response: Response, responseUrl: URL): void {
  for (const header of getSetCookies(response)) {
    const [first, ...attributes] = header.split(';').map((value) => value.trim());
    const separator = first.indexOf('=');
    if (separator <= 0) continue;
    const name = first.slice(0, separator);
    const value = first.slice(separator + 1);
    const domainAttribute = attributes.find((attribute) => attribute.toLowerCase().startsWith('domain='));
    const pathAttribute = attributes.find((attribute) => attribute.toLowerCase().startsWith('path='));
    const domain = (domainAttribute?.slice('domain='.length) || responseUrl.hostname).replace(/^\./, '').toLowerCase();
    const path = pathAttribute?.slice('path='.length) || '/';
    const existingIndex = jar.findIndex((cookie) => cookie.name === name && cookie.domain === domain && cookie.path === path);
    const cookie = { name, value, domain, path };
    if (existingIndex >= 0) jar[existingIndex] = cookie;
    else jar.push(cookie);
  }
}

function cookieHeaderForUrl(jar: SessionCookie[], url: URL): string {
  return jar
    .filter((cookie) => (url.hostname === cookie.domain || url.hostname.endsWith(`.${cookie.domain}`)) && url.pathname.startsWith(cookie.path))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function getCsrfToken(html: string): string | null {
  return html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
}

function tokenFromCookies(cookies: SessionCookie[]): MagangHubAuthTokens | null {
  const accessToken = cookies.find((cookie) => /^(?:monev-access-token|access_token)$/i.test(cookie.name))?.value;
  const refreshToken = cookies.find((cookie) => /^(?:monev-refresh-token|refresh_token)$/i.test(cookie.name))?.value ?? null;
  return accessToken ? { accessToken, refreshToken } : null;
}

function describeLoginConnectionError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Login SIAPKerja melewati batas waktu. Coba lagi beberapa saat.';
  }
  const cause = error instanceof Error ? error.cause as { code?: unknown } | undefined : undefined;
  switch (cause?.code) {
    case 'ENOTFOUND':
      return 'Domain server SIAPKerja tidak dapat ditemukan.';
    case 'ECONNREFUSED':
      return 'Server SIAPKerja menolak koneksi.';
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'ETIMEDOUT':
      return 'Koneksi ke server SIAPKerja melewati batas waktu.';
    case 'ECONNRESET':
      return 'Koneksi ke server SIAPKerja terputus. Coba lagi beberapa saat.';
    default:
      return 'Tidak dapat menyelesaikan koneksi ke server SIAPKerja. Coba lagi beberapa saat.';
  }
}

function resolveMagangHubLoginUrl(configuredPath: string): URL {
  const target = /^https?:\/\//i.test(configuredPath)
    ? new URL(configuredPath)
    : new URL(configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`, MAGANGHUB_API_BASE);

  if (target.protocol !== 'https:' ||
    !(target.hostname === 'kemnaker.go.id' || target.hostname.endsWith('.kemnaker.go.id'))) {
    throw new Error('MAGANGHUB_LOGIN_PATH harus mengarah ke HTTPS pada domain resmi *.kemnaker.go.id.');
  }
  return target;
}

async function followSsoRedirect(
  startUrl: URL,
  cookieJar: SessionCookie[],
  signal: AbortSignal
): Promise<MagangHubAuthTokens | null> {
  let currentUrl = startUrl;

  for (let redirectCount = 0; redirectCount < 6; redirectCount += 1) {
    if (!isOfficialKemnakerUrl(currentUrl)) {
      throw new Error('Redirect autentikasi menuju domain yang tidak diizinkan.');
    }
    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': SIAPKERJA_ACCEPT_LANGUAGE,
        'User-Agent': SIAPKERJA_USER_AGENT,
        ...(cookieHeaderForUrl(cookieJar, currentUrl) ? { Cookie: cookieHeaderForUrl(cookieJar, currentUrl) } : {}),
      },
      redirect: 'manual',
      signal,
    });
    addResponseCookies(cookieJar, response, currentUrl);
    const fromCookies = tokenFromCookies(cookieJar);
    if (fromCookies) return fromCookies;

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    const finalUrlToken = currentUrl.searchParams.get('access_token') ?? currentUrl.searchParams.get('token');
    if (finalUrlToken) {
      return {
        accessToken: finalUrlToken,
        refreshToken: currentUrl.searchParams.get('refresh_token'),
      };
    }
    return null;
  }

  throw new Error('Redirect autentikasi MagangHub melebihi batas.');
}

async function loginThroughKemnakerSso(
  loginUrl: URL,
  email: string,
  password: string,
  signal: AbortSignal
): Promise<{ tokens?: MagangHubAuthTokens; error?: string }> {
  const cookieJar: SessionCookie[] = [];
  const loginPage = await fetch(loginUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': SIAPKERJA_ACCEPT_LANGUAGE,
      'Cache-Control': 'no-cache',
      'User-Agent': SIAPKERJA_USER_AGENT,
    },
    redirect: 'manual',
    signal,
  });
  addResponseCookies(cookieJar, loginPage, loginUrl);
  if (!loginPage.ok) {
    if (loginPage.status === 403) {
      return { error: 'Halaman login SIAPKerja ditolak oleh proteksi server (HTTP 403). Coba lagi beberapa saat; jika berulang, autentikasi otomatis sedang diblokir oleh SIAPKerja.' };
    }
    return { error: `Halaman login SIAPKerja merespons HTTP ${loginPage.status}.` };
  }
  const csrfToken = getCsrfToken(await loginPage.text());
  if (!csrfToken) {
    return { error: 'Halaman login SIAPKerja tidak memberikan token keamanan CSRF.' };
  }

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrfToken,
      Origin: loginUrl.origin,
      Referer: loginUrl.toString(),
      'Accept-Language': SIAPKERJA_ACCEPT_LANGUAGE,
      'User-Agent': SIAPKERJA_USER_AGENT,
      Cookie: cookieHeaderForUrl(cookieJar, loginUrl),
    },
    body: JSON.stringify({ username: email, password }),
    redirect: 'manual',
    signal,
  });
  addResponseCookies(cookieJar, response, loginUrl);
  const payload = await response.json().catch(() => null);
  const redirectUri = payload?.data?.redirect_uri;
  if (!response.ok) {
    const message = payload?.errors?.username?.[0] ?? payload?.message;
    if (response.status === 403) {
      return { error: 'Login SIAPKerja ditolak oleh proteksi server (HTTP 403), bukan otomatis berarti akun atau kata sandi salah. Coba lagi beberapa saat.' };
    }
    if (response.status === 401 || response.status === 422) {
      return { error: typeof message === 'string' ? message : 'Akun SIAPKerja atau kata sandi tidak dapat diverifikasi.' };
    }
    return { error: typeof message === 'string' ? message : `Login SIAPKerja ditolak (HTTP ${response.status}).` };
  }
  if (typeof redirectUri !== 'string' || !redirectUri) {
    return { error: 'Login SIAPKerja berhasil, tetapi tidak memberikan redirect ke sesi MagangHub.' };
  }

  const tokens = await followSsoRedirect(new URL(redirectUri), cookieJar, signal);
  return tokens
    ? { tokens }
    : { error: 'Login SIAPKerja berhasil, tetapi sesi Monev MagangHub belum menghasilkan access token.' };
}

/** Credential hanya dikirim server ke endpoint autentikasi MagangHub. */
export async function loginToMagangHub(email: string, password: string): Promise<{
  tokens?: MagangHubAuthTokens;
  error?: string;
}> {
  const configuredPath = process.env.MAGANGHUB_LOGIN_PATH || '/auth/login';
  let loginUrl: URL;
  try {
    loginUrl = resolveMagangHubLoginUrl(configuredPath);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Konfigurasi endpoint login MagangHub tidak valid.' };
  }
  const loginPath = loginUrl.pathname;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    if (loginUrl.hostname === 'account.kemnaker.go.id') {
      return await loginThroughKemnakerSso(loginUrl, email, password, controller.signal);
    }

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://monev.maganghub.kemnaker.go.id',
        Referer: 'https://monev.maganghub.kemnaker.go.id/',
        'X-Frontend-Build-ID': MAGANGHUB_FRONTEND_BUILD_ID,
      },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const auth = payload?.data?.tokens ?? payload?.data ?? payload?.tokens ?? payload;
    const cookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie().join('; ')
      : response.headers.get('set-cookie') || '';
    const accessCookie = cookies.match(/(?:monev-access-token|access_token)=([^;]+)/i)?.[1];
    const refreshCookie = cookies.match(/(?:monev-refresh-token|refresh_token)=([^;]+)/i)?.[1];
    const nestedToken = typeof auth?.token === 'object' && auth.token !== null ? auth.token : null;
    const accessToken = auth?.access_token ?? auth?.accessToken ?? nestedToken?.access_token ?? nestedToken?.accessToken ?? auth?.token ?? accessCookie;
    const refreshToken = auth?.refresh_token ?? auth?.refreshToken ?? nestedToken?.refresh_token ?? nestedToken?.refreshToken ?? refreshCookie ?? null;
    if (!response.ok) {
      console.warn('[maganghub/login] Upstream login rejected request:', {
        host: loginUrl.hostname,
        path: loginPath,
        status: response.status,
      });
      if (response.status === 401 || response.status === 403) {
        return { error: `Server login MagangHub membalas HTTP ${response.status}. Ini belum memastikan email/kata sandi salah; periksa path dan format autentikasi (${loginPath}).` };
      }
      if (response.status === 404) {
        return { error: `Endpoint login MagangHub tidak ditemukan (HTTP 404): ${loginPath}. Periksa MAGANGHUB_LOGIN_PATH.` };
      }
      if (response.status === 400 || response.status === 422) {
        return { error: `Format request login ditolak MagangHub (HTTP ${response.status}). Path atau field kredensial mungkin berbeda.` };
      }
      if (response.status >= 300 && response.status < 400) {
        return { error: `Endpoint login mengalihkan request (HTTP ${response.status}). Gunakan endpoint API autentikasi langsung, bukan halaman redirect/SSO.` };
      }
      return { error: `Server login MagangHub merespons HTTP ${response.status}. Coba lagi nanti atau periksa endpoint autentikasi.` };
    }
    if (typeof accessToken !== 'string' || !accessToken) {
      console.warn('[maganghub/login] Successful response did not include a recognized access token:', {
        path: loginPath,
        status: response.status,
        contentType: response.headers.get('content-type'),
      });
      return { error: `Login endpoint membalas HTTP ${response.status}, tetapi access token tidak ditemukan pada body/header. Format respons autentikasi perlu disesuaikan.` };
    }
    return { tokens: { accessToken, refreshToken: typeof refreshToken === 'string' ? refreshToken : null } };
  } catch (error) {
    console.warn('[maganghub/login] SSO connection failed:', {
      host: loginUrl.hostname,
      reason: error instanceof Error ? error.name : 'unknown',
      code: error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause
        ? (error.cause as { code?: string }).code
        : undefined,
    });
    return { error: describeLoginConnectionError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ekstrak token JWT dan buat header cookie yang bersih & kompatibel dengan MagangHub.
 */
export function extractAuthInfo(cookieStr: string): {
  cookieHeader: string;
  bearerToken: string | null;
  refreshToken: string | null;
} {
  const cleanStr = cookieStr.trim();
  let bearerToken: string | null = null;
  let refreshToken: string | null = null;
  let parsedSession = false;

  try {
    const session = JSON.parse(cleanStr) as { accessToken?: unknown; refreshToken?: unknown };
    if (typeof session.accessToken === 'string') bearerToken = session.accessToken;
    if (typeof session.refreshToken === 'string') refreshToken = session.refreshToken;
    parsedSession = typeof session.accessToken === 'string';
  } catch {
    // Legacy token/cookie strings remain supported during the migration.
  }

  // 1. Ekstrak JWT (format eyJ...) di mana pun posisinya dalam string
  // Mencakup: raw JWT, 'Bearer eyJ...', 'monev-access-token=eyJ...', 'access_token=eyJ...', JSON token, dsb.
  const jwtMatch = cleanStr.match(/eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/);
  if (!bearerToken && jwtMatch) {
    bearerToken = jwtMatch[0];
  } else if (!bearerToken) {
    // 2. Fallback: Cek apakah ada cookie `access_token=...`, `token=...`, atau `session=...`
    const accessMatch = cleanStr.match(/(?:monev-access-token|monev_access_token|access_token|token|session|jwt)=([^;]+)/i);
    if (accessMatch && accessMatch[1]) {
      bearerToken = accessMatch[1].trim();
    }
  }

  // 3. Format cookieHeader agar MagangHub mengenali token sesi
  let cookieHeader = parsedSession ? '' : cleanStr;
  if (bearerToken) {
    if (parsedSession || !cleanStr.includes('=')) {
      cookieHeader = `monev-access-token=${bearerToken}; access_token=${bearerToken}`;
    } else if (!cleanStr.startsWith('{')) {
      // Pastikan monev-access-token ada di header karena dipakai Nuxt MagangHub
      const parts = cleanStr.split(';').map((s) => s.trim()).filter(Boolean);
      if (!parts.some((p) => p.startsWith('monev-access-token='))) {
        parts.push(`monev-access-token=${bearerToken}`);
      }
      cookieHeader = parts.join('; ');
    }
  }

  if (refreshToken) cookieHeader = `${cookieHeader}; refresh_token=${refreshToken}`;

  return { cookieHeader, bearerToken, refreshToken };
}

/**
 * Melakukan HTTP request ke MagangHub API dengan mekanisme retry dan refresh token.
 */
async function fetchMagangHubApi<T>(
  path: string,
  cookiePlaintext: string,
  initOptions: RequestInit = {},
  onTokensRefreshed?: (accessToken: string, refreshToken: string | null) => Promise<void>
): Promise<{ ok: boolean; status: number; data?: T; isSessionExpired?: boolean; error?: string }> {
  const { cookieHeader, bearerToken, refreshToken } = extractAuthInfo(cookiePlaintext);

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
          const refreshedAccessToken = typeof refreshJson?.access_token === 'string'
            ? refreshJson.access_token
            : null;
          if (refreshedAccessToken) {
            currentToken = refreshedAccessToken;
            const refreshedRefreshToken = typeof refreshJson.refresh_token === 'string'
              ? refreshJson.refresh_token
              : refreshToken;
            await onTokensRefreshed?.(refreshedAccessToken, refreshedRefreshToken);
            // Retry request asli dengan access token baru
            response = await fetch(url, {
              ...initOptions,
              headers: makeHeaders(currentToken),
              signal: controller.signal,
            });
            console.log(`[maganghub] Retry response after refresh: ${response.status}`);
          }
        } else {
          console.log('[maganghub] Refresh rejected:', refreshRes.status);
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
export async function fetchMagangHubProfile(
  cookiePlaintext: string,
  onTokensRefreshed?: (accessToken: string, refreshToken: string | null) => Promise<void>
) {
  return fetchMagangHubApi<MagangHubUserData>('/users/me', cookiePlaintext, {
    method: 'GET',
  }, onTokensRefreshed);
}

/**
 * Fetch status absensi / laporan hari ini dari MagangHub (`/users/me/home`).
 */
export async function fetchMagangHubAttendance(
  cookiePlaintext: string,
  onTokensRefreshed?: (accessToken: string, refreshToken: string | null) => Promise<void>
) {
  return fetchMagangHubApi<MagangHubHomeApiData>('/users/me/home', cookiePlaintext, {
    method: 'GET',
  }, onTokensRefreshed);
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

  const persistRefreshedTokens = (accessToken: string, refreshToken: string | null) =>
    updateSessionTokens(userId, accessToken, refreshToken, supabase);
  const profileRes = await fetchMagangHubProfile(cookiePlaintext, persistRefreshedTokens);

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
    fetchMagangHubAttendance(cookiePlaintext, (accessToken, refreshToken) =>
      updateSessionTokens(userId, accessToken, refreshToken, supabase)),
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
        const attendancesRes = await fetchMagangHubApi<any>(
          '/attendances',
          cookiePlaintext,
          {},
          (accessToken, refreshToken) => updateSessionTokens(userId, accessToken, refreshToken, supabase)
        );
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
