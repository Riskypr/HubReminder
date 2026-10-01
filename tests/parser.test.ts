import { describe, it, expect } from 'vitest';
import { parseStatus, parseApiResponse } from '@/lib/attendance/parser';

describe('parseStatus()', () => {
  it('harus mendeteksi status belum_lapor saat tombol berwarna biru', () => {
    const html = `
      <div class="dashboard-container">
        <h1>Dashboard MagangHub</h1>
        <button class="btn ui-primary-action--blue">Isi Laporan Hari Ini</button>
      </div>
    `;
    const res = parseStatus(html);
    expect(res.status).toBe('belum_lapor');
  });

  it('harus mendeteksi status selesai saat tombol berwarna hijau / sudah diisi', () => {
    const html = `
      <div class="dashboard-container">
        <h1>Dashboard MagangHub</h1>
        <button class="btn ui-primary-action--green">Laporan Hari Ini Sudah Diisi</button>
      </div>
    `;
    const res = parseStatus(html);
    expect(res.status).toBe('selesai');
  });

  it('harus mendeteksi session_expired saat dialihkan ke form login', () => {
    const html = `
      <html>
        <head><title>Masuk ke Akun - MagangHub</title></head>
        <body>
          <form action="/login" method="POST">
            <input type="email" name="email" />
            <input type="password" name="password" />
            <button type="submit">Masuk</button>
          </form>
        </body>
      </html>
    `;
    const res = parseStatus(html);
    expect(res.status).toBe('session_expired');
  });

  it('harus fallback ke unknown saat elemen tidak ditemukan atau struktur HTML acak', () => {
    const html = `
      <div>
        <h1>Halaman Acak atau Struktur Baru</h1>
        <p>Konten tidak terduga tanpa tombol laporan</p>
      </div>
    `;
    const res = parseStatus(html);
    expect(res.status).toBe('unknown');
    expect(res.detectedVia).toBe('element_not_found');
  });

  it('harus menangani string kosong tanpa crash', () => {
    const res = parseStatus('');
    expect(res.status).toBe('unknown');
  });

  it('harus mendeteksi status selesai dari embedded Nuxt data', () => {
    const html = `
      <html>
        <body>
          <script id="__NUXT_DATA__" type="application/json">
            [{"has_attendance":true}]
          </script>
        </body>
      </html>
    `;
    const res = parseStatus(html);
    expect(res.status).toBe('selesai');
  });
});

describe('parseApiResponse()', () => {
  it('harus mendeteksi selesai saat has_attendance bernilai true', () => {
    const res = parseApiResponse({
      has_attendance: true,
      is_scheduled_off_day: false,
      is_holiday: false,
    });
    expect(res.status).toBe('selesai');
    expect(res.detectedVia).toBe('api:has_attendance=true');
  });

  it('harus mendeteksi belum_lapor saat has_attendance bernilai false', () => {
    const res = parseApiResponse({
      has_attendance: false,
      is_scheduled_off_day: false,
      is_holiday: false,
    });
    expect(res.status).toBe('belum_lapor');
    expect(res.detectedVia).toBe('api:has_attendance=false');
  });

  it('harus mendeteksi selesai saat hari libur jadwal (is_scheduled_off_day) atau hari libur nasional', () => {
    const resOffDay = parseApiResponse({
      has_attendance: false,
      is_scheduled_off_day: true,
      is_holiday: false,
    });
    expect(resOffDay.status).toBe('selesai');

    const resHoliday = parseApiResponse({
      has_attendance: false,
      is_scheduled_off_day: false,
      is_holiday: true,
      holiday: { name: 'Tahun Baru' },
    });
    expect(resHoliday.status).toBe('selesai');
  });

  it('harus fallback ke unknown jika payload null atau undefined', () => {
    expect(parseApiResponse(null).status).toBe('unknown');
    expect(parseApiResponse(undefined).status).toBe('unknown');
  });

  it('harus menangani payload terbungkus di dalam data property', () => {
    const wrappedPayload = {
      data: {
        has_attendance: true,
        is_scheduled_off_day: false,
        is_holiday: false,
      },
    };
    expect(parseApiResponse(wrappedPayload).status).toBe('selesai');

    const wrappedPending = {
      data: {
        has_attendance: false,
        is_scheduled_off_day: false,
        is_holiday: false,
      },
    };
    expect(parseApiResponse(wrappedPending).status).toBe('belum_lapor');
  });

  it('harus mendeteksi belum_lapor saat has_attendance null atau 0 dalam payload tanggal valid', () => {
    const resNull = parseApiResponse({
      has_attendance: null,
      is_scheduled_off_day: false,
      is_holiday: false,
      date: '2026-10-01',
    });
    expect(resNull.status).toBe('belum_lapor');

    const resZero = parseApiResponse({
      has_attendance: 0,
      is_scheduled_off_day: false,
      is_holiday: false,
    });
    expect(resZero.status).toBe('belum_lapor');
  });

  it('harus mendeteksi selesai saat has_attendance bernilai 1 atau status filled', () => {
    const resOne = parseApiResponse({
      has_attendance: 1,
      is_scheduled_off_day: false,
      is_holiday: false,
    });
    expect(resOne.status).toBe('selesai');

    const resFilled = parseApiResponse({
      status: 'filled',
      date: '2026-10-01',
    });
    expect(resFilled.status).toBe('selesai');
  });
});

