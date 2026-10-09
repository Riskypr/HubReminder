import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SYSTEM_REMINDER_SETTINGS,
  getSystemReminderSettings,
  isReminderAdmin,
} from '@/lib/services/systemReminderSettingsService';

describe('SystemReminderSettings Service', () => {
  it('has default settings with reminder_together_enabled and wa_bot_enabled active', () => {
    expect(DEFAULT_SYSTEM_REMINDER_SETTINGS.reminder_together_enabled).toBe(true);
    expect(DEFAULT_SYSTEM_REMINDER_SETTINGS.wa_bot_enabled).toBe(true);
    expect(DEFAULT_SYSTEM_REMINDER_SETTINGS.reminder_mode).toBe('bulk');
    expect(DEFAULT_SYSTEM_REMINDER_SETTINGS.max_reminders_per_day).toBe(10);
  });

  it('correctly checks isReminderAdmin from environment variable', () => {
    process.env.REMINDER_ADMIN_EMAILS = 'admin@example.com, super@example.com ';
    expect(isReminderAdmin('admin@example.com')).toBe(true);
    expect(isReminderAdmin('ADMIN@EXAMPLE.COM')).toBe(true);
    expect(isReminderAdmin('super@example.com')).toBe(true);
    expect(isReminderAdmin('user@example.com')).toBe(false);
    expect(isReminderAdmin(null)).toBe(false);
  });

  it('falls back to default settings when database has no row', async () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    };

    const settings = await getSystemReminderSettings(mockClient as any);
    expect(settings).toEqual(DEFAULT_SYSTEM_REMINDER_SETTINGS);
  });

  it('reads disabled states for reminder_together_enabled and wa_bot_enabled from database', async () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: true,
                reminder_together_enabled: false,
                wa_bot_enabled: false,
                reminder_mode: 'bulk',
                start_time: '09:00',
                interval_seconds: 3600,
                cookie_warning_count: 5,
                cookie_warning_interval_minutes: 30,
                max_reminders_per_day: 15,
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    const settings = await getSystemReminderSettings(mockClient as any);
    expect(settings.reminder_together_enabled).toBe(false);
    expect(settings.wa_bot_enabled).toBe(false);
    expect(settings.start_time).toBe('09:00');
  });
});
