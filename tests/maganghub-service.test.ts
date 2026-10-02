import { describe, expect, it } from 'vitest';
import { splitSetCookieHeader } from '@/lib/services/maganghubService';

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
