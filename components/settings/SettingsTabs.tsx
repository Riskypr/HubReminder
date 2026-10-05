'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, ShieldCheck } from 'lucide-react';

export default function SettingsTabs() {
  const pathname = usePathname();
  const isReminder = pathname === '/settings/reminder';

  return (
    <nav
      className="rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 shadow-inner sm:rounded-3xl"
      aria-label="Bagian pengaturan"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <Link
          href="/settings/reminder"
          prefetch={!isReminder}
          aria-current={isReminder ? 'page' : undefined}
          className={`group flex min-h-14 items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-center transition-all sm:min-h-16 sm:rounded-2xl sm:gap-3 ${
            isReminder
              ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          }`}
        >
          <BellRing size={18} className={isReminder ? 'text-primary' : 'text-slate-400'} aria-hidden="true" />
          <span className="min-w-0 text-left">
            <strong className="block text-xs font-bold sm:text-sm">Pengingat</strong>
            <span className="hidden text-[11px] text-text-muted sm:block">Jadwal dan frekuensi</span>
          </span>
        </Link>

        <Link
          href="/settings/account"
          prefetch={isReminder}
          aria-current={!isReminder ? 'page' : undefined}
          className={`group flex min-h-14 items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-center transition-all sm:min-h-16 sm:rounded-2xl sm:gap-3 ${
            !isReminder
              ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200/80'
              : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={18} className={!isReminder ? 'text-primary' : 'text-slate-400'} aria-hidden="true" />
          <span className="min-w-0 text-left">
            <strong className="block text-xs font-bold sm:text-sm">Akun MagangHub</strong>
            <span className="hidden text-[11px] text-text-muted sm:block">Koneksi dan sesi</span>
          </span>
        </Link>
      </div>
    </nav>
  );
}
