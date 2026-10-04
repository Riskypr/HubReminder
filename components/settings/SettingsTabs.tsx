// components/settings/SettingsTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, ShieldCheck, Sliders, KeyRound } from 'lucide-react';

export default function SettingsTabs() {
  const pathname = usePathname();

  const isReminder = pathname === '/settings/reminder';
  const isAccount = pathname === '/settings/account';

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4" role="tablist" aria-label="Pengaturan akun">
      <Link
        href="/settings/reminder"
        role="tab"
        aria-selected={isReminder}
        className={`group relative flex items-center gap-3.5 rounded-3xl border p-4 transition-all duration-150 sm:p-5 ${
          isReminder
            ? 'border-primary/40 bg-white shadow-md shadow-primary/10 ring-2 ring-primary/20'
            : 'border-slate-200/90 bg-white/70 hover:border-slate-300 hover:bg-white text-slate-600'
        }`}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${
            isReminder
              ? 'bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/25'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <BellRing size={20} aria-hidden="true" />
        </span>
        <div className="text-left min-w-0">
          <strong className={`block text-sm font-bold tracking-tight truncate ${isReminder ? 'text-primary' : 'text-slate-800'}`}>
            Pengaturan Reminder
          </strong>
          <span className="text-xs text-text-muted truncate hidden sm:block">
            Jadwal jam, frekuensi, &amp; jeda interval
          </span>
        </div>
      </Link>

      <Link
        href="/settings/account"
        role="tab"
        aria-selected={isAccount}
        className={`group relative flex items-center gap-3.5 rounded-3xl border p-4 transition-all duration-150 sm:p-5 ${
          isAccount
            ? 'border-primary/40 bg-white shadow-md shadow-primary/10 ring-2 ring-primary/20'
            : 'border-slate-200/90 bg-white/70 hover:border-slate-300 hover:bg-white text-slate-600'
        }`}
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${
            isAccount
              ? 'bg-[linear-gradient(135deg,#0759d8,#0344b8)] text-white shadow-md shadow-primary/25'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div className="text-left min-w-0">
          <strong className={`block text-sm font-bold tracking-tight truncate ${isAccount ? 'text-primary' : 'text-slate-800'}`}>
            Akun MagangHub
          </strong>
          <span className="text-xs text-text-muted truncate hidden sm:block">
            Status sesi, kredensial, &amp; token
          </span>
        </div>
      </Link>
    </div>
  );
}
