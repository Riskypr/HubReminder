// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
          router.push('/');
          router.refresh();
        } else {
          setMessage({
            text: 'Pendaftaran berhasil! Cek email kamu untuk konfirmasi akun sebelum login.',
            type: 'success',
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({
        text: error.message || 'Terjadi kesalahan saat otentikasi',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-4 py-8 max-w-sm mx-auto">
      <div className="card space-y-6">
        <div className="text-center space-y-1">
          <div className="text-4xl mb-2" aria-hidden="true">⏱️</div>
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
            className="btn-primary w-full shadow-sm"
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
