// lib/attendance/parser.ts
// Parser status laporan dashboard MagangHub Kemnaker
// PENTING: Dibuat modular dan murni (pure function) agar mudah di-unit test

import * as cheerio from 'cheerio';
import type { AttendanceStatus } from '@/lib/types/attendance';

export interface ParseResult {
  status: AttendanceStatus;
  detectedVia: string;
}

export interface MagangHubHomeApiData {
  has_attendance?: boolean | number | string | null;
  is_scheduled_off_day?: boolean | number | null;
  is_holiday?: boolean | number | null;
  date?: string;
  holiday?: {
    name?: string;
  } | null;
  attendance?: Record<string, unknown> | null;
  attendances?: unknown[];
  status?: string;
  [key: string]: unknown;
}

/**
 * Parsing hasil API endpoint `/users/me/home` MagangHub (paling akurat & direct).
 *
 * Rules sesuai MagangHub client logic (Home.vue / hlKSvSxg.js):
 * - Jika hari libur / off-day -> 'selesai' (tidak perlu lapor)
 * - Jika has_attendance truthy / attendance ada -> 'selesai'
 * - Jika bukan off-day dan has_attendance falsy (false, null, 0) -> 'belum_lapor'
 */
export function parseApiResponse(rawPayload: MagangHubHomeApiData | null | undefined): ParseResult {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return {
      status: 'unknown',
      detectedVia: 'api_empty_or_invalid_payload',
    };
  }

  // Unwrap jika payload terbungkus di dalam properti { data: ... }
  const data = (
    rawPayload.data && typeof rawPayload.data === 'object' && !Array.isArray(rawPayload.data)
      ? rawPayload.data
      : rawPayload
  ) as MagangHubHomeApiData;

  // 1. Cek Hari Libur / Off Day (jadwal libur / libur nasional)
  const isOffDay =
    data.is_scheduled_off_day === true ||
    data.is_scheduled_off_day === 1 ||
    data.is_holiday === true ||
    data.is_holiday === 1 ||
    Boolean(data.holiday && data.holiday.name);

  if (isOffDay) {
    const holidayName = data.holiday?.name ? ` (${data.holiday.name})` : '';
    return {
      status: 'selesai',
      detectedVia: `api:scheduled_off_or_holiday${holidayName}`,
    };
  }

  // 2. Cek apakah laporan / kehadiran sudah terisi
  const isFilled =
    data.has_attendance === true ||
    data.has_attendance === 1 ||
    data.has_attendance === 'true' ||
    data.status === 'filled' ||
    data.status === 'selesai' ||
    data.status === 'done' ||
    Boolean(data.attendance && typeof data.attendance === 'object' && Object.keys(data.attendance).length > 0) ||
    Boolean(Array.isArray(data.attendances) && data.attendances.length > 0);

  if (isFilled) {
    return {
      status: 'selesai',
      detectedVia: 'api:has_attendance=true',
    };
  }

  // 3. Cek apakah belum lapor
  // Sesuai logika client MagangHub:
  // e.data.is_scheduled_off_day || e.data.is_holiday ? 'off-day' : (e.data.has_attendance ? 'filled' : 'empty')
  // Jika ini payload home/attendance yang valid dan bukan libur serta belum diisi -> 'belum_lapor'
  const isRecognizedPayload =
    'has_attendance' in data ||
    'is_scheduled_off_day' in data ||
    'is_holiday' in data ||
    'date' in data ||
    'attendance' in data ||
    data.status === 'empty' ||
    data.status === 'pending';

  if (isRecognizedPayload) {
    return {
      status: 'belum_lapor',
      detectedVia: 'api:has_attendance=false',
    };
  }

  return {
    status: 'unknown',
    detectedVia: 'api:unknown_data_structure',
  };
}

/**
 * Parsing HTML dari dashboard MagangHub untuk mendeteksi status pengisian laporan harian.
 *
 * Rules:
 * - Jika halaman login terdeteksi -> 'session_expired'
 * - Jika tombol laporan berwarna biru (mis. class 'ui-primary-action--blue') -> 'belum_lapor'
 * - Jika tombol/elemen laporan berwarna hijau -> 'selesai'
 * - Jika ada payload Nuxt yang dapat diekstrak -> ekstrak status
 * - Jika elemen tidak ditemukan/struktur berubah -> fallback ke 'unknown' (bukan error)
 */
export function parseStatus(html: string): ParseResult {
  if (!html || typeof html !== 'string') {
    return { status: 'unknown', detectedVia: 'empty_html' };
  }

  const $ = cheerio.load(html);

  // 1. Cek apakah ini halaman login (sesi habis/redirect)
  const isLoginPage =
    $('form[action*="login"]').length > 0 ||
    $('input[type="password"]').length > 0 ||
    $('title').text().toLowerCase().includes('masuk') ||
    $('title').text().toLowerCase().includes('login');

  if (isLoginPage) {
    return {
      status: 'session_expired',
      detectedVia: 'detected_login_form_or_title',
    };
  }

  // 2. Cek apakah ada data embedded Nuxt JSON (__NUXT_DATA__ dsb)
  const nuxtDataScript = $('script#__NUXT_DATA__').html();
  if (nuxtDataScript) {
    try {
      if (nuxtDataScript.includes('"has_attendance":true') || nuxtDataScript.includes('has_attendance:true')) {
        return {
          status: 'selesai',
          detectedVia: 'nuxt_embedded_data:has_attendance_true',
        };
      }
      if (nuxtDataScript.includes('"has_attendance":false') || nuxtDataScript.includes('has_attendance:false')) {
        return {
          status: 'belum_lapor',
          detectedVia: 'nuxt_embedded_data:has_attendance_false',
        };
      }
    } catch {
      // Abaikan parsing error, lanjut ke selector DOM
    }
  }

  // 3. Cari tombol atau elemen laporan harian
  // PRD §5: deteksi class `ui-primary-action--blue` vs indikasi warna hijau saat status selesai.
  const blueButton = $(
    '.ui-primary-action--blue, button[class*="blue"], a[class*="blue"], .btn-primary[class*="blue"], [class*="ui-primary-action"][class*="blue"]'
  );

  const greenButton = $(
    '.ui-primary-action--green, button[class*="green"], a[class*="green"], .btn-success, [class*="ui-primary-action"][class*="green"], [class*="status-done"]'
  );

  // Cari berdasarkan teks laporan harian
  const reportElements = $('button, a, div, span').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('isi laporan hari ini') || text.includes('laporan hari ini');
  });

  if (reportElements.length > 0) {
    let foundStatus: AttendanceStatus | null = null;
    let via = '';

    reportElements.each((_, el) => {
      const classAttr = $(el).attr('class') || '';
      const text = $(el).text();

      if (classAttr.includes('ui-primary-action--blue') || classAttr.includes('blue')) {
        foundStatus = 'belum_lapor';
        via = `report_btn_class:${classAttr.slice(0, 50)}`;
        return false; // break loop
      } else if (
        classAttr.includes('ui-primary-action--green') ||
        classAttr.includes('green') ||
        classAttr.includes('success') ||
        text.toLowerCase().includes('sudah diisi') ||
        text.toLowerCase().includes('selesai')
      ) {
        foundStatus = 'selesai';
        via = `report_btn_class:${classAttr.slice(0, 50)}`;
        return false; // break loop
      }
    });

    if (foundStatus) {
      return { status: foundStatus, detectedVia: via };
    }
  }

  // 4. Fallback jika ada indikasi class spesifik
  if (blueButton.length > 0) {
    return {
      status: 'belum_lapor',
      detectedVia: `selector_match:${blueButton.attr('class')?.slice(0, 50) || 'blue_btn'}`,
    };
  }

  if (greenButton.length > 0) {
    return {
      status: 'selesai',
      detectedVia: `selector_match:${greenButton.attr('class')?.slice(0, 50) || 'green_btn'}`,
    };
  }

  // 5. Default aman jika struktur tidak cocok (mencegah salah tafsir)
  return {
    status: 'unknown',
    detectedVia: 'element_not_found',
  };
}
