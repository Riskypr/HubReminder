// lib/services/geminiService.ts
// Generate laporan magang menggunakan Gemini AI dari input singkat user.
// PENTING: API key hanya diakses server-side.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30_000;

export interface GeneratedReport {
  activity: string;    // Uraian Aktivitas (min 100 char)
  lesson: string;      // Pelajaran yang Diperoleh (min 100 char)
  challenge: string;   // Kendala yang Dialami (min 100 char)
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY belum dikonfigurasi');
  return key;
}

/**
 * Generate laporan magang lengkap dari input singkat user.
 * Menggunakan data profil untuk konteks yang relevan.
 */
export async function generateReport(
  userInput: string,
  profile: {
    name?: string | null;
    company?: string | null;
    position?: string | null;
  },
): Promise<{ report?: GeneratedReport; error?: string }> {
  const apiKey = getApiKey();
  const configuredModel = process.env.GEMINI_MODEL;
  const candidateModels = Array.from(
    new Set([configuredModel, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'].filter(Boolean)),
  ) as string[];

  const profileContext = [
    profile.name ? `Nama: ${profile.name}` : null,
    profile.company ? `Perusahaan/Instansi: ${profile.company}` : null,
    profile.position ? `Posisi/Divisi: ${profile.position}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `Kamu adalah asisten yang membantu peserta magang menulis laporan harian untuk platform MagangHub Kemnaker.

Profil Peserta:
${profileContext || 'Tidak ada informasi profil tersedia.'}

Input dari peserta tentang kegiatan hari ini:
"${userInput}"

Buatkan laporan harian magang dengan format JSON berikut. Setiap bagian harus MINIMAL 100 karakter dan ditulis dalam Bahasa Indonesia yang baik dan profesional.

{
  "activity": "Uraian detail aktivitas/pekerjaan yang dilakukan hari ini berdasarkan input peserta. Jelaskan secara rinci langkah-langkah dan proses kerja yang dilakukan.",
  "lesson": "Pelajaran dan insight yang diperoleh dari aktivitas hari ini. Sertakan skill atau pengetahuan baru yang didapat.",
  "challenge": "Kendala atau tantangan yang dihadapi selama melakukan aktivitas tersebut, serta bagaimana mengatasinya."
}

PENTING:
- Jawab HANYA dengan JSON valid, tanpa markdown code block, tanpa penjelasan tambahan.
- Setiap field minimal 100 karakter.
- Gunakan bahasa formal tapi natural, jangan terlalu kaku.
- Buat relevan dengan input peserta dan profilnya.
- Jangan mengada-ada kegiatan yang tidak disebutkan.`;

  let lastError = 'Gagal menghubungi Gemini API';

  for (const model of candidateModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[gemini] API error (${model}):`, response.status, errorBody.slice(0, 500));
        lastError = `Gemini API (${model}) merespon HTTP ${response.status}`;
        // Jika 404 (model tidak ditemukan), coba model berikutnya
        if (response.status === 404) continue;
        return { error: lastError };
      }

      const json = await response.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error(`[gemini] Empty response (${model}):`, JSON.stringify(json).slice(0, 500));
        return { error: 'Gemini tidak menghasilkan respons' };
      }

      // Parse JSON dari respons Gemini
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned) as GeneratedReport;

      // Validasi minimal
      if (!parsed.activity || !parsed.lesson || !parsed.challenge) {
        return { error: 'Respons Gemini tidak lengkap (activity/lesson/challenge kosong)' };
      }

      return { report: parsed };
    } catch (err) {
      if (err instanceof SyntaxError) {
        return { error: 'Gagal mem-parse respons JSON dari Gemini' };
      }
      const error = err as Error;
      if (error.name === 'AbortError') {
        return { error: 'Timeout saat menghubungi Gemini AI (30s)' };
      }
      console.error(`[gemini] Exception (${model}):`, error.message);
      lastError = `Gagal generate laporan: ${error.message}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { error: lastError };

}
