import { describe, it, expect } from 'vitest';
import { evaluateReminder } from '@/lib/attendance/evaluator';
import type { ReminderSettings, NotificationLog } from '@/lib/types/reminder';

describe('evaluateReminder()', () => {
  const baseSettings: ReminderSettings = {
    user_id: 'test-user',
    enabled: true,
    max_reminders_per_day: 3,
    interval_minutes: 60,
    active_start_time: '08:00',
    active_end_time: '20:00',
    snooze_until: null,
    updated_at: new Date().toISOString(),
  };

  it('harus menolak kirim reminder bila enabled = false', () => {
    const res = evaluateReminder({
      settings: { ...baseSettings, enabled: false },
      sentLogsToday: [],
    });
    expect(res.shouldSend).toBe(false);
    expect(res.reason).toBe('reminder_disabled');
  });

  it('harus menolak kirim reminder jika sedang di-snooze hari ini', () => {
    // Current time: 10:00 di 2026-10-01
    const testDate = new Date('2026-10-01T10:00:00+08:00');
    const res = evaluateReminder({
      settings: { ...baseSettings, snooze_until: '2026-10-01' },
      sentLogsToday: [],
      currentTime: testDate,
      timezone: 'Asia/Makassar',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.reason).toBe('snoozed_for_today');
  });

  it('harus menolak kirim reminder di luar jam aktif', () => {
    // Jam 06:00 (sebelum jam 08:00)
    const earlyMorning = new Date('2026-10-01T06:00:00+08:00');
    const res = evaluateReminder({
      settings: baseSettings,
      sentLogsToday: [],
      currentTime: earlyMorning,
      timezone: 'Asia/Makassar',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.reason).toBe('outside_active_hours');
  });

  it('harus menolak kirim reminder jika kuota harian telah habis', () => {
    const mockLogs: NotificationLog[] = [
      { id: '1', user_id: 'u1', sent_at: '2026-10-01T08:00:00Z', status_at_send: 'belum_lapor', sequence_today: 1 },
      { id: '2', user_id: 'u1', sent_at: '2026-10-01T10:00:00Z', status_at_send: 'belum_lapor', sequence_today: 2 },
      { id: '3', user_id: 'u1', sent_at: '2026-10-01T12:00:00Z', status_at_send: 'belum_lapor', sequence_today: 3 },
    ];
    const afternoon = new Date('2026-10-01T14:00:00+08:00');

    const res = evaluateReminder({
      settings: baseSettings, // max_reminders_per_day = 3
      sentLogsToday: mockLogs,
      currentTime: afternoon,
      timezone: 'Asia/Makassar',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.reason).toBe('max_daily_quota_reached');
  });

  it('harus menolak kirim reminder jika interval jeda belum terpenuhi', () => {
    // Terakhir kirim 15 menit yang lalu (padahal interval_minutes = 60)
    const lastSent = new Date('2026-10-01T10:00:00Z');
    const now = new Date('2026-10-01T10:15:00Z');

    const mockLogs: NotificationLog[] = [
      { id: '1', user_id: 'u1', sent_at: lastSent.toISOString(), status_at_send: 'belum_lapor', sequence_today: 1 },
    ];

    const res = evaluateReminder({
      settings: baseSettings,
      sentLogsToday: mockLogs,
      currentTime: now,
      timezone: 'Asia/Makassar',
    });
    expect(res.shouldSend).toBe(false);
    expect(res.reason).toContain('interval_not_met');
  });

  it('harus mengizinkan pengiriman reminder jika semua kondisi terpenuhi', () => {
    // Terakhir kirim 90 menit yang lalu (interval_minutes = 60) dan dalam jam aktif (11:30)
    const lastSent = new Date('2026-10-01T02:00:00Z'); // 10:00 WITA
    const now = new Date('2026-10-01T03:30:00Z');      // 11:30 WITA

    const mockLogs: NotificationLog[] = [
      { id: '1', user_id: 'u1', sent_at: lastSent.toISOString(), status_at_send: 'belum_lapor', sequence_today: 1 },
    ];

    const res = evaluateReminder({
      settings: baseSettings,
      sentLogsToday: mockLogs,
      currentTime: now,
      timezone: 'Asia/Makassar',
    });
    expect(res.shouldSend).toBe(true);
    expect(res.reason).toBe('eligible');
  });
});
