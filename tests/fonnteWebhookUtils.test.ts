import { describe, expect, it } from 'vitest';
import {
  normalizeWhatsAppPhone,
  parseFoonteIncomingMessage,
  parseLinkCommand,
  parseUserBotAction,
} from '@/lib/services/fonnteWebhookUtils';

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

describe('parseUserBotAction()', () => {
  it('parses approve commands', () => {
    expect(parseUserBotAction('kirim')).toEqual({ type: 'approve' });
    expect(parseUserBotAction('KIRIM')).toEqual({ type: 'approve' });
    expect(parseUserBotAction('ya')).toEqual({ type: 'approve' });
    expect(parseUserBotAction('oke')).toEqual({ type: 'approve' });
    expect(parseUserBotAction('setuju')).toEqual({ type: 'approve' });
  });

  it('parses regenerate commands', () => {
    expect(parseUserBotAction('ulang')).toEqual({ type: 'regenerate' });
    expect(parseUserBotAction('REGEN')).toEqual({ type: 'regenerate' });
    expect(parseUserBotAction('generate ulang')).toEqual({ type: 'regenerate' });
  });

  it('parses cancel commands', () => {
    expect(parseUserBotAction('batal')).toEqual({ type: 'cancel' });
    expect(parseUserBotAction('cancel')).toEqual({ type: 'cancel' });
  });

  it('parses edit commands', () => {
    expect(parseUserBotAction('edit')).toEqual({ type: 'edit', newContent: null });
    expect(parseUserBotAction('revisi')).toEqual({ type: 'edit', newContent: null });
    expect(parseUserBotAction('edit: hari ini belajar backend')).toEqual({
      type: 'edit',
      newContent: 'hari ini belajar backend',
    });
    expect(parseUserBotAction('revisi membuat unit testing')).toEqual({
      type: 'edit',
      newContent: 'membuat unit testing',
    });
  });

  it('parses status command', () => {
    expect(parseUserBotAction('status')).toEqual({ type: 'status' });
    expect(parseUserBotAction('STATUS')).toEqual({ type: 'status' });
  });

  it('parses link command', () => {
    expect(parseUserBotAction('link Budi Santoso')).toEqual({
      type: 'link',
      name: 'Budi Santoso',
    });
  });

  it('parses normal activity input', () => {
    expect(parseUserBotAction('hari ini mengerjakan halaman admin')).toEqual({
      type: 'report_input',
      content: 'hari ini mengerjakan halaman admin',
    });
  });
});

