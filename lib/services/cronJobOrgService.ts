const API_URL = 'https://api.cron-job.org';

export type CronJobOrgSchedule = {
  timezone: string;
  hours: number[];
  minutes: number[];
  mdays: number[];
  months: number[];
  wdays: number[];
  expiresAt: number;
};

export type CronJobOrgJob = {
  enabled: boolean;
  title: string;
  url: string;
  saveResponses: boolean;
  requestMethod: 0 | 1;
  requestTimeout: number;
  schedule: CronJobOrgSchedule;
  extendedData: { headers: Record<string, string> };
};

type CronJobOrgResponse = { jobId?: number; error?: string; message?: string };
type Fetcher = typeof fetch;

export type CronJobOrgConfig = {
  apiKey: string;
  jobId?: number;
};

export function getCronJobOrgConfig(): CronJobOrgConfig | null {
  const apiKey = process.env.CRON_JOB_ORG_API_KEY;
  if (!apiKey) return null;

  const rawJobId = process.env.CRON_JOB_ORG_JOB_ID;
  const jobId = rawJobId ? Number(rawJobId) : undefined;
  if (rawJobId && (!Number.isSafeInteger(jobId) || jobId <= 0)) {
    throw new Error('CRON_JOB_ORG_JOB_ID harus berupa bilangan bulat positif');
  }
  return { apiKey, jobId };
}

/** Payload job cron-job.org untuk endpoint reminder aplikasi. */
export function createReminderCronJob(url: string, secret: string): CronJobOrgJob {
  return {
    enabled: true,
    title: 'HubReminder - Reminder WhatsApp',
    url,
    saveResponses: true,
    requestMethod: 1,
    requestTimeout: 30,
    schedule: {
      timezone: process.env.CRON_REMINDER_TIMEZONE ?? 'Asia/Jakarta',
      // cron-job.org is the polling clock. The application evaluates each
      // user's reminder_times and interval on every run.
      hours: [-1],
      minutes: [-1],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
      expiresAt: 0,
    },
    extendedData: { headers: { 'X-Cron-Secret': secret } },
  };
}

/** Buat job baru atau perbarui job yang ID-nya tersimpan di environment. */
export async function upsertCronJobOrgJob(
  job: CronJobOrgJob,
  config: CronJobOrgConfig,
  fetcher: Fetcher = fetch,
): Promise<{ jobId: number; created: boolean }> {
  const endpoint = config.jobId ? `${API_URL}/jobs/${config.jobId}` : `${API_URL}/jobs`;
  const response = await fetcher(endpoint, {
    method: config.jobId ? 'PATCH' : 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ job }),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => ({}))) as CronJobOrgResponse;
  if (!response.ok) {
    throw new Error(body.message || body.error || `cron-job.org merespons HTTP ${response.status}`);
  }
  if (config.jobId) return { jobId: config.jobId, created: false };
  if (!Number.isSafeInteger(body.jobId) || !body.jobId) {
    throw new Error('cron-job.org tidak mengembalikan jobId');
  }
  return { jobId: body.jobId, created: true };
}
