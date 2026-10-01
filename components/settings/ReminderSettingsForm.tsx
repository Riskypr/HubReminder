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
    interval_seconds: z.number().int().min(15).max(28_800),
    reminder_times: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Format waktu tidak valid')).min(1, 'Tambahkan minimal satu waktu reminder'),
    snooze_today: z.boolean(),
  });

type FormValues = z.infer<typeof schema>;

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 detik (uji coba)' },
  { value: 900, label: '15 menit' },
  { value: 1800, label: '30 menit' },
  { value: 3600, label: '1 jam' },
  { value: 5400, label: '1,5 jam' },
  { value: 7200, label: '2 jam' },
];

interface Props {
  initialSettings: ReminderSettings;
}

export default function ReminderSettingsForm({ initialSettings }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testingPush, setTestingPush] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [newReminderTime, setNewReminderTime] = useState('07:00');

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSnoozedToday = initialSettings.snooze_until === todayStr;

  async function handleTestPush() {
    setTestingPush(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult({
          success: true,
          message: `✓ Berhasil! Notifikasi telah dikirim ke ${data.sentToDevices || 1} perangkat terdaftar. Cek bilah notifikasi Anda.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Gagal mengirim notifikasi tes.',
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setTestResult({
        success: false,
        message: error.message || 'Terjadi kesalahan saat memanggil API.',
      });
    } finally {
      setTestingPush(false);
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: initialSettings.enabled,
      max_reminders_per_day: initialSettings.max_reminders_per_day,
      interval_seconds: initialSettings.interval_seconds,
      reminder_times: initialSettings.reminder_times,
      snooze_today: isSnoozedToday,
    },
  });

  const enabled = watch('enabled');
  const reminderTimes = watch('reminder_times');

  function addReminderTime() {
    if (!newReminderTime || reminderTimes.includes(newReminderTime)) return;
    setValue('reminder_times', [...reminderTimes, newReminderTime].sort(), { shouldValidate: true, shouldDirty: true });
  }

  function removeReminderTime(time: string) {
    setValue('reminder_times', reminderTimes.filter((item) => item !== time), { shouldValidate: true, shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    setSaved(false);
    setSaveError(null);
    const res = await fetch('/api/settings/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        reminder_times: [...new Set(values.reminder_times)].sort(),
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
              {...register('interval_seconds', { valueAsNumber: true })}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Waktu reminder */}
          <div className="card space-y-3">
            <div>
              <p className="label">Waktu reminder</p>
              <p className="text-xs text-text-muted mt-0.5">Tambahkan satu atau beberapa waktu yang berbeda. Waktu dapat dihapus kapan saja.</p>
            </div>
            <div className="flex gap-2">
              <input
                id="reminder-time"
                type="time"
                step="1"
                value={newReminderTime}
                onChange={(event) => setNewReminderTime(event.target.value)}
                className="input flex-1"
                aria-label="Waktu reminder baru"
              />
              <button type="button" onClick={addReminderTime} className="btn-outline shrink-0">Tambah</button>
            </div>
            <ul className="space-y-2" aria-label="Daftar waktu reminder">
              {reminderTimes.map((time) => (
                <li key={time} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
                  <span className="text-sm font-medium text-text-primary">{time}</span>
                  <button type="button" onClick={() => removeReminderTime(time)} className="text-sm font-medium text-red-600 min-h-11 px-2" aria-label={`Hapus waktu ${time}`}>Hapus</button>
                </li>
              ))}
            </ul>
            {errors.reminder_times && <p className="text-xs text-red-600">{errors.reminder_times.message}</p>}
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

      {/* Bagian Uji Coba Reminder */}
      <div className="card space-y-3 pt-4 border-t border-border mt-6">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <span aria-hidden="true">🔔</span> Uji Coba Pengingat (Push Notification)
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Kirimkan satu notifikasi uji coba langsung ke perangkat ini untuk memastikan suara dan banner reminder bekerja.
          </p>
        </div>

        {testResult && (
          <div
            role="status"
            className={`text-xs p-3 rounded-xl border ${
              testResult.success
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {testResult.message}
          </div>
        )}

        <button
          type="button"
          id="btn-test-push-notification"
          onClick={handleTestPush}
          disabled={testingPush}
          className="btn-outline w-full text-xs font-semibold flex items-center justify-center gap-2"
        >
          {testingPush ? 'Mengirim notifikasi...' : '🚀 Kirim Tes Notifikasi ke HP/Browser'}
        </button>
      </div>
    </form>
  );
}
