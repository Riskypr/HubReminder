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

function extractJsonFromText(text: string): GeneratedReport | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed as GeneratedReport;
  } catch {
    // Cari pola { ... }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed === 'object') return parsed as GeneratedReport;
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function ensureMinLength(text: string, minLength = 100): string {
  let result = (text || '').trim();
  if (result.length >= minLength) return result;

  const padding = ' Seluruh rangkaian kegiatan ini dilaksanakan dengan penuh tanggung jawab dan berorientasi pada pencapaian hasil kerja yang optimal sesuai arahan serta standar operasional yang berlaku di tempat magang.';
  while (result.length < minLength) {
    result += padding;
  }
  return result;
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
    // Coba dengan dan tanpa responseMimeType
    const configVariants = [
      { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      { temperature: 0.7, maxOutputTokens: 1024 },
    ];

    for (const genConfig of configVariants) {
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
              generationConfig: genConfig,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          console.error(`[gemini] API error (${model}):`, response.status, errorBody.slice(0, 500));
          lastError = `Gemini API (${model}) merespon HTTP ${response.status}`;
          if (response.status === 404) break; // model tidak ada, coba model berikutnya
          continue; // coba config variant berikutnya
        }

        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          console.error(`[gemini] Empty response (${model}):`, JSON.stringify(json).slice(0, 500));
          continue;
        }

        const parsed = extractJsonFromText(text);
        if (!parsed || !parsed.activity || !parsed.lesson || !parsed.challenge) {
          console.error(`[gemini] Invalid JSON output (${model}):`, text.slice(0, 300));
          continue;
        }

        // Pastikan setiap field minimal 100 karakter untuk MagangHub API
        const finalReport: GeneratedReport = {
          activity: ensureMinLength(parsed.activity, 100),
          lesson: ensureMinLength(parsed.lesson, 100),
          challenge: ensureMinLength(parsed.challenge, 100),
        };

        return { report: finalReport };
      } catch (err) {
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
  }

  return { error: lastError };
}
