// components/settings/ReminderSettingsForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import type { ReminderSettings } from '@/lib/types/reminder';

const schema = z
  .object({
    enabled: z.boolean(),
    max_reminders_per_day: z.number().int().min(1).max(20),
    interval_minutes: z.number().int().min(15).max(480),
    active_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
    active_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
    snooze_today: z.boolean(),
  })
  .refine((d) => d.active_start_time < d.active_end_time, {
    message: 'Jam mulai harus lebih awal dari jam selesai',
    path: ['active_end_time'],
  });

type FormValues = z.infer<typeof schema>;

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 menit' },
  { value: 30, label: '30 menit' },
  { value: 60, label: '1 jam' },
  { value: 90, label: '1,5 jam' },
  { value: 120, label: '2 jam' },
];

interface Props {
  initialSettings: ReminderSettings;
}

export default function ReminderSettingsForm({ initialSettings }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSnoozedToday = initialSettings.snooze_until === todayStr;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: initialSettings.enabled,
      max_reminders_per_day: initialSettings.max_reminders_per_day,
      interval_minutes: initialSettings.interval_minutes,
      active_start_time: initialSettings.active_start_time,
      active_end_time: initialSettings.active_end_time,
      snooze_today: isSnoozedToday,
    },
  });

  const enabled = watch('enabled');

  async function onSubmit(values: FormValues) {
    setSaved(false);
    setSaveError(null);
    const res = await fetch('/api/settings/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        snooze_until: values.snooze_today ? todayStr : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? 'Gagal menyimpan pengaturan');
    } else {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-label="Form pengaturan reminder">
      {/* Toggle aktifkan reminder */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">Aktifkan Reminder</p>
          <p className="text-xs text-text-muted mt-0.5">Kirim notifikasi saat laporan belum diisi</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer" htmlFor="toggle-enabled">
          <input
            id="toggle-enabled"
            type="checkbox"
            className="sr-only peer"
            {...register('enabled')}
          />
          <div className="w-11 h-6 bg-border rounded-full peer
                          peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/40
                          after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                          after:bg-white after:rounded-full after:h-5 after:w-5
                          after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      {/* Pengaturan detail — tampil saat enabled */}
      {enabled && (
        <>
          {/* Maks reminder per hari */}
          <div className="card space-y-3">
            <label htmlFor="max-reminders" className="label">
              Maks. reminder per hari
            </label>
            <div className="flex items-center gap-4">
              <input
                id="max-reminders"
                type="range"
                min={1}
                max={10}
                step={1}
                className="flex-1 accent-primary h-2 cursor-pointer"
                {...register('max_reminders_per_day', { valueAsNumber: true })}
              />
              <span className="text-sm font-semibold text-primary w-6 text-center">
                {watch('max_reminders_per_day')}x
              </span>
            </div>
            {errors.max_reminders_per_day && (
              <p className="text-xs text-red-600">{errors.max_reminders_per_day.message}</p>
            )}
          </div>

          {/* Interval */}
          <div className="card space-y-2">
            <label htmlFor="interval" className="label">
              Interval antar reminder
            </label>
            <select
              id="interval"
              className="input"
              {...register('interval_minutes', { valueAsNumber: true })}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Jam aktif */}
          <div className="card space-y-3">
            <p className="label">Jam aktif reminder</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-time" className="text-xs text-text-muted mb-1 block">
                  Mulai
                </label>
                <input
                  id="start-time"
                  type="time"
                  className="input"
                  {...register('active_start_time')}
                />
                {errors.active_start_time && (
                  <p className="text-xs text-red-600 mt-1">{errors.active_start_time.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="end-time" className="text-xs text-text-muted mb-1 block">
                  Selesai
                </label>
                <input
                  id="end-time"
                  type="time"
                  className="input"
                  {...register('active_end_time')}
                />
                {errors.active_end_time && (
                  <p className="text-xs text-red-600 mt-1">{errors.active_end_time.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Snooze hari ini */}
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Tunda hari ini</p>
              <p className="text-xs text-text-muted mt-0.5">Nonaktifkan reminder untuk hari ini saja</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer" htmlFor="snooze-today">
              <input
                id="snooze-today"
                type="checkbox"
                className="sr-only peer"
                {...register('snooze_today')}
              />
              <div className="w-11 h-6 bg-border rounded-full peer
                              peer-checked:bg-warning peer-focus:ring-2 peer-focus:ring-warning/40
                              after:content-[''] after:absolute after:top-0.5 after:left-[2px]
                              after:bg-white after:rounded-full after:h-5 after:w-5
                              after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>
        </>
      )}

      {/* Feedback */}
      {saved && (
        <p role="status" className="text-sm text-status-done font-medium text-center">
          ✓ Pengaturan berhasil disimpan
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-red-600 text-center">
          {saveError}
        </p>
      )}

      <button
        type="submit"
        id="btn-save-reminder-settings"
        disabled={isSubmitting}
        className="btn-primary w-full"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>
    </form>
  );
}
