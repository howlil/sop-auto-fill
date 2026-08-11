import {
  buildAccessTokenCookieOptions,
  buildClearAccessTokenCookieOptions,
  buildClearRefreshTokenCookieOptions,
  buildRefreshTokenCookieOptions,
  resolveRefreshTokenExpiry,
  resolveAccessTokenExpiry,
} from './auth.shared';

describe('Pengujian resolveAccessTokenExpiry', () => {
  it('seharusnya menggunakan nilai default ketika konfigurasi tidak diisi', () => {
    const actual = resolveAccessTokenExpiry(undefined);
    expect(actual.expiresInSeconds).toBe(900);
    expect(actual.maxAgeMs).toBe(900_000);
  });

  it('seharusnya menggunakan nilai default ketika konfigurasi kosong atau hanya berisi spasi', () => {
    expect(resolveAccessTokenExpiry('').expiresInSeconds).toBe(900);
    expect(resolveAccessTokenExpiry('   ').expiresInSeconds).toBe(900);
  });

  it('seharusnya menggunakan nilai default ketika ms gagal memproses konfigurasi', () => {
    expect(resolveAccessTokenExpiry('bukan-timespan').expiresInSeconds).toBe(900);
  });

  it('seharusnya memproses string rentang waktu yang valid', () => {
    const actual = resolveAccessTokenExpiry('1h');
    expect(actual.expiresInSeconds).toBe(3600);
    expect(actual.maxAgeMs).toBe(3600_000);
  });

  it('seharusnya memperlakukan integer positif sebagai detik', () => {
    const actual = resolveAccessTokenExpiry(120);
    expect(actual.expiresInSeconds).toBe(120);
    expect(actual.maxAgeMs).toBe(120_000);
  });

  it('seharusnya menggunakan default ketika konfigurasi berupa angka tidak valid', () => {
    expect(resolveAccessTokenExpiry(0).expiresInSeconds).toBe(900);
    expect(resolveAccessTokenExpiry(-1).expiresInSeconds).toBe(900);
    expect(resolveAccessTokenExpiry(1.5).expiresInSeconds).toBe(900);
    expect(resolveAccessTokenExpiry(Number.POSITIVE_INFINITY).expiresInSeconds).toBe(900);
  });
});

describe('Pengujian resolveRefreshTokenExpiry', () => {
  it('seharusnya menggunakan default tujuh hari ketika konfigurasi tidak diisi', () => {
    const actual = resolveRefreshTokenExpiry(undefined);
    expect(actual.expiresInSeconds).toBe(604_800);
    expect(actual.maxAgeMs).toBe(604_800_000);
  });

  it('seharusnya memproses konfigurasi refresh token valid', () => {
    const actual = resolveRefreshTokenExpiry('2d');
    expect(actual.expiresInSeconds).toBe(172_800);
    expect(actual.maxAgeMs).toBe(172_800_000);
  });
});

describe('Pengujian buildClearAccessTokenCookieOptions', () => {
  it('seharusnya mengatur opsi cookie yang sesuai selain maxAge', () => {
    const isProduction = false;
    const clearOpts = buildClearAccessTokenCookieOptions(isProduction);
    const setOpts = buildAccessTokenCookieOptions(60_000, isProduction);
    expect(clearOpts.path).toBe(setOpts.path);
    expect(clearOpts.httpOnly).toBe(setOpts.httpOnly);
    expect(clearOpts.sameSite).toBe(setOpts.sameSite);
    expect(clearOpts.secure).toBe(setOpts.secure);
  });
});

describe('Pengujian cookie auth', () => {
  it('seharusnya membedakan opsi sameSite production dan non-production', () => {
    expect(buildAccessTokenCookieOptions(60_000, true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60_000,
      path: '/',
    });
    expect(buildAccessTokenCookieOptions(60_000, false)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60_000,
      path: '/',
    });
  });

  it('seharusnya mengatur opsi clear refresh cookie konsisten dengan set refresh cookie', () => {
    const isProduction = true;
    const clearOpts = buildClearRefreshTokenCookieOptions(isProduction);
    const setOpts = buildRefreshTokenCookieOptions(60_000, isProduction);
    expect(clearOpts).toEqual({
      path: setOpts.path,
      httpOnly: setOpts.httpOnly,
      sameSite: setOpts.sameSite,
      secure: setOpts.secure,
    });
  });
});
