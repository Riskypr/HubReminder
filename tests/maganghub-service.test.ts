import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginToMagangHub, splitSetCookieHeader } from '@/lib/services/maganghubService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('splitSetCookieHeader()', () => {
  it('memisahkan cookie gabungan tanpa memecah koma di atribut Expires', () => {
    const cookies = splitSetCookieHeader(
      'acw_tc=waf-cookie; Path=/; HttpOnly, kemnaker_ri_session=session-cookie; Expires=Wed, 20 Oct 2094 13:40:34 GMT; Path=/; Secure; HttpOnly'
    );

    expect(cookies).toEqual([
      'acw_tc=waf-cookie; Path=/; HttpOnly',
      'kemnaker_ri_session=session-cookie; Expires=Wed, 20 Oct 2094 13:40:34 GMT; Path=/; Secure; HttpOnly',
    ]);
  });
});

describe('loginToMagangHub() melalui SSO Kemnaker', () => {
  it('memulai SSO lewat Monev, lalu menukar code dan state menjadi token', async () => {
    vi.stubEnv('MAGANGHUB_LOGIN_PATH', '/auth/login');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('https://account.kemnaker.go.id/auth?client_id=client&redirect_uri=https%3A%2F%2Fmonev.maganghub.kemnaker.go.id%2Fcallback&state=opaque', {
        status: 201,
        headers: {
          'content-type': 'text/plain',
          'set-cookie': 'monev_sso_session=session-value; Path=/api/v1; Secure; HttpOnly',
        },
      }))
      .mockResolvedValueOnce(new Response('<meta content="csrf-value" name="csrf-token">', {
        status: 200,
        headers: { 'set-cookie': 'kemnaker_ri_session=session-value; Path=/; Secure; HttpOnly' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { redirect_uri: 'https://monev.maganghub.kemnaker.go.id/callback?code=oauth-code&state=opaque' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { access_token: 'access-value', refresh_token: 'refresh-value' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginToMagangHub('peserta@example.com', 'password-value');

    expect(result).toEqual({
      tokens: { accessToken: 'access-value', refreshToken: 'refresh-value' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://monev-api.maganghub.kemnaker.go.id/api/v1/auth/login');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
    expect(String(fetchMock.mock.calls[1][0])).toContain('account.kemnaker.go.id/auth?client_id=client');
    expect(String(fetchMock.mock.calls[2][0])).toBe('https://account.kemnaker.go.id/auth/login');
    const callbackUrl = new URL(String(fetchMock.mock.calls[3][0]));
    expect(callbackUrl.pathname).toBe('/api/v1/auth/login/callback');
    expect(callbackUrl.searchParams.get('code')).toBe('oauth-code');
    expect(callbackUrl.searchParams.get('state')).toBe('opaque');
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({ Cookie: 'monev_sso_session=session-value' });
  });

  it('memvalidasi domain URL SSO dari API sebelum mengirim kredensial', async () => {
    vi.stubEnv('MAGANGHUB_LOGIN_PATH', '/auth/login');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('https://evil.example/auth?state=sensitive', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginToMagangHub('peserta@example.com', 'password-value');

    expect(result.error).toContain('tidak memberikan URL SSO');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('menukar code dari redirect_uri JSON yang dikembalikan endpoint SSO', async () => {
    vi.stubEnv('MAGANGHUB_LOGIN_PATH', '/auth/login');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('https://account.kemnaker.go.id/auth?state=opaque', { status: 201 }))
      .mockResolvedValueOnce(new Response('<meta name="csrf-token" content="csrf-value">', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { redirect_uri: 'https://account.kemnaker.go.id/oauth/monev?state=opaque' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { redirect_uri: 'https://monev.maganghub.kemnaker.go.id/callback?code=oauth-code&state=opaque' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { access_token: 'access-value', refresh_token: 'refresh-value' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginToMagangHub('peserta@example.com', 'password-value');

    expect(result).toEqual({
      tokens: { accessToken: 'access-value', refreshToken: 'refresh-value' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(new URL(String(fetchMock.mock.calls[4][0])).pathname).toBe('/api/v1/auth/login/callback');
  });

  it('mengambil token cookie Monev setelah callback redirect', async () => {
    vi.stubEnv('MAGANGHUB_LOGIN_PATH', '/auth/login');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('https://account.kemnaker.go.id/auth?state=opaque', { status: 201 }))
      .mockResolvedValueOnce(new Response('<meta name="csrf-token" content="csrf-value">', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { redirect_uri: 'https://account.kemnaker.go.id/oauth/monev?state=opaque' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          location: 'https://monev.maganghub.kemnaker.go.id/dashboard',
          'set-cookie': 'monev_access_token=access-value; Path=/; Secure; HttpOnly, monev_refresh_token=refresh-value; Path=/; Secure; HttpOnly',
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginToMagangHub('peserta@example.com', 'password-value');

    expect(result).toEqual({
      tokens: { accessToken: 'access-value', refreshToken: 'refresh-value' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
