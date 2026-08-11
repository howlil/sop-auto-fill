import {
  resolvePublicAppOrigin,
  buildValidasiPengesahanBaseUrl,
  extractAppOriginFromRequest,
  VALIDASI_PENGESAHAN_PATH,
} from './tte-public-origin.util';

describe('Pengujian util origin publik TTE', () => {
  it('seharusnya mengambil origin dari header Origin', () => {
    const actual = extractAppOriginFromRequest({
      headers: { origin: 'https://app.example.com' },
    } as never);
    expect(actual).toBe('https://app.example.com');
  });

  it('seharusnya mengambil origin dari header referer ketika origin tidak ada', () => {
    const actual = extractAppOriginFromRequest({
      headers: { referer: 'https://app.example.com/validasi/pdf?x=1' },
    } as never);
    expect(actual).toBe('https://app.example.com');
  });

  it('seharusnya mengembalikan null ketika referer tidak valid', () => {
    const actual = extractAppOriginFromRequest({
      headers: { referer: 'bukan-url' },
    } as never);
    expect(actual).toBeNull();
  });

  it('seharusnya membangun origin dari forwarded proto dan forwarded host', () => {
    const actual = extractAppOriginFromRequest({
      headers: {
        'x-forwarded-proto': 'http,https',
        'x-forwarded-host': 'app.example.com,proxy.example.com',
      },
    } as never);
    expect(actual).toBe('http://app.example.com');
  });

  it('seharusnya memakai host dan default https ketika forwarded proto tidak ada', () => {
    const actual = extractAppOriginFromRequest({
      headers: { host: 'app.example.com' },
    } as never);
    expect(actual).toBe('https://app.example.com');
  });

  it('seharusnya mengambil nilai pertama ketika header berbentuk array', () => {
    const actual = extractAppOriginFromRequest({
      headers: {
        'x-forwarded-proto': ['https', 'http'],
        'x-forwarded-host': ['app.example.com', 'proxy.example.com'],
      },
    } as never);
    expect(actual).toBe('https://app.example.com');
  });

  it('seharusnya mengembalikan null ketika host tidak ada atau kosong', () => {
    expect(extractAppOriginFromRequest({ headers: {} } as never)).toBeNull();
    expect(extractAppOriginFromRequest({ headers: { host: '   ' } } as never)).toBeNull();
  });

  it('seharusnya memprioritaskan origin dari konfigurasi', () => {
    const actual = resolvePublicAppOrigin({
      configOrigin: 'https://config.example.com/',
      requestOrigin: 'https://request.example.com',
    });
    expect(actual).toBe('https://config.example.com');
  });

  it('seharusnya memakai request origin ketika konfigurasi kosong', () => {
    const actual = resolvePublicAppOrigin({
      configOrigin: '   ',
      requestOrigin: 'https://request.example.com',
    });
    expect(actual).toBe('https://request.example.com');
  });

  it('seharusnya mengembalikan null ketika konfigurasi dan request origin tidak tersedia', () => {
    expect(resolvePublicAppOrigin({ configOrigin: undefined, requestOrigin: undefined })).toBeNull();
    expect(resolvePublicAppOrigin({ configOrigin: undefined, requestOrigin: null })).toBeNull();
  });

  it('seharusnya membangun path validasi pengesahan dari origin', () => {
    expect(buildValidasiPengesahanBaseUrl('https://app.example.com')).toBe(
      `https://app.example.com${VALIDASI_PENGESAHAN_PATH}`,
    );
  });

  it('seharusnya menolak origin aplikasi yang tidak valid saat membangun URL validasi', () => {
    expect(() => buildValidasiPengesahanBaseUrl('   ')).toThrow('Origin aplikasi tidak valid');
  });
});
