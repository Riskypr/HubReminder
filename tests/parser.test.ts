import { describe, it, expect } from 'vitest';
import { parseStatus } from '@/lib/attendance/parser';

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
});
