// components/dashboard/SessionExpiredBanner.tsx
'use client';

import { ArrowRight, KeyRound, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

export default function SessionExpiredBanner() {
  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
            <TriangleAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-amber-900">Sesi MagangHub Kedaluwarsa</h3>
            <p className="mt-0.5 text-xs text-amber-800/80 leading-relaxed">
              Kuki atau sesi login MagangHub kamu telah habis masa berlakunya. Perbarui sesi sekarang agar reminder otomatis tetap berjalan.
            </p>
          </div>
        </div>

        <Link
          href="/settings/account"
          id="banner-reconnect"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-amber-600/20 transition hover:bg-amber-700 active:scale-95 sm:self-center"
        >
          <KeyRound size={14} aria-hidden="true" />
          <span>Hubungkan Ulang</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
