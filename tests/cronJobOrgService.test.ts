import { describe, expect, it, vi } from 'vitest';
import { createAttendanceCheckCronJob, createReminderCronJob, upsertCronJobOrgJob } from '@/lib/services/cronJobOrgService';

describe('cron-job.org service', () => {
  it('membuat payload POST per menit dengan header rahasia', () => {
    const job = createReminderCronJob('https://app.example.com/api/cron/reminder', 'rahasia');
    expect(job).toMatchObject({
      url: 'https://app.example.com/api/cron/reminder',
      requestMethod: 1,
      schedule: { timezone: 'Asia/Jakarta', hours: [-1], minutes: [-1] },
      extendedData: { headers: { 'X-Cron-Secret': 'rahasia' } },
    });
  });

  it('membuat payload pemeriksaan status setiap 15 menit', () => {
    const job = createAttendanceCheckCronJob('https://app.example.com/api/cron/attendance', 'rahasia');
    expect(job).toMatchObject({
      url: 'https://app.example.com/api/cron/attendance',
      requestMethod: 1,
      schedule: { timezone: 'Asia/Jakarta', hours: [-1], minutes: [0, 15, 30, 45] },
      extendedData: { headers: { 'X-Cron-Secret': 'rahasia' } },
    });
  });

  it('membuat job baru bila jobId belum tersedia', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"jobId":123}', { status: 200 }));
    const result = await upsertCronJobOrgJob(createReminderCronJob('https://app.example.com/api/cron/reminder', 'rahasia'), { apiKey: 'api-key' }, fetcher);
    expect(result).toEqual({ jobId: 123, created: true });
    expect(fetcher).toHaveBeenCalledWith('https://api.cron-job.org/jobs', expect.objectContaining({ method: 'PUT' }));
  });

  it('memperbarui job yang telah ada', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const result = await upsertCronJobOrgJob(createReminderCronJob('https://app.example.com/api/cron/reminder', 'rahasia'), { apiKey: 'api-key', jobId: 123 }, fetcher);
    expect(result).toEqual({ jobId: 123, created: false });
    expect(fetcher).toHaveBeenCalledWith('https://api.cron-job.org/jobs/123', expect.objectContaining({ method: 'PATCH' }));
  });
});
