// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Zap,
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          toast.success('Pendaftaran akun berhasil!');
          router.push('/');
          router.refresh();
        } else {
          setMessage({
            text: 'Pendaftaran berhasil! Silakan periksa inbox email Anda untuk verifikasi akun sebelum masuk.',
            type: 'success',
          });
          toast.success('Silakan cek email untuk konfirmasi akun.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success('Berhasil masuk ke HubReminder.');
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const error = err as Error;
      const errorMsg = error.message || 'Terjadi kesalahan saat otentikasi.';
      setMessage({
        text: errorMsg,
        type: 'error',
      });
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell min-h-dvh flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Hero Column on Desktop (lg:col-span-6) */}
        <section className="relative hidden overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#7C3AED] p-10 text-white shadow-2xl shadow-primary/25 lg:col-span-6 lg:flex lg:min-h-[38rem] lg:flex-col lg:justify-between">
          {/* Decorative glowing background elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border-[36px] border-white/10 blur-xs" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full border-[40px] border-white/10 blur-xs" />

          <div className="relative space-y-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-md">
              <Clock3 size={28} strokeWidth={2.2} aria-hidden="true" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-100 backdrop-blur-sm">
                <Sparkles size={12} />
                HubReminder Kemnaker
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Fokus Magang. Jangan Sampai Lupa Absen.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-blue-100/90 max-w-md">
                Pantau laporan harian MagangHub secara otomatis. Dapatkan push notifikasi tepat waktu langsung ke HP atau laptopmu.
              </p>
            </div>
          </div>

          <div className="relative space-y-3 pt-6 border-t border-white/15">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white">
                <BellRing size={16} aria-hidden="true" />
              </span>
              <span className="text-xs font-medium">Jadwal notifikasi fleksibel sesuai preferensi</span>
              <CheckCircle2 size={16} className="ml-auto text-emerald-300" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white">
                <ShieldCheck size={16} aria-hidden="true" />
              </span>
              <span className="text-xs font-medium">Kredensial disimpan dengan enkripsi AES-256</span>
              <CheckCircle2 size={16} className="ml-auto text-emerald-300" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white">
                <Zap size={16} aria-hidden="true" />
              </span>
              <span className="text-xs font-medium">Otomatisasi cron check setiap menit</span>
              <CheckCircle2 size={16} className="ml-auto text-emerald-300" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Right Auth Form Column (lg:col-span-6) */}
        <div className="card mx-auto w-full max-w-md space-y-6 border-slate-200/90 bg-white/95 p-7 shadow-xl shadow-slate-900/5 sm:p-9 lg:col-span-6 lg:max-w-none">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mx-auto mb-3 flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-[#7C3AED] text-white shadow-md shadow-primary/20 lg:mx-0" aria-hidden="true">
              <Clock3 size={26} strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              {isSignUp ? 'Daftar Akun Baru' : 'Selamat Datang Kembali'}
            </h1>
            <p className="text-xs text-text-secondary leading-relaxed">
              {isSignUp
                ? 'Buat akun HubReminder untuk mulai memantau absensi magangmu.'
                : 'Masuk dengan email dan kata sandi yang telah terdaftar.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Form Login">
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="fullname-input" className="label text-xs">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <UserRound
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="fullname-input"
                    type="text"
                    required
                    className="input pl-11 text-xs"
                    placeholder="Nama Lengkap Anda"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email-input" className="label text-xs">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email-input"
                  type="email"
                  required
                  className="input pl-11 text-xs"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password-input" className="label text-xs">
                Kata Sandi
              </label>
              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password-input"
                  type="password"
                  required
                  minLength={6}
                  className="input pl-11 text-xs"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {message && (
              <div
                role="alert"
                className={`flex items-start gap-2.5 text-xs p-3.5 rounded-2xl border ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                {message.type === 'error' ? (
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                ) : (
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                )}
                <span className="leading-relaxed">{message.text}</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-auth-submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <span>Memproses…</span>
              ) : isSignUp ? (
                <>
                  <UserPlus size={16} aria-hidden="true" />
                  <span>Daftar Akun Baru</span>
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Masuk Sekarang</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Masuk / Daftar */}
          <div className="pt-2 text-center text-xs text-text-secondary border-t border-slate-100">
            {isSignUp ? (
              <p>
                Sudah memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline ml-1"
                >
                  <span>Masuk</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              </p>
            ) : (
              <p>
                Belum memiliki akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline ml-1"
                >
                  <span>Daftar Sekarang</span>
                  <UserPlus size={13} aria-hidden="true" />
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
