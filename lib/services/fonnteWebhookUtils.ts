export interface FoonteIncomingMessage {
  phone: string;
  message: string;
  isGroup: boolean;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || (typeof value === 'string' && /^(true|1|yes)$/i.test(value.trim()));
}

/** Normalize nomor WA Indonesia and strip JID characters such as @s.whatsapp.net. */
export function normalizeWhatsAppPhone(raw: string): string {
  if (!raw || raw.includes('@g.us')) return '';
  let phone = raw.replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  else if (phone.startsWith('8')) phone = `62${phone}`;
  else if (phone && !phone.startsWith('62')) phone = `62${phone}`;

  if (phone.length < 10 || phone.length > 16) return '';
  return phone;
}

/** Parse documented Fonnte fields and use `member` for messages sent in a group. */
export function parseFoonteIncomingMessage(payload: Record<string, unknown>): FoonteIncomingMessage | null {
  const sender = stringValue(payload.sender) || stringValue(payload.from) || stringValue(payload.phone);
  const member = stringValue(payload.member) || stringValue(payload.participant) || stringValue(payload.author);
  const message = stringValue(payload.message) || stringValue(payload.text) || stringValue(payload.caption) || stringValue(payload.body);
  const isGroup = isTruthyFlag(payload.isGroup) || /@g\.us$/i.test(sender) || Boolean(payload.group);
  const rawPhone = isGroup ? (member || sender) : (sender || member);
  const phone = normalizeWhatsAppPhone(rawPhone);

  if (!phone || !message) return null;
  return { phone, message, isGroup };
}

export function parseLinkCommand(message: string): string | null {
  const match = message.trim().match(/^link\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
