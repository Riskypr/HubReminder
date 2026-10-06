'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { REMINDER_INTERVAL_OPTIONS } from '@/lib/types/reminder';
import type { SystemReminderSettings } from '@/lib/services/systemReminderSettingsService';

export default function AdminReminderSettingsForm({ initialSettings }: { initialSettings: SystemReminderSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof SystemReminderSettings>(key: K, value: SystemReminderSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/settings/reminder/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan admin');
      toast.success('Pengaturan reminder admin tersimpan');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan admin');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 border-primary/20 bg-white p-5" aria-label="Pengaturan reminder admin">
      <div>
        <h2 className="text-base font-bold text-text-primary">Pengaturan Admin Reminder & Cookie</h2>
        <p className="mt-1 text-xs text-text-secondary">Pengaturan ini berlaku global dan hanya tersedia untuk email admin yang ada di REMINDER_ADMIN_EMAILS. Kedua mode mengirim lewat Foonte ke target dari environment.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Mode reminder laporan
          <select className="input mt-2" value={settings.reminder_mode} onChange={(e) => update('reminder_mode', e.target.value as 'single' | 'bulk')}>
            <option value="single">Single — satu pesan per peserta</option><option value="bulk">Bulk — daftar peserta dalam satu pesan</option>
          </select>
        </label>
        <label className="label">Jam mulai (WIB)
          <input className="input mt-2" type="time" value={settings.start_time} onChange={(e) => update('start_time', e.target.value)} />
        </label>
        <label className="label">Interval reminder laporan
          <select className="input mt-2" value={settings.interval_seconds} onChange={(e) => update('interval_seconds', Number(e.target.value))}>
            {REMINDER_INTERVAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="label">Batas warning cookie per sesi
          <input className="input mt-2" type="number" min={1} max={20} value={settings.cookie_warning_count} onChange={(e) => update('cookie_warning_count', Number(e.target.value))} />
        </label>
        <label className="label">Interval warning cookie (menit)
          <input className="input mt-2" type="number" min={15} max={1440} value={settings.cookie_warning_interval_minutes} onChange={(e) => update('cookie_warning_interval_minutes', Number(e.target.value))} />
        </label>
      </div>
      <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Pengaturan Admin'}</button>
    </form>
  );
}
