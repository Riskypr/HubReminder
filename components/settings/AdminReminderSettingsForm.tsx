'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  ShieldCheck,
  Bot,
  Users,
  Layers,
  Clock3,
  Timer,
  Gauge,
  Cookie,
  Hourglass,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Power,
} from 'lucide-react';
import { REMINDER_INTERVAL_OPTIONS } from '@/lib/types/reminder';
import type { SystemReminderSettings } from '@/lib/services/systemReminderSettingsService';

export default function AdminReminderSettingsForm({ initialSettings }: { initialSettings: SystemReminderSettings }) {
  const [settings, setSettings] = useState<SystemReminderSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [togglingKey, setTogglingKey] = useState<'reminder_together_enabled' | 'wa_bot_enabled' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const update = <K extends keyof SystemReminderSettings>(key: K, value: SystemReminderSettings[K]) => {
    setSaveSuccess(false);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  /** Aksi toggle instan untuk Reminder Bersama atau Bot WA */
  async function toggleAction(key: 'reminder_together_enabled' | 'wa_bot_enabled') {
    const nextVal = !settings[key];
    const label = key === 'reminder_together_enabled' ? 'Reminder Bersama' : 'Bot WhatsApp';
    setTogglingKey(key);
    update(key, nextVal);

    try {
      const response = await fetch('/api/settings/reminder/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Gagal mengubah status ${label}`);
      toast.success(`${label} berhasil ${nextVal ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (error) {
      // Rollback jika gagal
      update(key, !nextVal);
      toast.error(error instanceof Error ? error.message : `Gagal mengubah status ${label}`);
    } finally {
      setTogglingKey(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch('/api/settings/reminder/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan admin');
      setSaveSuccess(true);
      toast.success('Pengaturan reminder admin berhasil disimpan');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan admin');
    } finally {
      setSaving(false);
    }
  }

  const isWaBotActive = settings.wa_bot_enabled ?? true;
  const isReminderTogetherActive = settings.reminder_together_enabled ?? true;

  return (
    <form
      onSubmit={submit}
      className="card space-y-6 border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs"
      aria-label="Pengaturan reminder admin"
    >
      {/* Header Panel Admin */}
      <div className="flex flex-col gap-3 pb-4 border-b border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-primary text-white shadow-md shadow-primary/20">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                <Sparkles size={11} />
                Akses Administrator Khusus
              </span>
            </div>
            <h2 className="text-base font-bold tracking-tight text-text-primary sm:text-lg">
              Kontrol Otomatisasi Reminder &amp; Bot WhatsApp
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">
              Pengaturan ini berlaku global untuk mengelola jadwal grup, batasan kuota Foonte, dan status aktif bot.
            </p>
          </div>
        </div>
      </div>

      {/* Bagian Aksi Utama: Aktifkan/Nonaktifkan Reminder Bersama & Bot WA */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          <Power size={13} className="text-primary" />
          <span>Aksi Kontrol Layanan</span>
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Card Aksi 1: Bot WhatsApp */}
          <div
            className={`card relative flex flex-col justify-between gap-4 p-5 transition-all border ${
              isWaBotActive
                ? 'border-emerald-500/30 bg-emerald-50/20'
                : 'border-slate-200/90 bg-slate-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                    isWaBotActive
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Bot size={22} aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary">Bot WhatsApp</h4>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isWaBotActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isWaBotActive ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      />
                      {isWaBotActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Izinkan bot merespons perintah WhatsApp (auto-laporan AI) dan mengirim semua notifikasi.
                  </p>
                </div>
              </div>

              {/* Switch Aksi Bot WA */}
              <button
                type="button"
                role="switch"
                aria-checked={isWaBotActive}
                aria-label="Aktifkan atau nonaktifkan Bot WhatsApp"
                disabled={togglingKey === 'wa_bot_enabled'}
                onClick={() => toggleAction('wa_bot_enabled')}
                className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
                style={{ backgroundColor: isWaBotActive ? '#10b981' : '#cbd5e1' }}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isWaBotActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs">
              <span className="text-[11px] text-text-muted">Aksi Cepat:</span>
              <button
                type="button"
                onClick={() => toggleAction('wa_bot_enabled')}
                disabled={togglingKey === 'wa_bot_enabled'}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  isWaBotActive
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {togglingKey === 'wa_bot_enabled' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Power size={12} />
                )}
                <span>{isWaBotActive ? 'Nonaktifkan Bot' : 'Aktifkan Bot'}</span>
              </button>
            </div>
          </div>

          {/* Card Aksi 2: Reminder Bersama */}
          <div
            className={`card relative flex flex-col justify-between gap-4 p-5 transition-all border ${
              isReminderTogetherActive
                ? 'border-primary/30 bg-blue-50/20'
                : 'border-slate-200/90 bg-slate-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                    isReminderTogetherActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Users size={22} aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-primary">Reminder Bersama (Grup WA)</h4>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isReminderTogetherActive
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isReminderTogetherActive ? 'bg-primary' : 'bg-slate-400'
                        }`}
                      />
                      {isReminderTogetherActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Kirimkan pesan kompilasi daftar peserta yang belum lapor sekaligus ke grup WhatsApp target.
                  </p>
                </div>
              </div>

              {/* Switch Aksi Reminder Bersama */}
              <button
                type="button"
                role="switch"
                aria-checked={isReminderTogetherActive}
                aria-label="Aktifkan atau nonaktifkan Reminder Bersama"
                disabled={togglingKey === 'reminder_together_enabled'}
                onClick={() => toggleAction('reminder_together_enabled')}
                className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                style={{ backgroundColor: isReminderTogetherActive ? '#0759d8' : '#cbd5e1' }}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isReminderTogetherActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs">
              <span className="text-[11px] text-text-muted">Aksi Cepat:</span>
              <button
                type="button"
                onClick={() => toggleAction('reminder_together_enabled')}
                disabled={togglingKey === 'reminder_together_enabled'}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  isReminderTogetherActive
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-primary hover:bg-blue-50'
                }`}
              >
                {togglingKey === 'reminder_together_enabled' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Power size={12} />
                )}
                <span>{isReminderTogetherActive ? 'Nonaktifkan Reminder Bersama' : 'Aktifkan Reminder Bersama'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Pengaturan Lengkap */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
          <Layers size={13} className="text-primary" />
          <span>Parameter Jadwal &amp; Kebijakan Sistem</span>
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mode Reminder */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-reminder-mode">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70 text-primary">
                <Layers size={15} />
              </span>
              <span className="font-semibold text-text-primary">Mode Reminder Laporan</span>
            </label>
            <p className="text-[11px] text-text-muted">Format pesan yang dikirim ke target WhatsApp.</p>
            <select
              id="admin-reminder-mode"
              className="input w-full font-medium"
              value={settings.reminder_mode}
              onChange={(e) => update('reminder_mode', e.target.value as 'single' | 'bulk')}
            >
              <option value="bulk">Bulk — daftar seluruh peserta dalam satu pesan (Reminder Bersama)</option>
              <option value="single">Single — satu pesan khusus per peserta</option>
            </select>
          </div>

          {/* Jam Mulai */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-start-time">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70 text-primary">
                <Clock3 size={15} />
              </span>
              <span className="font-semibold text-text-primary">Jam Mulai (WIB)</span>
            </label>
            <p className="text-[11px] text-text-muted">Waktu awal siklus pengiriman pengingat laporan harian.</p>
            <input
              id="admin-start-time"
              className="input w-full font-semibold"
              type="time"
              value={settings.start_time}
              onChange={(e) => update('start_time', e.target.value)}
            />
          </div>

          {/* Interval Reminder */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-interval">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100/70 text-primary">
                <Timer size={15} />
              </span>
              <span className="font-semibold text-text-primary">Interval Reminder Laporan</span>
            </label>
            <p className="text-[11px] text-text-muted">Jarak waktu pengulangan reminder jika belum mengisi.</p>
            <select
              id="admin-interval"
              className="input w-full font-medium"
              value={settings.interval_seconds}
              onChange={(e) => update('interval_seconds', Number(e.target.value))}
            >
              {REMINDER_INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Batas Reminder Per Hari */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-max-reminders">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/70 text-amber-700">
                <Gauge size={15} />
              </span>
              <span className="font-semibold text-text-primary">Batas Pengiriman per Hari</span>
            </label>
            <p className="text-[11px] text-text-muted">Proteksi batas kuota pesan WhatsApp Foonte per hari.</p>
            <input
              id="admin-max-reminders"
              className="input w-full font-semibold"
              type="number"
              min={1}
              max={50}
              value={settings.max_reminders_per_day}
              onChange={(e) => update('max_reminders_per_day', Number(e.target.value))}
            />
          </div>

          {/* Batas Warning Cookie */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-cookie-warning-count">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600">
                <Cookie size={15} />
              </span>
              <span className="font-semibold text-text-primary">Batas Warning Cookie per Sesi</span>
            </label>
            <p className="text-[11px] text-text-muted">Batas maksimal pengulangan pesan peringatan cookie kedaluwarsa.</p>
            <input
              id="admin-cookie-warning-count"
              className="input w-full font-semibold"
              type="number"
              min={1}
              max={20}
              value={settings.cookie_warning_count}
              onChange={(e) => update('cookie_warning_count', Number(e.target.value))}
            />
          </div>

          {/* Interval Warning Cookie */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <label className="label flex items-center gap-2 mb-0" htmlFor="admin-cookie-warning-interval">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600">
                <Hourglass size={15} />
              </span>
              <span className="font-semibold text-text-primary">Interval Warning Cookie (Menit)</span>
            </label>
            <p className="text-[11px] text-text-muted">Jarak waktu antar notifikasi peringatan cookie ke WhatsApp.</p>
            <input
              id="admin-cookie-warning-interval"
              className="input w-full font-semibold"
              type="number"
              min={15}
              max={1440}
              value={settings.cookie_warning_interval_minutes}
              onChange={(e) => update('cookie_warning_interval_minutes', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Footer & Tombol Simpan */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {saveSuccess && (
            <p role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={15} />
              Pengaturan reminder admin berhasil disimpan
            </p>
          )}
        </div>

        <button
          className="btn-primary min-h-[44px] px-6 inline-flex items-center justify-center gap-2"
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Menyimpan Pengaturan...</span>
            </>
          ) : (
            <>
              <Save size={16} aria-hidden="true" />
              <span>Simpan Pengaturan Admin</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
