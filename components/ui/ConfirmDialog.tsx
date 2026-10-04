'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, CircleAlert, Info, LogOut, Loader2, X } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  busy?: boolean;
  icon?: 'alert' | 'logout' | 'info' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'danger',
  busy = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;

      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  // Icon selector
  const resolvedIcon = () => {
    if (icon === 'logout') {
      return <LogOut size={22} className="text-red-600" aria-hidden="true" />;
    }
    if (variant === 'warning' || icon === 'warning') {
      return <AlertTriangle size={22} className="text-amber-600" aria-hidden="true" />;
    }
    if (variant === 'info' || icon === 'info') {
      return <Info size={22} className="text-primary" aria-hidden="true" />;
    }
    return <CircleAlert size={22} className="text-red-600" aria-hidden="true" />;
  };

  const badgeBg =
    variant === 'warning'
      ? 'bg-amber-100 text-amber-600 border border-amber-200'
      : variant === 'info'
      ? 'bg-blue-100 text-primary border border-blue-200'
      : 'bg-red-50 text-red-600 border border-red-100';

  const confirmBtnStyle =
    variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 text-white'
      : variant === 'info'
      ? 'bg-primary hover:bg-primary-dark shadow-primary/20 text-white'
      : 'bg-red-600 hover:bg-red-700 shadow-red-600/20 text-white';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/50 transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="hub-dialog-enter relative w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-950/25 backdrop-blur-xl sm:p-7"
      >
        {/* Subtle decorative background gradient */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />

        <div className="flex items-start gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${badgeBg}`}>
            {resolvedIcon()}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-lg font-bold tracking-tight text-text-primary">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl p-2 text-text-muted transition hover:bg-slate-100 hover:text-text-primary disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-outline min-h-[44px] sm:min-w-28 text-sm font-semibold hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-md transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 sm:min-w-36 ${confirmBtnStyle}`}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Memproses…</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
