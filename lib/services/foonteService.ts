export interface FoonteConfig {
  apiToken: string;
  groupId: string;
}

/** Targets Foonte server-side: optional comma-separated numbers/groups, else the configured default group. */
export function getFoonteTargets(env = process.env): string[] {
  const configuredTargets = (env.FOONTE_WA_TARGETS ?? '').split(/[\n,]/).map((target) => target.trim()).filter(Boolean);
  const targets = configuredTargets.length ? configuredTargets : [env.FOONTE_WA_GROUP_ID ?? ''].filter(Boolean);
  return [...new Set(targets.map((target) => target.replace(/^\+/, '')))];
}

export interface FoonteSendResult {
  ok: boolean;
  status: number;
  responseBody: string;
}

const FOONTE_SEND_URL = 'https://api.fonnte.com/send';
const REQUEST_TIMEOUT_MS = 4_000;

export function getFoonteConfig(env = process.env): FoonteConfig {
  const apiToken = env.FOONTE_API_TOKEN;
  const groupId = env.FOONTE_WA_GROUP_ID ?? '';
  if (!apiToken) {
    throw new Error('FOONTE_API_TOKEN wajib dikonfigurasi');
  }
  return { apiToken, groupId };
}

/** Kirim teks reminder ke nomor WhatsApp atau grup melalui Foonte (Fonnte). */
export async function sendFoonteMessage(
  message: string,
  config: FoonteConfig,
  fetcher: typeof fetch = fetch,
  target = config.groupId,
): Promise<FoonteSendResult> {
  if (!target) return { ok: false, status: 0, responseBody: 'target_not_configured' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(FOONTE_SEND_URL, {
      method: 'POST',
      headers: { Authorization: config.apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message, countryCode: '62' }),
      signal: controller.signal,
    });
    const responseBody = (await response.text()).slice(0, 1_000);
    // Fonnte selalu membalas HTTP 200 meski token/target salah; status asli ada di body JSON.
    let providerRejected = false;
    try {
      providerRejected = JSON.parse(responseBody)?.status === false;
    } catch {
      providerRejected = false;
    }
    return { ok: response.ok && !providerRejected, status: response.status, responseBody };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'request_timeout' : 'request_failed';
    return { ok: false, status: 0, responseBody: reason };
  } finally {
    clearTimeout(timeout);
  }
}
