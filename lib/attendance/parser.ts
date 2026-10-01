// lib/attendance/parser.ts
// Parser status tombol laporan dashboard MagangHub Kemnaker
// PENTING: Dibuat modular dan murni (pure function) agar mudah di-unit test

import * as cheerio from 'cheerio';
import type { AttendanceStatus } from '@/lib/types/attendance';

export interface ParseResult {
  status: AttendanceStatus;
  detectedVia: string;
}

/**
 * Parsing HTML dari dashboard MagangHub untuk mendeteksi status pengisian laporan harian.
 *
 * Rules:
 * - Jika halaman login terdeteksi -> 'session_expired'
 * - Jika tombol laporan berwarna biru (mis. class 'ui-primary-action--blue') -> 'belum_lapor'
 * - Jika tombol/elemen laporan berwarna hijau -> 'selesai'
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

  // 2. Cari tombol atau elemen laporan harian
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

  // 3. Fallback jika ada indikasi class spesifik
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

  // 4. Default aman jika struktur tidak cocok (mencegah salah tafsir)
  return {
    status: 'unknown',
    detectedVia: 'element_not_found',
  };
}
