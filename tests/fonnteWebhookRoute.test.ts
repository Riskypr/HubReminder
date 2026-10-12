import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  update: vi.fn(),
  sendFoonteMessage: vi.fn(),
  getFoonteConfig: vi.fn(() => ({ apiToken: 'test-token', groupId: '' })),
  linkError: null as null | { message: string },
  waBotEnabled: true,
  existingSession: null as any,
  generateReport: vi.fn(),
  submitReportToMagangHub: vi.fn(),
  decryptSessionSecret: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            not: async () => ({
              data: [{ id: 'user-1', full_name: 'Risky Prasetyo' }],
              error: null,
            }),
            eq: () => ({
              maybeSingle: async () => ({
                data: { full_name: 'Risky Prasetyo', company_name: 'Kemnaker', position: 'IT' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'system_reminder_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { wa_bot_enabled: mocks.waBotEnabled },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'wa_phone_mappings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
          upsert: mocks.upsert,
        };
      }
      if (table === 'wa_report_sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mocks.existingSession,
                  error: null,
                }),
              }),
            }),
          }),
          upsert: mocks.upsert,
          update: (...args: any[]) => {
            mocks.update(...args);
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        };
      }
      if (table === 'maganghub_sessions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  encrypted_session: 'enc_session',
                  encrypted_refresh_token: null,
                  status: 'active',
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      return { upsert: mocks.upsert, update: mocks.update };
    },
  }),
}));

vi.mock('@/lib/services/foonteService', () => ({
  getFoonteConfig: mocks.getFoonteConfig,
  sendFoonteMessage: mocks.sendFoonteMessage,
}));
vi.mock('@/lib/utils/crypto', () => ({
  decryptSessionSecret: mocks.decryptSessionSecret,
}));
vi.mock('@/lib/services/geminiService', () => ({
  generateReport: mocks.generateReport,
}));
vi.mock('@/lib/services/reportSubmitService', () => ({
  submitReportToMagangHub: mocks.submitReportToMagangHub,
}));
vi.mock('@/lib/services/accountService', () => ({
  updateSessionTokens: vi.fn(),
}));

import { POST } from '@/app/api/webhook/fonnte/route';

describe('POST /api/webhook/fonnte link flow', () => {
  beforeEach(() => {
    mocks.linkError = null;
    mocks.existingSession = null;
    mocks.waBotEnabled = true;
    mocks.upsert.mockReset().mockImplementation(async () => ({ error: mocks.linkError }));
    mocks.update.mockReset();
    mocks.sendFoonteMessage.mockReset().mockResolvedValue({ ok: true, status: 200, responseBody: '{"status":true}' });
    mocks.generateReport.mockReset().mockResolvedValue({
      report: {
        activity: 'Hari ini mengerjakan modul testing dan pembuatan dashboard',
        lesson: 'Memahami integrasi webhook Fonnte dan workflow approval',
        challenge: 'Menyesuaikan alur interaksi pengguna via WhatsApp bot',
      },
    });
    mocks.decryptSessionSecret.mockReset().mockResolvedValue('decrypted_token');
    mocks.submitReportToMagangHub.mockReset().mockResolvedValue({ ok: true });
  });

  it('links the sender using the full profile name and confirms through Fonnte', async () => {
    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'link Risky Prasetyo' }),
    });

    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'link' });
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        phone_number: '6281234567890',
        linked_at: expect.any(String),
      },
      { onConflict: 'phone_number' },
    );
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.stringContaining('berhasil dihubungkan'),
      { apiToken: 'test-token', groupId: '' },
      expect.any(Function),
      '6281234567890',
    );
  });

  it('uses the member phone for a group link message', async () => {
    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: '120363012345678901@g.us',
        member: '081234567890',
        message: 'link Risky Prasetyo',
      }),
    });

    await POST(request as NextRequest);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ phone_number: '6281234567890' }),
      expect.any(Object),
    );
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
      '6281234567890',
    );
  });

  it('returns a link error when the mapping cannot be saved', async () => {
    mocks.linkError = { message: 'relation does not exist' };
    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '6281234567890', message: 'link Risky Prasetyo' }),
    });

    const response = await POST(request as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.stringContaining('Gagal menyimpan koneksi'),
      expect.any(Object),
      expect.any(Function),
      '6281234567890',
    );
  });

  it('skips processing incoming messages when wa_bot_enabled is false', async () => {
    mocks.waBotEnabled = false;
    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'link Risky Prasetyo' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, skipped: 'wa_bot_disabled' });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.sendFoonteMessage).not.toHaveBeenCalled();
  });

  it('generates report draft and asks for approval without immediately submitting', async () => {
    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'hari ini belajar nextjs dan testing' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'draft_created' });

    // Harus generate laporan lewat Gemini AI
    expect(mocks.generateReport).toHaveBeenCalled();
    // Harus update status menjadi waiting_approval
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'waiting_approval' }),
    );
    // TIDAK BOLEH submit langsung ke MagangHub!
    expect(mocks.submitReportToMagangHub).not.toHaveBeenCalled();
    // Mengirim preview & instruksi pilihan balasan ke WA user
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.stringContaining('DRAF LAPORAN HARIAN MAGANG'),
      expect.any(Object),
      expect.any(Function),
      '6281234567890',
    );
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.stringContaining('KIRIM'),
      expect.any(Object),
      expect.any(Function),
      '6281234567890',
    );
  });

  it('submits report to MagangHub only when user approves by replying "KIRIM"', async () => {
    const sampleReport = {
      activity: 'Aktivitas magang lengkap minimal 100 karakter untuk pengujian submit',
      lesson: 'Pembelajaran yang diperoleh dari kegiatan magang hari ini',
      challenge: 'Tantangan yang dihadapi beserta cara penyelesaiannya',
    };

    mocks.existingSession = {
      status: 'waiting_approval',
      user_input: 'hari ini membuat dashboard',
      generated_report: sampleReport,
    };

    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'KIRIM' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'submitted' });

    // Submit ke MagangHub harus dipanggil
    expect(mocks.submitReportToMagangHub).toHaveBeenCalledWith(
      'decrypted_token',
      sampleReport,
      'user-1',
      expect.any(Function),
    );
    // Status sesi diupdate ke submitted
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted' }),
    );
    // User menerima konfirmasi sukses
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(
      expect.stringContaining('Laporan berhasil disubmit'),
      expect.any(Object),
      expect.any(Function),
      '6281234567890',
    );
  });

  it('regenerates draft when user replies "ULANG"', async () => {
    mocks.existingSession = {
      status: 'waiting_approval',
      user_input: 'hari ini belajar nextjs',
      generated_report: {
        activity: 'Aktivitas lama',
        lesson: 'Pelajaran lama',
        challenge: 'Kendala lama',
      },
    };

    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'ULANG' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'regenerated' });

    expect(mocks.generateReport).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'waiting_approval' }),
    );
    expect(mocks.submitReportToMagangHub).not.toHaveBeenCalled();
  });

  it('cancels draft when user replies "BATAL"', async () => {
    mocks.existingSession = {
      status: 'waiting_approval',
      user_input: 'hari ini belajar nextjs',
      generated_report: { activity: 'A', lesson: 'B', challenge: 'C' },
    };

    const request = new Request('http://localhost/api/webhook/fonnte', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: '081234567890', message: 'batal' }),
    });

    const response = await POST(request as NextRequest);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, action: 'cancelled' });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'waiting_input', generated_report: null }),
    );
  });
});
