// components/dashboard/SessionExpiredBanner.tsx
'use client';

import { TriangleAlert } from 'lucide-react';

import Link from 'next/link';

export default function SessionExpiredBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-warning bg-warning-bg px-4 py-3 text-sm"
    >
      <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-warning">Sesi MagangHub kedaluwarsa</p>
        <p className="text-text-secondary mt-0.5">
          Hubungkan ulang akun agar pemantauan laporan dapat dilanjutkan.
        </p>
      </div>
      <Link
        href="/settings/account"
        id="banner-reconnect"
        className="shrink-0 text-xs font-semibold text-primary hover:text-primary-dark underline"
      >
        Hubungkan Ulang
      </Link>
    </div>
  );
}
