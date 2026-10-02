// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock3 } from 'lucide-react';
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
          toast.success('Pendaftaran berhasil.');
          router.push('/');
          router.refresh();
        } else {
        setMessage({
          text: 'Pendaftaran berhasil! Cek email kamu untuk konfirmasi akun sebelum login.',
          type: 'success',
        });
        toast.success('Cek email kamu untuk konfirmasi akun.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success('Berhasil masuk.');
        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({
        text: error.message || 'Terjadi kesalahan saat otentikasi',
        type: 'error',
      });
      toast.error(error.message || 'Terjadi kesalahan saat otentikasi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell min-h-dvh flex flex-col justify-center px-4 py-8">
      <div className="card mx-auto w-full max-w-md space-y-6 border-white/80 p-6 shadow-xl shadow-blue-900/5 sm:p-8">
        <div className="text-center space-y-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#7157E8] text-white shadow-lg shadow-primary/20" aria-hidden="true"><Clock3 size={27} /></div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">HubReminder</h1>
          <p className="text-xs text-text-secondary">
            Pengingat Laporan Harian MagangHub Kemnaker
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Form Login">
          {isSignUp && (
            <div>
              <label htmlFor="fullname-input" className="label">
                Nama Lengkap
              </label>
              <input
                id="fullname-input"
                type="text"
                required
                className="input"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor="email-input" className="label">
              Email
            </label>
            <input
              id="email-input"
              type="email"
              required
              className="input"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password-input" className="label">
              Kata Sandi
            </label>
            <input
              id="password-input"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div
              role="alert"
              className={`text-xs p-3 rounded-xl ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            id="btn-auth-submit"
            disabled={loading}
            className="btn-primary w-full bg-gradient-to-r from-primary to-[#7157E8] shadow-md shadow-primary/20 hover:brightness-105"
          >
            {loading ? 'Memproses...' : isSignUp ? 'Daftar Akun' : 'Masuk'}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-text-secondary">
          {isSignUp ? (
            <p>
              Sudah punya akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setMessage(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Masuk sekarang
              </button>
            </p>
          ) : (
            <p>
              Belum punya akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setMessage(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Daftar sekarang
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
