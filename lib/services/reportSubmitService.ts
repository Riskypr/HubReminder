// lib/services/reportSubmitService.ts
// Submit laporan harian ke MagangHub API.
// Menggunakan token sesi user yang sudah terenkripsi di database.
//
// Endpoint & payload ditemukan dari analisis bundle Nuxt MagangHub:
//   - 3YmPw1vT2.js: composable createAttendance → POST /attendances/with-daily-log
//   - D7WPuNJR2.js: form submit → { date, status, activity_log, lesson_learned, obstacles }

import { extractAuthInfo } from '@/lib/services/maganghubService';
import type { GeneratedReport } from '@/lib/services/geminiService';

const MAGANGHUB_API_BASE = 'https://monev-api.maganghub.kemnaker.go.id/api/v1';
const MAGANGHUB_FRONTEND_BUILD_ID = 'fdce5864ab936c3205233ffc340ba593c0136cd2-production';
const TIMEOUT_MS = 15_000;

export interface SubmitResult {
  ok: boolean;
  error?: string;
  isSessionExpired?: boolean;
}

/** Tanggal hari ini di WIB (YYYY-MM-DD) */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Submit laporan harian ke MagangHub.
 * Endpoint: POST /api/v1/attendances/with-daily-log
 *
 * Body yang dikirim mengikuti format form MagangHub (Nuxt frontend):
 * - date:           tanggal laporan (YYYY-MM-DD, WIB)
 * - status:         status kehadiran ("PRESENT")
 * - activity_log:   uraian aktivitas
 * - lesson_learned: pelajaran yang diperoleh
 * - obstacles:      kendala yang dialami
 */
export async function submitReportToMagangHub(
  cookiePlaintext: string,
  report: GeneratedReport,
  userId: string,
  onTokensRefreshed?: (accessToken: string, refreshToken: string | null) => Promise<void>,
): Promise<SubmitResult> {
  const { cookieHeader, bearerToken, refreshToken } = extractAuthInfo(cookiePlaintext);

  const makeHeaders = (token: string | null): Record<string, string> => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json',
    'Origin': 'https://monev.maganghub.kemnaker.go.id',
    'Referer': 'https://monev.maganghub.kemnaker.go.id/dashboard',
    'X-Frontend-Build-ID': MAGANGHUB_FRONTEND_BUILD_ID,
    'Cookie': cookieHeader,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Payload sesuai format yang digunakan oleh frontend MagangHub
  const body = JSON.stringify({
    date: todayWIB(),
    status: 'PRESENT',
    activity_log: report.activity,
    lesson_learned: report.lesson,
    obstacles: report.challenge,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let currentToken = bearerToken;

  try {
    // Endpoint utama sesuai analisis bundle Nuxt MagangHub (3YmPw1vT2.js)
    const endpoints = [
      '/attendances/with-daily-log',
      '/attendances',
    ];

    for (const endpoint of endpoints) {
      const url = `${MAGANGHUB_API_BASE}${endpoint}`;
      console.log(`[report-submit] Trying POST ${url}`);

      let response = await fetch(url, {
        method: 'POST',
        headers: makeHeaders(currentToken),
        body,
        signal: controller.signal,
      });

      // Jika 401, coba refresh token
      if (response.status === 401 && currentToken) {
        console.log('[report-submit] Got 401, attempting refresh...');
        try {
          const refreshRes = await fetch(`${MAGANGHUB_API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Cookie': cookieHeader,
              Authorization: `Bearer ${currentToken}`,
              'X-Frontend-Build-ID': MAGANGHUB_FRONTEND_BUILD_ID,
            },
            signal: controller.signal,
          });
          if (refreshRes.ok) {
            const refreshJson = await refreshRes.json().catch(() => null);
            if (refreshJson?.access_token) {
              currentToken = refreshJson.access_token;
              const newRefresh = typeof refreshJson.refresh_token === 'string' ? refreshJson.refresh_token : refreshToken;
              await onTokensRefreshed?.(refreshJson.access_token, newRefresh);
              // Retry
              response = await fetch(url, {
                method: 'POST',
                headers: makeHeaders(currentToken),
                body,
                signal: controller.signal,
              });
            }
          }
        } catch (refreshErr) {
          console.error('[report-submit] Refresh exception:', refreshErr);
        }
      }

      if (response.status === 401 || response.status === 403) {
        return { ok: false, isSessionExpired: true, error: 'Sesi MagangHub kedaluwarsa' };
      }

      if (response.status === 404 || response.status === 405) {
        // Endpoint ini tidak tersedia, coba endpoint berikutnya
        console.log(`[report-submit] ${endpoint} returned ${response.status}, trying next...`);
        continue;
      }

      const responseBody = await response.text().catch(() => '');
      console.log(`[report-submit] Response ${response.status}:`, responseBody.slice(0, 500));

      if (response.ok) {
        return { ok: true };
      }

      // Coba parse error message dari response
      try {
        const errorJson = JSON.parse(responseBody);
        const message = errorJson?.message || errorJson?.error || errorJson?.data?.message;
        if (message) return { ok: false, error: `MagangHub: ${message}` };
      } catch { /* bukan JSON */ }

      return { ok: false, error: `MagangHub API merespon HTTP ${response.status}` };
    }

    return { ok: false, error: 'Tidak ada endpoint submit laporan yang tersedia di MagangHub API' };
  } catch (err) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      return { ok: false, error: 'Timeout saat submit laporan ke MagangHub (15s)' };
    }
    console.error('[report-submit] Exception:', error.message);
    return { ok: false, error: `Gagal submit laporan: ${error.message}` };
  } finally {
    clearTimeout(timeout);
  }
}
