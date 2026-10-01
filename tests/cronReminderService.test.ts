import { describe, expect, it, vi } from 'vitest';
import { formatCronReminderMessage } from '@/lib/services/cronReminderService';
import { sendFoonteMessage } from '@/lib/services/foonteService';

describe('formatCronReminderMessage()', () => {
  it('menampilkan setiap status peserta dalam format pesan WhatsApp', () => {
    const message = formatCronReminderMessage(
      [{ name: 'Ayu', status: 'belum_lapor' }, { name: 'Bima', status: 'selesai' }],
      new Date('2026-10-01T00:00:00.000Z')
    );
    expect(message).toContain('*[REMINDER MAGANGHUB]*');
    expect(message).toContain('Ayu — Belum mengisi laporan');
    expect(message).toContain('Bima — Laporan sudah diisi');
    expect(message).toContain('07:00 WIB');
  });
});

describe('sendFoonteMessage()', () => {
  it('mengirim payload Foonte sesuai kontrak API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"status":true}', { status: 200 }));
    const result = await sendFoonteMessage('Halo tim', { apiToken: 'token-test', groupId: 'group@g.us' }, fetcher);
    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.foonte.com/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'token-test' }),
        body: JSON.stringify({ target: 'group@g.us', message: 'Halo tim', countryCode: '62' }),
      })
    );
  });

  it('mengembalikan kegagalan aman saat provider tidak dapat dihubungi', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network unavailable'));
    await expect(sendFoonteMessage('Halo tim', { apiToken: 'token-test', groupId: 'group@g.us' }, fetcher))
      .resolves.toMatchObject({ ok: false, status: 0, responseBody: 'request_failed' });
  });
});
