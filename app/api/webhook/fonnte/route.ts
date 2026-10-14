// app/api/webhook/fonnte/route.ts
// Webhook endpoint untuk menerima pesan masuk dari Fonnte.
// Alur Baru:
// 1. User kirim kegiatan di WA
// 2. Bot generate draf laporan (Gemini AI) & simpan status 'waiting_approval'
// 3. Bot kirim draf ke WA user & meminta persetujuan (KIRIM / ULANG / EDIT / BATAL)
// 4. Laporan HANYA disubmit ke MagangHub setelah user konfirmasi setuju/kirim.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSessionSecret } from '@/lib/utils/crypto';
import { generateReport, type GeneratedReport } from '@/lib/services/geminiService';
import { submitReportToMagangHub } from '@/lib/services/reportSubmitService';
import { updateSessionTokens } from '@/lib/services/accountService';
import { getFoonteConfig, sendFoonteMessage } from '@/lib/services/foonteService';
import {
  parseFoonteIncomingMessage,
  parseUserBotAction,
  formatReportPreviewMessage,
  formatSubmitSuccessMessage,
} from '@/lib/services/fonnteWebhookUtils';
import { getSystemReminderSettings } from '@/lib/services/systemReminderSettingsService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Fonnte mengirim webhook agak besar; timeout perlu cukup longgar.
export const maxDuration = 60;

/** Tanggal hari ini di WIB */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Kirim pesan WA ke nomor tertentu via Fonnte */
async function replyToUser(phone: string, message: string) {
  try {
    const config = getFoonteConfig();
    const result = await sendFoonteMessage(message, config, fetch, phone);
    if (!result.ok) {
      console.error('[webhook/fonnte] Fonnte menolak balasan:', {
        phone,
        status: result.status,
        response: result.responseBody,
      });
    }
    return result.ok;
  } catch (err) {
    console.error('[webhook/fonnte] Gagal kirim balasan:', err);
    return false;
  }
}

/**
 * Coba cocokkan nomor WA ke user_id dari wa_phone_mappings.
 */
async function findUserByPhone(phone: string) {
  const supabase = createAdminClient();

  const { data: mapping, error } = await supabase
    .from('wa_phone_mappings')
    .select('user_id')
    .eq('phone_number', phone)
    .maybeSingle();

  if (error) {
    console.error('[webhook/fonnte] Gagal mencari mapping nomor:', error);
  }

  if (mapping) return mapping.user_id;

  return null;
}

/**
 * Link nomor WA ke user berdasarkan nama yang dikirim user.
 * Format: "link [nama di HubReminder]"
 */
async function linkPhoneToUser(phone: string, nameInput: string): Promise<{
  userId?: string;
  userName?: string;
  error?: string;
}> {
  const supabase = createAdminClient();
  const searchName = nameInput.trim().toLowerCase();

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('full_name', 'is', null);

  if (profileError) {
    console.error('[webhook/fonnte] Gagal mencari profil untuk proses link:', profileError);
    return { error: 'Gagal memeriksa profil HubReminder. Coba lagi beberapa saat.' };
  }

  if (!profiles?.length) return { error: 'Belum ada peserta yang terdaftar di HubReminder.' };

  // Cocokkan nama secara fuzzy
  const match = profiles.find((p) => {
    const dbName = (p.full_name || '').toLowerCase();
    return dbName === searchName ||
      dbName.includes(searchName) ||
      searchName.includes(dbName);
  });

  if (!match) {
    const availableNames = profiles
      .filter((p) => p.full_name)
      .map((p) => `• ${p.full_name}`)
      .join('\n');
    return {
      error: `Nama "${nameInput}" tidak ditemukan.\n\nDaftar peserta terdaftar:\n${availableNames}\n\nBalas: link [nama lengkap kamu]`,
    };
  }

  const { error: insertError } = await supabase
    .from('wa_phone_mappings')
    .upsert(
      { user_id: match.id, phone_number: phone, linked_at: new Date().toISOString() },
      { onConflict: 'phone_number' },
    );

  if (insertError) {
    console.error('[webhook/fonnte] Gagal simpan mapping:', insertError);
    return { error: 'Gagal menyimpan koneksi nomor WA.' };
  }

  return { userId: match.id, userName: match.full_name || nameInput };
}

/** Robustly extract payload from JSON, FormData, or URL-encoded request body */
async function extractPayload(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      // fallback
    }
  }

  try {
    const formData = await request.formData();
    const result: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      result[key] = value;
    });
    if (Object.keys(result).length > 0) return result;
  } catch {
    // fallback
  }

  try {
    const text = await request.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        const result: Record<string, unknown> = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        if (Object.keys(result).length > 0) return result;
      }
    }
  } catch {
    // fallback
  }

  return {};
}

/**
 * Generate draf laporan menggunakan Gemini AI, simpan ke database dengan status 'waiting_approval',
 * lalu kirim format preview ke WA user untuk meminta persetujuan.
 */
async function generateAndSendDraft(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  phone: string,
  today: string,
  userInput: string,
  profile: { full_name?: string | null; company_name?: string | null; position?: string | null } | null,
  isRegenerated = false,
): Promise<{ ok: boolean; report?: GeneratedReport; error?: string }> {
  await replyToUser(
    phone,
    isRegenerated
      ? '⏳ Sedang meng-generate ulang laporan menggunakan AI...'
      : '⏳ Sedang membuat draf laporan menggunakan AI...',
  );

  const genResult = await generateReport(userInput, {
    name: profile?.full_name,
    company: profile?.company_name,
    position: profile?.position,
  });

  if (genResult.error || !genResult.report) {
    await supabase
      .from('wa_report_sessions')
      .update({
        status: 'failed',
        error_message: genResult.error,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('report_date', today);

    await replyToUser(
      phone,
      `❌ Gagal generate laporan: ${genResult.error}\n\nCoba kirim ulang rincian kegiatan kamu atau balas *ULANG*.`,
    );
    return { ok: false, error: genResult.error };
  }

  const report = genResult.report;

  // Simpan draf laporan dengan status 'waiting_approval' (TIDAK langsung disubmit!)
  const { error: saveError } = await supabase
    .from('wa_report_sessions')
    .update({
      generated_report: report,
      status: 'waiting_approval',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('report_date', today);

  if (saveError) {
    console.error('[webhook/fonnte] Gagal simpan draf waiting_approval:', saveError);
  }

  // Kirim preview laporan ke WhatsApp user untuk konfirmasi/approval
  const previewMsg = formatReportPreviewMessage(report, today, isRegenerated);
  await replyToUser(phone, previewMsg);

  return { ok: true, report };
}

/**
 * Proses submit laporan ke MagangHub setelah disetujui oleh user.
 */
async function submitDraftReport(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  phone: string,
  today: string,
  report: GeneratedReport,
): Promise<{ ok: boolean; error?: string }> {
  await replyToUser(phone, '⏳ Memproses pengiriman laporan ke MagangHub...');

  // 1. Ambil sesi MagangHub user
  const { data: sessionData } = await supabase
    .from('maganghub_sessions')
    .select('encrypted_session, encrypted_refresh_token, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sessionData || sessionData.status === 'expired' || !sessionData.encrypted_session) {
    await supabase
      .from('wa_report_sessions')
      .update({
        status: 'failed',
        error_message: 'Sesi MagangHub expired',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('report_date', today);

    await replyToUser(
      phone,
      `⚠️ Sesi MagangHub kamu sudah kedaluwarsa atau belum terhubung.\n\nSilakan perbarui sesi login MagangHub di:\n${process.env.APP_URL || 'https://hub-reminder.vercel.app'}\n\nSetelah memperbarui sesi, balas *KIRIM* kembali.`,
    );
    return { ok: false, error: 'session_expired' };
  }

  // 2. Dekripsi sesi
  let cookiePlaintext: string;
  try {
    const accessToken = await decryptSessionSecret(sessionData.encrypted_session);
    const refreshToken = sessionData.encrypted_refresh_token
      ? await decryptSessionSecret(sessionData.encrypted_refresh_token)
      : null;
    cookiePlaintext = refreshToken ? JSON.stringify({ accessToken, refreshToken }) : accessToken;
  } catch {
    await supabase
      .from('wa_report_sessions')
      .update({
        status: 'failed',
        error_message: 'Gagal dekripsi sesi',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('report_date', today);

    await replyToUser(
      phone,
      '❌ Gagal mengakses sesi login MagangHub. Coba perbarui sesi di dashboard HubReminder.',
    );
    return { ok: false, error: 'decrypt_failed' };
  }

  // 3. Update status ke submitting
  await supabase
    .from('wa_report_sessions')
    .update({
      status: 'submitting',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('report_date', today);

  // 4. Submit ke MagangHub API
  const submitResult = await submitReportToMagangHub(
    cookiePlaintext,
    report,
    userId,
    (accessToken, refreshToken) => updateSessionTokens(userId, accessToken, refreshToken),
  );

  if (submitResult.ok) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('wa_report_sessions')
      .update({
        status: 'submitted',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('report_date', today);

    await replyToUser(phone, formatSubmitSuccessMessage(report));
    return { ok: true };
  }

  // Submit gagal: kembalikan ke status waiting_approval agar user bisa coba lagi atau copy-paste
  await supabase
    .from('wa_report_sessions')
    .update({
      status: 'waiting_approval',
      error_message: submitResult.error,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('report_date', today);

  if (submitResult.isSessionExpired) {
    await supabase
      .from('maganghub_sessions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  await replyToUser(
    phone,
    `⚠️ Gagal submit otomatis ke MagangHub: ${submitResult.error}\n\n*Kamu bisa copy-paste laporan ini langsung ke MagangHub:*\nhttps://monev.maganghub.kemnaker.go.id/dashboard\n\n*Aktivitas:*\n${report.activity}\n\n*Pelajaran:*\n${report.lesson}\n\n*Kendala:*\n${report.challenge}\n\nAtau periksa koneksi lalu balas *KIRIM* kembali.`,
  );

  return { ok: false, error: submitResult.error };
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'HubReminder Fonnte Webhook (With Approval Flow)',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const payload = await extractPayload(request);
  console.log('[webhook/fonnte] Incoming payload:', JSON.stringify(payload));

  const incoming = parseFoonteIncomingMessage(payload);
  if (!incoming) {
    console.log('[webhook/fonnte] Message skipped (invalid payload or empty content)');
    return NextResponse.json({ ok: true, skipped: 'empty_or_invalid_message' });
  }

  // Cek apakah Bot WhatsApp diaktifkan oleh admin
  let waBotEnabled = true;
  try {
    const adminSettings = await getSystemReminderSettings(createAdminClient());
    waBotEnabled = adminSettings.wa_bot_enabled;
  } catch {
    waBotEnabled = true;
  }

  if (!waBotEnabled) {
    console.log('[webhook/fonnte] Bot WhatsApp dinonaktifkan oleh admin');
    return NextResponse.json({ ok: true, skipped: 'wa_bot_disabled' });
  }

  const { phone, message, isGroup } = incoming;
  console.log('[webhook/fonnte] Parsed incoming:', { phone, message: message.slice(0, 100), isGroup });

  const action = parseUserBotAction(message);

  // Di grup, bot HANYA merespons command yang dikenali.
  // Pesan bebas (obrolan, pertanyaan, dsb) diabaikan diam-diam.
  if (isGroup && action.type === 'report_input') {
    console.log(`[webhook/fonnte] Mengabaikan pesan bebas di grup dari ${phone} (bukan command yang dikenali)`);
    return NextResponse.json({ ok: true, skipped: 'group_non_command_ignored' });
  }

  // === 1. COMMAND: link [nama] ===
  if (action.type === 'link') {
    const result = await linkPhoneToUser(phone, action.name);
    if (result.error) {
      await replyToUser(phone, result.error);
    } else {
      await replyToUser(
        phone,
        `✅ Nomor WA kamu berhasil dihubungkan ke akun *${result.userName}*.\n\nSekarang kamu bisa balas pesan ini kapan saja dengan kegiatan magang kamu untuk membuat draf laporan.\n\nContoh: "hari ini belajar react dan membuat komponen dashboard"`,
      );
    }
    return NextResponse.json({ ok: true, action: 'link' });
  }

  // Cek apakah nomor WA sudah terhubung
  const userId = await findUserByPhone(phone);
  if (!userId) {
    console.log(`[webhook/fonnte] Mengabaikan pesan dari nomor belum terhubung (${phone})`);
    return NextResponse.json({ ok: true, skipped: 'unlinked_user_ignored' });
  }

  const supabase = createAdminClient();
  const today = todayWIB();

  // === 2. COMMAND: status ===
  if (action.type === 'status') {
    const { data: session } = await supabase
      .from('wa_report_sessions')
      .select('status, submitted_at, generated_report')
      .eq('user_id', userId)
      .eq('report_date', today)
      .maybeSingle();

    let statusText: string;
    if (session?.status === 'submitted') {
      statusText = `✅ Laporan hari ini sudah terkirim ke MagangHub pada ${session.submitted_at}.`;
    } else if (session?.status === 'waiting_approval' && session?.generated_report) {
      statusText = `📋 Draf laporan kamu sudah siap dan sedang *menunggu persetujuan*.\n\nPilihan balasan:\n• *KIRIM* ➔ Submit ke MagangHub\n• *ULANG* ➔ Generate ulang AI\n• *EDIT [teks]* ➔ Ubah rincian\n• *BATAL* ➔ Batalkan draf`;
    } else if (session) {
      statusText = `📋 Status laporan hari ini: ${session.status}`;
    } else {
      statusText = '📝 Belum ada laporan hari ini. Balas dengan rincian kegiatan magang kamu untuk membuat draf laporan.';
    }

    await replyToUser(phone, statusText);
    return NextResponse.json({ ok: true, action: 'status' });
  }

  // === 3. COMMAND: batal / batalkan ===
  if (action.type === 'cancel') {
    const { data: session } = await supabase
      .from('wa_report_sessions')
      .select('status')
      .eq('user_id', userId)
      .eq('report_date', today)
      .maybeSingle();

    if (session?.status === 'waiting_approval') {
      await supabase
        .from('wa_report_sessions')
        .update({
          status: 'waiting_input',
          generated_report: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('report_date', today);

      await replyToUser(
        phone,
        '❌ Draf laporan hari ini telah dibatalkan. Kamu bisa mengirimkan kegiatan baru kapan saja.',
      );
      return NextResponse.json({ ok: true, action: 'cancelled' });
    }

    await replyToUser(phone, 'ℹ️ Tidak ada draf laporan aktif yang sedang menunggu persetujuan.');
    return NextResponse.json({ ok: true, action: 'cancel_ignored' });
  }

  // Ambil sesi laporan hari ini
  const { data: existingSession } = await supabase
    .from('wa_report_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('report_date', today)
    .maybeSingle();

  // Jika laporan sudah berstatus 'submitted' hari ini
  if (existingSession?.status === 'submitted') {
    await replyToUser(
      phone,
      '✅ Laporan hari ini sudah terkirim ke MagangHub sebelumnya. Tidak perlu mengisi ulang.',
    );
    return NextResponse.json({ ok: true, action: 'already_submitted' });
  }

  // Ambil profil user untuk konteks Gemini
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, position')
    .eq('id', userId)
    .maybeSingle();

  // === 4. COMMAND: approve (KIRIM / YA / OKE / SETUJU) ===
  if (action.type === 'approve') {
    if (!existingSession || existingSession.status !== 'waiting_approval' || !existingSession.generated_report) {
      await replyToUser(
        phone,
        '⚠️ Tidak ada draf laporan yang sedang menunggu persetujuan hari ini.\n\nKirimkan rincian kegiatan magang kamu terlebih dahulu untuk membuat draf laporan.',
      );
      return NextResponse.json({ ok: true, action: 'approve_no_draft' });
    }

    const submitRes = await submitDraftReport(
      supabase,
      userId,
      phone,
      today,
      existingSession.generated_report as GeneratedReport,
    );
    return NextResponse.json({ ok: submitRes.ok, action: submitRes.ok ? 'submitted' : 'submit_failed' });
  }

  // === 5. COMMAND: regenerate (ULANG / REGEN) ===
  if (action.type === 'regenerate') {
    if (!existingSession || !existingSession.user_input) {
      await replyToUser(
        phone,
        '⚠️ Belum ada kegiatan magang yang tersimpan untuk di-generate ulang. Silakan kirimkan kegiatan magang kamu hari ini.',
      );
      return NextResponse.json({ ok: true, action: 'regenerate_no_input' });
    }

    const genRes = await generateAndSendDraft(
      supabase,
      userId,
      phone,
      today,
      existingSession.user_input,
      profile,
      true,
    );
    return NextResponse.json({ ok: genRes.ok, action: genRes.ok ? 'regenerated' : 'generation_failed' });
  }

  // === 6. COMMAND: edit [isi baru] / revisi [isi baru] ===
  if (action.type === 'edit') {
    if (!action.newContent) {
      await replyToUser(
        phone,
        '✏️ *Cara Mengubah Draf Laporan:*\nBalas pesan dengan format:\n*EDIT [kegiatan baru kamu]*\n\nContoh:\n*EDIT Hari ini saya membuat modul autentikasi dan memperbaiki bug navigasi*',
      );
      return NextResponse.json({ ok: true, action: 'edit_prompt' });
    }

    // Upsert sesi dengan input kegiatan baru
    const { error: upsertError } = await supabase
      .from('wa_report_sessions')
      .upsert(
        {
          user_id: userId,
          wa_number: phone,
          report_date: today,
          user_input: action.newContent,
          status: 'generating',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,report_date' },
      );

    if (upsertError) {
      console.error('[webhook/fonnte] Gagal upsert session edit:', upsertError);
      await replyToUser(phone, '❌ Terjadi kesalahan saat memproses masukan kamu. Coba lagi nanti.');
      return NextResponse.json({ ok: false, error: 'session_upsert_failed' }, { status: 500 });
    }

    const genRes = await generateAndSendDraft(
      supabase,
      userId,
      phone,
      today,
      action.newContent,
      profile,
      false,
    );
    return NextResponse.json({ ok: genRes.ok, action: genRes.ok ? 'edited' : 'generation_failed' });
  }

  // === 7. INPUT KEGIATAN: Buat draf baru & tunggu persetujuan user ===
  const inputMessage = action.content;
  const { error: upsertError } = await supabase
    .from('wa_report_sessions')
    .upsert(
      {
        user_id: userId,
        wa_number: phone,
        report_date: today,
        user_input: inputMessage,
        status: 'generating',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,report_date' },
    );

  if (upsertError) {
    console.error('[webhook/fonnte] Gagal upsert session input:', upsertError);
    await replyToUser(phone, '❌ Terjadi kesalahan saat memproses pesan kamu. Coba lagi nanti.');
    return NextResponse.json({ ok: false, error: 'session_upsert_failed' }, { status: 500 });
  }

  const genRes = await generateAndSendDraft(
    supabase,
    userId,
    phone,
    today,
    inputMessage,
    profile,
    false,
  );

  return NextResponse.json({ ok: genRes.ok, action: genRes.ok ? 'draft_created' : 'generation_failed' });
}
