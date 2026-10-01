// supabase/functions/check-attendance/fetcher.ts
// Mengambil HTML dashboard MagangHub dengan cookie sesi
// PENTING: Wajib menyertakan timeout & error handling agar tidak menggantung

const MAGANGHUB_DASHBOARD_URL = 'https://monev.maganghub.kemnaker.go.id/dashboard';
const TIMEOUT_MS = 10000; // 10 detik timeout

export interface FetchDashboardResult {
  ok: boolean;
  html?: string;
  isLoginRedirect?: boolean;
  error?: string;
}

export async function fetchDashboard(cookiePlaintext: string): Promise<FetchDashboardResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(MAGANGHUB_DASHBOARD_URL, {
      method: 'GET',
      headers: {
        'Cookie': cookiePlaintext,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Cek apakah di-redirect ke halaman login
    if (response.url.includes('/login') || response.url.includes('/auth') || response.status === 401 || response.status === 403) {
      return { ok: false, isLoginRedirect: true };
    }

    const html = await response.text();
    return { ok: true, html };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    return {
      ok: false,
      error: error.name === 'AbortError' ? 'Timeout saat mengakses MagangHub (10s)' : error.message,
    };
  }
}
