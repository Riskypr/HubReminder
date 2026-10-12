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

export type UserBotAction =
  | { type: 'link'; name: string }
  | { type: 'status' }
  | { type: 'approve' }
  | { type: 'regenerate' }
  | { type: 'edit'; newContent: string | null }
  | { type: 'cancel' }
  | { type: 'report_input'; content: string };

/**
 * Parsing command balasan pengguna WhatsApp ke Bot HubReminder.
 * Mendukung approval (kirim/ya/oke), regen (ulang), edit, batal, status, dan input kegiatan baru.
 */
export function parseUserBotAction(message: string): UserBotAction {
  const trimmed = message.trim();

  // 1. Link command: link [nama]
  const linkName = parseLinkCommand(trimmed);
  if (linkName) {
    return { type: 'link', name: linkName };
  }

  // 2. Status command: status
  if (/^status$/i.test(trimmed)) {
    return { type: 'status' };
  }

  // 3. Approval / submit: kirim, ya, yes, setuju, oke, ok, submit, lanjut, acc, deal
  if (/^(kirim|ya|yes|setuju|oke|ok|submit|lanjut|acc|deal)$/i.test(trimmed)) {
    return { type: 'approve' };
  }

  // 4. Regenerate: ulang, regen, generate ulang, buat ulang, re-generate, refresh
  if (/^(ulang|regen|generate\s*ulang|buat\s*ulang|re-generate|refresh)$/i.test(trimmed)) {
    return { type: 'regenerate' };
  }

  // 5. Cancel: batal, cancel, batalkan
  if (/^(batal|cancel|batalkan)$/i.test(trimmed)) {
    return { type: 'cancel' };
  }

  // 6. Edit command: edit [catatan baru] / revisi [catatan baru] atau hanya edit / revisi
  const editMatch = trimmed.match(/^(?:edit|revisi)(?:\s*[:\-]\s*|\s+)([\s\S]+)$/i);
  if (editMatch) {
    return { type: 'edit', newContent: editMatch[1].trim() };
  }
  if (/^(?:edit|revisi)$/i.test(trimmed)) {
    return { type: 'edit', newContent: null };
  }

  // 7. General report input (kegiatan harian)
  return { type: 'report_input', content: trimmed };
}

export function formatReportPreviewMessage(
  report: { activity: string; lesson: string; challenge: string },
  dateStr: string,
  isRegenerated = false,
): string {
  const header = isRegenerated
    ? `📋 *DRAF LAPORAN HARIAN (HASIL GENERATE ULANG)*`
    : `📋 *DRAF LAPORAN HARIAN MAGANG*`;

  return `${header}
📅 Tanggal: *${dateStr}*

*1. Uraian Aktivitas:*
${report.activity}

*2. Pembelajaran yang Diperoleh:*
${report.lesson}

*3. Kendala & Solusi:*
${report.challenge}

────────────────────────
🔍 *Konfirmasi & Persetujuan:*
Laporan ini *belum disubmit* ke MagangHub. Mohon periksa apakah isi draf di atas sudah pas.

Silakan pilih opsi:
✅ Balas *KIRIM* atau *YA* ➔ Submit ke MagangHub
🔄 Balas *ULANG* ➔ Generate ulang draf AI
✏️ Balas *EDIT [kegiatan baru]* ➔ Revisi isi kegiatan
❌ Balas *BATAL* ➔ Batalkan draf laporan`;
}

export function formatSubmitSuccessMessage(
  report: { activity: string; lesson: string; challenge: string },
): string {
  return `✅ *Laporan berhasil disubmit ke MagangHub!*

*Aktivitas:*
${report.activity}

*Pelajaran:*
${report.lesson}

*Kendala:*
${report.challenge}

_Laporan harian magang kamu sudah resmi tersimpan di sistem MagangHub Kemnaker._`;
}

