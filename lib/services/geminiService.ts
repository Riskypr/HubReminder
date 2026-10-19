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

export function buildPrompt(
  userInput: string,
  profile: {
    name?: string | null;
    company?: string | null;
    position?: string | null;
  },
): string {
  const profileContext = [
    profile.name ? `Nama: ${profile.name}` : null,
    profile.company ? `Perusahaan/Instansi: ${profile.company}` : null,
    profile.position ? `Posisi/Divisi: ${profile.position}` : null,
  ].filter(Boolean).join('\n');

  return `Kamu adalah seorang ahli penulis laporan kegiatan profesional yang membantu peserta magang menyusun laporan harian untuk platform MagangHub Kemnaker.

Profil Peserta:
${profileContext || 'Tidak ada informasi profil tersedia.'}

Input Singkat dari Peserta mengenai Kegiatan Hari Ini:
"${userInput}"

Tugas Utama:
Ubahlah input singkat peserta di atas menjadi narasi laporan harian formal, alami, profesional, dan mengalir seperti tulisan manusia profesional.

Susun keluaran dalam format JSON dengan struktur persis berikut:
{
  "activity": "Uraian kegiatan lengkap dan kronologis",
  "lesson": "Ilmu, pemahaman teknis, dan keterampilan yang diperoleh",
  "challenge": "Uraian kendala/hambatan beserta penanganan atau pernyataan kelancaran kegiatan"
}

Pedoman Penulisan untuk Setiap Field:

1. Field "activity" (Uraian Kegiatan):
   - Gunakan gaya bahasa naratif kronologis (misal: "Rangkaian kegiatan magang saya di [Nama Perusahaan/Instansi] pada hari ini diawali dengan... Pada sesi pagi... Dilanjutkan pada siang/sore hari...").
   - Cantumkan lokasi, jenis tugas, atau objek pekerjaan secara rinci berdasarkan input peserta dan profil.
   - Ceritakan alur dari pelaksanaan/pengambilan data/eksekusi hingga tahap penyelesaian, pengecekan, atau penginputan (submit) data ke sistem.
   - Minimal 100 karakter.

2. Field "lesson" (Ilmu & Pengetahuan yang Diperoleh):
   - Jelaskan pemahaman teknis, alur kerja, pentingnya validasi/ketelitian/pemeriksaan data (clean data), serta aspek akuntabilitas.
   - Hubungkan tugas yang dikerjakan dengan nilai atau pembelajaran profesional yang didapatkan.
   - Minimal 100 karakter.

3. Field "challenge" (Kendala dan Hambatan):
   - Boleh menyatakan bahwa kegiatan berjalan lancar tanpa hambatan berarti jika input tidak menyebutkan masalah mendasar.
   - Jika ada hambatan, jelaskan secara positif beserta upaya perbaikan/solusinya.
   - Gunakan kalimat seperti: "Secara keseluruhan... berjalan dengan lancar... tidak mengalami kendala yang berarti baik saat berinteraksi dengan responden/rekan kerja maupun saat submit data."
   - Minimal 100 karakter.

Ketentuan Format Output:
- HANYA kembalikan JSON valid tanpa tag markdown (\`\`\`json), tanpa kata pengantar, dan tanpa penjelasan tambahan.
- Bahasa Indonesia baku, formal, natural, dan mudah dipahami.
- Jangan mengada-ada informasi utama yang berlawanan dengan input peserta.`;
}

export function extractJsonFromText(text: string): GeneratedReport | null {
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

export function ensureMinLength(text: string, minLength = 100): string {
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
    new Set([configuredModel, 'gemini-3.5-flash-lite', 'gemini-3.8-flash'].filter(Boolean)),
  ) as string[];

  const prompt = buildPrompt(userInput, profile);

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
