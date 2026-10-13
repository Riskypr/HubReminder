import { describe, it, expect } from 'vitest';
import { isParticipantReminderDue } from '@/app/api/cron/reminder/route';

describe('isParticipantReminderDue()', () => {
  const baseSettings = {
    user_id: 'user-1',
    enabled: true,
    max_reminders_per_day: 3,
    interval_seconds: 3600,
    interval_minutes: 60,
    reminder_times: ['08:00'],
    snooze_until: null,
  };

  it('menolak pengiriman jika reminder dinonaktifkan oleh pengguna (enabled = false)', () => {
    const now = new Date('2026-10-13T08:00:00+07:00');
    const result = isParticipantReminderDue({
      settings: { ...baseSettings, enabled: false },
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [],
      now,
    });
    expect(result).toBe(false);
  });

  it('menolak pengiriman jika pengguna sedang snooze hari ini', () => {
    const now = new Date('2026-10-13T08:00:00+07:00');
    const result = isParticipantReminderDue({
      settings: { ...baseSettings, snooze_until: '2026-10-13' },
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [],
      now,
    });
    expect(result).toBe(false);
  });

  it('menolak pengiriman jika waktu saat ini belum mencapai jadwal reminder pengguna', () => {
    // Pengguna atur jam 08:00, waktu sekarang jam 07:45
    const now = new Date('2026-10-13T07:45:00+07:00');
    const result = isParticipantReminderDue({
      settings: baseSettings, // reminder_times: ['08:00']
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [],
      now,
    });
    expect(result).toBe(false);
  });

  it('mengizinkan pengiriman saat waktu pengingat pertama telah tiba', () => {
    // Pengguna atur jam 08:00, waktu sekarang jam 08:00
    const now = new Date('2026-10-13T08:00:00+07:00');
    const result = isParticipantReminderDue({
      settings: baseSettings,
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [],
      now,
    });
    expect(result).toBe(true);
  });

  it('tetap mengizinkan pengiriman jika cron terpanggil beberapa menit setelah jadwal (toleransi delay)', () => {
    // Pengguna atur jam 08:00, cron terpanggil jam 08:02
    const now = new Date('2026-10-13T08:02:00+07:00');
    const result = isParticipantReminderDue({
      settings: baseSettings,
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [],
      now,
    });
    expect(result).toBe(true);
  });

  it('menolak pengiriman jika interval jeda belum terpenuhi sejak pengiriman terakhir', () => {
    // Pengiriman pertama jam 08:00, sekarang jam 08:30 (interval 60 menit)
    const lastSent = '2026-10-13T08:00:00+07:00';
    const now = new Date('2026-10-13T08:30:00+07:00');
    const result = isParticipantReminderDue({
      settings: baseSettings,
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [{ user_id: 'user-1', sent_at: lastSent }],
      now,
    });
    expect(result).toBe(false);
  });

  it('tidak mengirimkan pengulangan pengingat jika checkpoint jadwal telah terpenuhi (tidak spam berulang)', () => {
    // Pengiriman pertama jam 08:00, sekarang jam 09:05 (lewat 65 menit)
    // Karena jadwal pengguna hanya ['08:00'] dan sudah terkirim pada jam 08:00, tidak boleh dikirim ulang berulang kali
    const lastSent = '2026-10-13T08:00:00+07:00';
    const now = new Date('2026-10-13T09:05:00+07:00');
    const result = isParticipantReminderDue({
      settings: baseSettings,
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [{ user_id: 'user-1', sent_at: lastSent }],
      now,
    });
    expect(result).toBe(false);
  });

  it('mengizinkan eksekusi pengingat saat jam jadwal baru tiba meskipun interval sejak log lama belum 60 menit', () => {
    // Pengguna sebelumnya mendapat reminder/test jam 08:15, lalu mengubah jadwal reminder ke 08:30.
    // Pada jam 08:30 (hanya berselang 15 menit), reminder tetap harus dieksekusi karena checkpoint 08:30 belum pernah dilayani.
    const lastSent = '2026-10-13T08:15:00+07:00';
    const now = new Date('2026-10-13T08:30:00+07:00');
    const result = isParticipantReminderDue({
      settings: { ...baseSettings, reminder_times: ['08:30'] },
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: [{ user_id: 'user-1', sent_at: lastSent }],
      now,
    });
    expect(result).toBe(true);
  });

  it('menolak pengiriman jika kuota harian maksimum telah tercapai', () => {
    const now = new Date('2026-10-13T12:00:00+07:00');
    const logs = [
      { user_id: 'user-1', sent_at: '2026-10-13T08:00:00+07:00' },
      { user_id: 'user-1', sent_at: '2026-10-13T09:00:00+07:00' },
      { user_id: 'user-1', sent_at: '2026-10-13T10:00:00+07:00' },
    ];
    const result = isParticipantReminderDue({
      settings: { ...baseSettings, max_reminders_per_day: 3 },
      userTimezone: 'Asia/Jakarta',
      userTodayLogs: logs,
      now,
    });
    expect(result).toBe(false);
  });

  it('mengikuti beberapa waktu checkpoint spesifik yang diatur pengguna', () => {
    const multiTimeSettings = {
      ...baseSettings,
      reminder_times: ['08:00', '13:00', '17:00'],
      max_reminders_per_day: 3,
    };

    // 1. Jam 07:30 -> belum ada checkpoint tiba
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [],
        now: new Date('2026-10-13T07:30:00+07:00'),
      })
    ).toBe(false);

    // 2. Jam 08:00 -> checkpoint pertama (08:00) tiba
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [],
        now: new Date('2026-10-13T08:00:00+07:00'),
      })
    ).toBe(true);

    // 3. Jam 10:00 setelah 1 pesan terkirim jam 08:00 -> belum jam 13:00
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [{ user_id: 'user-1', sent_at: '2026-10-13T08:00:00+07:00' }],
        now: new Date('2026-10-13T10:00:00+07:00'),
      })
    ).toBe(false);

    // 4. Jam 13:00 -> checkpoint kedua (13:00) tiba
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [{ user_id: 'user-1', sent_at: '2026-10-13T08:00:00+07:00' }],
        now: new Date('2026-10-13T13:00:00+07:00'),
      })
    ).toBe(true);

    // 5. Jam 15:00 setelah 2 pesan terkirim -> belum jam 17:00
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [
          { user_id: 'user-1', sent_at: '2026-10-13T08:00:00+07:00' },
          { user_id: 'user-1', sent_at: '2026-10-13T13:00:00+07:00' },
        ],
        now: new Date('2026-10-13T15:00:00+07:00'),
      })
    ).toBe(false);

    // 6. Jam 17:00 -> checkpoint ketiga (17:00) tiba
    expect(
      isParticipantReminderDue({
        settings: multiTimeSettings,
        userTimezone: 'Asia/Jakarta',
        userTodayLogs: [
          { user_id: 'user-1', sent_at: '2026-10-13T08:00:00+07:00' },
          { user_id: 'user-1', sent_at: '2026-10-13T13:00:00+07:00' },
        ],
        now: new Date('2026-10-13T17:00:00+07:00'),
      })
    ).toBe(true);
  });

  it('mendukung zona waktu pengguna WITA (Asia/Makassar) secara tepat', () => {
    // Pengguna di WITA atur jam 08:00 WITA.
    // Jam 08:00 WITA adalah jam 07:00 WIB (00:00 UTC).
    const now0800Wita = new Date('2026-10-13T08:00:00+08:00');
    const result = isParticipantReminderDue({
      settings: baseSettings, // reminder_times: ['08:00']
      userTimezone: 'Asia/Makassar',
      userTodayLogs: [],
      now: now0800Wita,
    });
    expect(result).toBe(true);

    // Pada jam 07:30 WITA, belum tiba
    const now0730Wita = new Date('2026-10-13T07:30:00+08:00');
    expect(
      isParticipantReminderDue({
        settings: baseSettings,
        userTimezone: 'Asia/Makassar',
        userTodayLogs: [],
        now: now0730Wita,
      })
    ).toBe(false);
  });
});
