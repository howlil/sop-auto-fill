import { validateEnv } from './env.validation';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: '12345678901234567890123456789012',
  TTE_ENCRYPTION_SECRET: 'tte-secret-that-is-different-and-long-enough-123456',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '3306',
  DATABASE_USER: 'test',
  DATABASE_PASSWORD: 'test',
  DATABASE_NAME: 'test',
  WHATSAPP_ENABLED: 'false',
  PDF_SIGNING_ENABLED: 'false',
};

describe('Environment validation', () => {
  it('tidak mewajibkan DATABASE_URL ketika DATABASE_* tersedia', () => {
    expect(validateEnv(baseEnv)).toMatchObject({
      DATABASE_HOST: 'localhost',
      DATABASE_USER: 'test',
      DATABASE_NAME: 'test',
    });
  });

  it('menormalkan spasi dari environment deployment', () => {
    expect(
      validateEnv({
        ...baseEnv,
        PUBLIC_APP_ORIGIN: 'https://sop.example.test     ',
        ALLOWED_ORIGINS: 'https://sop.example.test     ',
        SOP_PDF_STORAGE_DIR: '/app/storage/sop-pdf     ',
      }),
    ).toMatchObject({
      PUBLIC_APP_ORIGIN: 'https://sop.example.test',
      ALLOWED_ORIGINS: 'https://sop.example.test',
      SOP_PDF_STORAGE_DIR: '/app/storage/sop-pdf',
    });
  });

  it('mengaktifkan in-app dan menonaktifkan WhatsApp secara default', () => {
    expect(
      validateEnv({
        ...baseEnv,
        WHATSAPP_ENABLED: undefined,
      }),
    ).toMatchObject({
      NOTIFICATION_IN_APP_ENABLED: true,
      NOTIFICATION_RECONCILE_INTERVAL_SECONDS: 10,
      WHATSAPP_ENABLED: false,
    });
  });

  it('tidak mewajibkan kredensial WhaAPI ketika WhatsApp nonaktif', () => {
    expect(
      validateEnv({
        ...baseEnv,
        WHATSAPP_ENABLED: 'false',
        WHAAPI_TOKEN: '',
        WHAAPI_CHANNEL_ID: '',
      }),
    ).toMatchObject({ WHATSAPP_ENABLED: false });
  });

  it('mewajibkan token dan channel ketika WhatsApp aktif', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        WHATSAPP_ENABLED: 'true',
        WHAAPI_TOKEN: '',
        WHAAPI_CHANNEL_ID: '',
      }),
    ).toThrow(/WHAAPI_TOKEN/);
  });

  it('menerima konfigurasi WhatsApp lengkap ketika aktif', () => {
    expect(
      validateEnv({
        ...baseEnv,
        WHATSAPP_ENABLED: 'true',
        WHAAPI_TOKEN: 'test-token',
        WHAAPI_CHANNEL_ID: 'test-channel',
      }),
    ).toMatchObject({
      WHATSAPP_ENABLED: true,
      WHAAPI_TOKEN: 'test-token',
      WHAAPI_CHANNEL_ID: 'test-channel',
    });
  });

  it('menerima PDF signing nonaktif tanpa P12 global server', () => {
    expect(
      validateEnv({
        ...baseEnv,
        PDF_SIGNING_ENABLED: 'false',
        PDF_SIGNING_P12_BASE64: '',
      }),
    ).toMatchObject({ PDF_SIGNING_ENABLED: false });
  });

  it('menolak TTE encryption secret yang sama dengan JWT secret', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        TTE_ENCRYPTION_SECRET: baseEnv.JWT_SECRET,
      }),
    ).toThrow(/berbeda dari JWT_SECRET/);
  });

  it('mewajibkan refresh secret dan origin eksplisit pada production', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
      }),
    ).toThrow(/JWT_REFRESH_SECRET|PUBLIC_APP_ORIGIN/);
  });

  it('menolak wildcard origin pada production dengan cookie credentials', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-characters-long',
        PUBLIC_APP_ORIGIN: 'https://sop.example.test',
        ALLOWED_ORIGINS: '*',
      }),
    ).toThrow(/Wildcard origin/);
  });

  it('menerima konfigurasi production yang eksplisit', () => {
    expect(
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-characters-long',
        PUBLIC_APP_ORIGIN: 'https://sop.example.test',
        ALLOWED_ORIGINS: 'https://sop.example.test',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      PUBLIC_APP_ORIGIN: 'https://sop.example.test',
      ALLOWED_ORIGINS: 'https://sop.example.test',
    });
  });
});
