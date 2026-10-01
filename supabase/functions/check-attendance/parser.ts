// supabase/functions/check-attendance/parser.ts
// Modul parser untuk Edge Function runtime Deno

export type AttendanceStatus = 'belum_lapor' | 'selesai' | 'unknown' | 'session_expired';

export interface ParseResult {
  status: AttendanceStatus;
  detectedVia: string;
}

export function parseStatus(html: string): ParseResult {
  if (!html || typeof html !== 'string') {
    return { status: 'unknown', detectedVia: 'empty_html' };
  }

  const lower = html.toLowerCase();

  // 1. Deteksi form login / indikator login
  if (
    lower.includes('type="password"') ||
    lower.includes('action="/login"') ||
    lower.includes('<title>masuk') ||
    lower.includes('<title>login')
  ) {
    return {
      status: 'session_expired',
      detectedVia: 'detected_login_indicators',
    };
  }

  // 2. Deteksi class spesifik PRD: `ui-primary-action--blue`
  if (
    html.includes('ui-primary-action--blue') ||
    (lower.includes('isi laporan hari ini') && (lower.includes('blue') || lower.includes('bg-primary')))
  ) {
    return {
      status: 'belum_lapor',
      detectedVia: 'class:ui-primary-action--blue',
    };
  }

  // 3. Deteksi class hijau / status sudah diisi
  if (
    html.includes('ui-primary-action--green') ||
    lower.includes('laporan sudah diisi') ||
    (lower.includes('laporan hari ini') && (lower.includes('green') || lower.includes('success')))
  ) {
    return {
      status: 'selesai',
      detectedVia: 'class:ui-primary-action--green_or_success',
    };
  }

  // 4. Default fallback jika struktur berubah
  return {
    status: 'unknown',
    detectedVia: 'no_matching_status_element',
  };
}
