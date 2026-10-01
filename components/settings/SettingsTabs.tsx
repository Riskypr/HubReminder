// components/settings/SettingsTabs.tsx
// Navigasi tab menu di dalam halaman pengaturan
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsTabs() {
  const pathname = usePathname();

  const isReminder = pathname === '/settings/reminder';
  const isAccount = pathname === '/settings/account';

  return (
    <div className="flex border-b border-border mb-4" role="tablist">
      <Link
        href="/settings/reminder"
        role="tab"
        aria-selected={isReminder}
        className={`flex-1 text-center py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
          isReminder
            ? 'border-primary text-primary font-semibold'
            : 'border-transparent text-text-secondary hover:text-text-primary'
        }`}
      >
        <span>⏰</span>
        <span>Pengaturan Reminder</span>
      </Link>
      <Link
        href="/settings/account"
        role="tab"
        aria-selected={isAccount}
        className={`flex-1 text-center py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
          isAccount
            ? 'border-primary text-primary font-semibold'
            : 'border-transparent text-text-secondary hover:text-text-primary'
        }`}
      >
        <span>🔑</span>
        <span>Akun & Cookie MagangHub</span>
      </Link>
    </div>
  );
}
