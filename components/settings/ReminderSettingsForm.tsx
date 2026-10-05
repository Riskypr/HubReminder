// components/settings/ReminderSettingsForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import {
  BellRing,
  Check,
  Clock3,
  Hash,
  Pencil,
  PauseCircle,
  Timer,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  REMINDER_INTERVAL_OPTIONS,
  REMINDER_INTERVAL_SECONDS,
  type ReminderSettings,
} from '@/lib/types/reminder';

function normalizeReminderTime(time: string) {
  const [hour = '00', minute = '00'] = time.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function normalizeInterval(seconds: number) {
  return REMINDER_INTERVAL_SECONDS.includes(seconds as (typeof REMINDER_INTERVAL_SECONDS)[number])
    ? seconds
    : 900;
}

const schema = z.object({
  enabled: z.boolean(),
  max_reminders_per_day: z.number().int().min(1).max(20),
  interval_seconds: z.number().int().refine(
    (value) => REMINDER_INTERVAL_SECONDS.includes(value as (typeof REMINDER_INTERVAL_SECONDS)[number]),
    'Pilih interval yang tersedia',
  ),
  reminder_times: z
    .array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Gunakan format jam dan menit (HH:MM)'))
    .min(1, 'Pilih minimal satu waktu reminder'),
  snooze_today: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  initialSettings: ReminderSettings;
}

export default function ReminderSettingsForm({ initialSettings }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingReminderTime, setEditingReminderTime] = useState<string | null>(null);
  const [editedReminderTime, setEditedReminderTime] = useState('');
  const [reminderTimeError, setReminderTimeError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isSnoozedToday = initialSettings.snooze_until === todayStr;

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
      interval_seconds: normalizeInterval(initialSettings.interval_seconds),
      reminder_times: [...new Set(initialSettings.reminder_times.map(normalizeReminderTime))].sort(),
      snooze_today: isSnoozedToday,
    },
  });

  const enabled = watch('enabled');
  const reminderTimes = watch('reminder_times');

  function startEditingReminderTime(time: string) {
    setEditingReminderTime(time);
    setEditedReminderTime(time);
    setReminderTimeError(null);
  }

  function cancelEditingReminderTime() {
    setEditingReminderTime(null);
    setEditedReminderTime('');
    setReminderTimeError(null);
  }

  function saveEditedReminderTime(originalTime: string) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(editedReminderTime)) {
      setReminderTimeError('Pilih waktu dengan format HH:MM.');
      return;
    }
    const nextTime = normalizeReminderTime(editedReminderTime);
    if (reminderTimes.some((time) => time !== originalTime && time === nextTime)) {
      setReminderTimeError('Waktu tersebut sudah ada di daftar.');
      return;
    }

    setValue(
      'reminder_times',
      reminderTimes.map((time) => (time === originalTime ? nextTime : time)).sort(),
      { shouldValidate: true, shouldDirty: true },
    );
    cancelEditingReminderTime();
  }

  async function onSubmit(values: FormValues) {
    setSaved(false);
    setSaveError(null);
    const res = await fetch('/api/settings/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        reminder_times: [...new Set(values.reminder_times.map(normalizeReminderTime))].sort(),
        snooze_until: values.snooze_today ? todayStr : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = body.error ?? 'Gagal menyimpan pengaturan';
      setSaveError(err);
      toast.error(err);
    } else {
      setSaved(true);
      toast.success('Pengaturan reminder berhasil disimpan!');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-label="Form pengaturan reminder"
    >
      {/* Toggle Utama: Aktifkan Reminder (Full Width on Desktop Grid) */}
      <div className={`card flex items-center justify-between gap-4 border-slate-200/90 bg-white p-5 lg:col-span-12 ${enabled ? 'border-primary/20' : ''}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors sm:h-12 sm:w-12 ${enabled ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
            <BellRing size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="reminder-service-title" className="text-sm font-bold tracking-tight text-text-primary sm:text-base">Aktifkan Layanan Pengingat</h2>
            <p id="reminder-service-description" className="mt-1 text-xs leading-relaxed text-text-secondary sm:text-sm">
              HubReminder akan memantau absensi dan mengirimkan push notification pada jadwal yang ditentukan.
            </p>
          </div>
        </div>

        <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5" htmlFor="toggle-enabled">
          <input
            id="toggle-enabled"
            type="checkbox"
            role="switch"
            aria-labelledby="reminder-service-title"
            aria-describedby="reminder-service-description reminder-service-status"
            className="sr-only peer"
            {...register('enabled')}
          />
          <span aria-hidden="true" className="relative h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-primary/25" />
          <span id="reminder-service-status" className={`text-[11px] font-semibold ${enabled ? 'text-primary' : 'text-text-muted'}`}>
            {enabled ? 'Aktif' : 'Nonaktif'}
          </span>
        </label>
      </div>

      {enabled && (
        <>
          {/* Kolom Kiri: Maks Reminder per hari & Interval (Desktop Grid col-span-6) */}
          <div className="space-y-6 lg:col-span-6">
            {/* Maks reminder per hari */}
            <div className="card space-y-4 border-slate-200/90 bg-white p-5">
              <div className="flex items-center justify-between">
                <label htmlFor="max-reminders" className="label flex items-center gap-2 mb-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                    <Hash size={15} />
                  </span>
                  <span>Maksimum Pengingat per Hari</span>
                </label>
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {watch('max_reminders_per_day')}x / hari
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Batas pengingat maksimal yang boleh dikirimkan dalam 1 hari agar tidak berlebihan.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <input
                  id="max-reminders"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1 accent-primary h-2 cursor-pointer bg-slate-200 rounded-lg"
                  {...register('max_reminders_per_day', { valueAsNumber: true })}
                />
              </div>
              {errors.max_reminders_per_day && (
                <p className="text-xs text-red-600 font-medium">{errors.max_reminders_per_day.message}</p>
              )}
            </div>

            {/* Interval Jeda */}
            <div className="card space-y-3 border-slate-200/90 bg-white p-5">
              <label htmlFor="interval" className="label flex items-center gap-2 mb-0">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Timer size={15} />
                </span>
                <span>Interval Jeda Antar Pengingat</span>
              </label>
              <p className="text-xs text-text-muted leading-relaxed">
                Jarak waktu minimum sebelum pengingat berikutnya diizinkan untuk dikirimkan kembali.
              </p>
              <select
                id="interval"
                className="input font-medium"
                {...register('interval_seconds', { valueAsNumber: true })}
              >
                {REMINDER_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kolom Kanan: Snooze Today (Desktop Grid col-span-6) */}
          <div className="space-y-6 lg:col-span-6">
            {/* Snooze hari ini */}
            <div className="card flex items-center justify-between p-5 border-slate-200/90 bg-white">
              <div className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <PauseCircle size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="snooze-title" className="text-sm font-bold text-text-primary">Tunda Hari Ini (Snooze)</h3>
                  <p id="snooze-description" className="text-xs text-text-muted mt-0.5">
                    Hentikan pengingat khusus untuk hari ini (misal sedang cuti atau izin).
                  </p>
                </div>
              </div>

              <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5" htmlFor="snooze-today">
                <input
                  id="snooze-today"
                  type="checkbox"
                  role="switch"
                  aria-labelledby="snooze-title"
                  aria-describedby="snooze-description snooze-status"
                  className="sr-only peer"
                  {...register('snooze_today')}
                />
                <span aria-hidden="true" className="relative h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-amber-500 peer-checked:after:translate-x-5 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-amber-400/25" />
                <span id="snooze-status" className={`text-[11px] font-semibold ${watch('snooze_today') ? 'text-amber-700' : 'text-text-muted'}`}>
                  {watch('snooze_today') ? 'Ditunda' : 'Tidak Ditunda'}
                </span>
              </label>
            </div>
          </div>

          {/* Waktu Reminder Terjadwal (Full Width Grid lg:col-span-12) */}
          <div className="card space-y-4 border-slate-200/90 bg-white p-5 lg:col-span-12">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Clock3 size={17} className="text-primary" />
                  <span>Jadwal Waktu Pengingat (HH:MM)</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Pengingat akan memeriksa absensi pada jam-jam berikut. Anda dapat mengubah waktu sesuai kebutuhan.
                </p>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-label="Daftar waktu reminder">
              {reminderTimes.map((time) => (
                <li key={time} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 shadow-2xs">
                  {editingReminderTime === time ? (
                    <div className="space-y-3">
                      <label className="label text-xs" htmlFor={`edit-reminder-${time}`}>
                        Ubah waktu {time}
                      </label>
                      <input
                        id={`edit-reminder-${time}`}
                        type="time"
                        step="60"
                        value={editedReminderTime}
                        onChange={(event) => {
                          setEditedReminderTime(event.target.value);
                          setReminderTimeError(null);
                        }}
                        className="input text-xs py-2"
                        autoFocus
                      />
                      {reminderTimeError && (
                        <p className="text-xs text-red-600 font-medium" role="alert">
                          {reminderTimeError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditingReminderTime}
                          className="btn-outline min-h-[36px] px-3 py-1.5 text-xs inline-flex items-center gap-1"
                        >
                          <X size={13} aria-hidden="true" />
                          <span>Batal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditedReminderTime(time)}
                          className="btn-primary min-h-[36px] px-3 py-1.5 text-xs inline-flex items-center gap-1"
                        >
                          <Check size={13} aria-hidden="true" />
                          <span>Simpan</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-base font-bold tabular-nums text-text-primary">
                        <Clock3 size={16} className="text-primary" aria-hidden="true" />
                        {time}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditingReminderTime(time)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-slate-100 hover:text-text-primary"
                        aria-label={`Ubah waktu ${time}`}
                      >
                        <Pencil size={12} aria-hidden="true" />
                        <span>Ubah</span>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {errors.reminder_times && (
              <p className="text-xs text-red-600 font-medium">{errors.reminder_times.message}</p>
            )}
          </div>
        </>
      )}

      {/* Action Footer Button (Full Width lg:col-span-12) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200/80 pt-4 lg:col-span-12">
        <div>
          {saved && (
            <p role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={15} />
              Pengaturan reminder berhasil disimpan
            </p>
          )}
          {saveError && (
            <p role="alert" className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertCircle size={15} />
              {saveError}
            </p>
          )}
        </div>

        <button
          type="submit"
          id="btn-save-reminder-settings"
          disabled={isSubmitting || editingReminderTime !== null}
          className="btn-primary sm:min-w-48"
        >
          <Save size={16} aria-hidden="true" />
          <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
        </button>
      </div>
    </form>
  );
}
