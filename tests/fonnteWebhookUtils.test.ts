import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppPhone, parseFoonteIncomingMessage, parseLinkCommand } from '@/lib/services/fonnteWebhookUtils';

describe('normalizeWhatsAppPhone()', () => {
  it('normalizes Indonesian numbers and removes WhatsApp JID suffixes', () => {
    expect(normalizeWhatsAppPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeWhatsAppPhone('6281234567890@s.whatsapp.net')).toBe('6281234567890');
  });
});

describe('parseFoonteIncomingMessage()', () => {
  it('parses a direct Fonnte message', () => {
    expect(parseFoonteIncomingMessage({ sender: '081234567890', message: 'link Risky Prasetyo' })).toEqual({
      phone: '6281234567890',
      message: 'link Risky Prasetyo',
      isGroup: false,
    });
  });

  it('uses the group member number instead of the group ID', () => {
    expect(parseFoonteIncomingMessage({
      sender: '120363012345678901@g.us',
      member: '081234567890',
      message: 'link Risky Prasetyo',
    })).toEqual({ phone: '6281234567890', message: 'link Risky Prasetyo', isGroup: true });
  });

  it('uses Fonnte button text when the message field is empty', () => {
    expect(parseFoonteIncomingMessage({ sender: '6281234567890', message: '', text: 'link Risky Prasetyo' })?.message)
      .toBe('link Risky Prasetyo');
  });

  it('does not mistake a string false flag for a group message', () => {
    expect(parseFoonteIncomingMessage({ sender: '6281234567890', isGroup: 'false', message: 'hai' })?.isGroup)
      .toBe(false);
  });

  it('ignores messages without a usable sender or content', () => {
    expect(parseFoonteIncomingMessage({ sender: '6281234567890', message: ' ' })).toBeNull();
    expect(parseFoonteIncomingMessage({ sender: '120363012345678901@g.us', message: 'link Nama' })).toBeNull();
  });
});

describe('parseLinkCommand()', () => {
  it('accepts the documented link command case-insensitively', () => {
    expect(parseLinkCommand('  LINK Risky Prasetyo  ')).toBe('Risky Prasetyo');
  });

  it('does not match a link command without a name', () => {
    expect(parseLinkCommand('link')).toBeNull();
  });
});
