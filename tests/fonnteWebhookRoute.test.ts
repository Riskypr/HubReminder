import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  sendFoonteMessage: vi.fn(),
  getFoonteConfig: vi.fn(() => ({ apiToken: 'test-token', groupId: '' })),
  linkError: null as null | { message: string },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ not: async () => ({
          data: [{ id: 'user-1', full_name: 'Risky Prasetyo' }],
          error: null,
        }) }) };
      }
      return { upsert: mocks.upsert };
    },
  }),
}));

vi.mock('@/lib/services/foonteService', () => ({
  getFoonteConfig: mocks.getFoonteConfig,
  sendFoonteMessage: mocks.sendFoonteMessage,
}));
vi.mock('@/lib/utils/crypto', () => ({ decryptSessionSecret: vi.fn() }));
vi.mock('@/lib/services/geminiService', () => ({ generateReport: vi.fn() }));
vi.mock('@/lib/services/reportSubmitService', () => ({ submitReportToMagangHub: vi.fn() }));
vi.mock('@/lib/services/accountService', () => ({ updateSessionTokens: vi.fn() }));

import { POST } from '@/app/api/webhook/fonnte/route';

describe('POST /api/webhook/fonnte link flow', () => {
  beforeEach(() => {
    mocks.linkError = null;
    mocks.upsert.mockReset().mockImplementation(async () => ({ error: mocks.linkError }));
    mocks.sendFoonteMessage.mockReset().mockResolvedValue({ ok: true, status: 200, responseBody: '{"status":true}' });
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
    expect(mocks.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      phone_number: '6281234567890',
      linked_at: expect.any(String),
    }, { onConflict: 'phone_number' });
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

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ phone_number: '6281234567890' }), expect.any(Object));
    expect(mocks.sendFoonteMessage).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.any(Function), '6281234567890');
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
});
