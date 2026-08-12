import { validateEnv } from './env.validation';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: '12345678901234567890123456789012',
  GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '3306',
  DATABASE_USER: 'test',
  DATABASE_PASSWORD: 'test',
  DATABASE_NAME: 'test',
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
        GOOGLE_CLIENT_ID: '  google-client-id.apps.googleusercontent.com  ',
        PUBLIC_APP_ORIGIN: 'https://sop.example.test     ',
        ALLOWED_ORIGINS: 'https://sop.example.test     ',
        SOP_PDF_STORAGE_DIR: '/app/storage/sop-pdf     ',
      }),
    ).toMatchObject({
      GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
      PUBLIC_APP_ORIGIN: 'https://sop.example.test',
      ALLOWED_ORIGINS: 'https://sop.example.test',
      SOP_PDF_STORAGE_DIR: '/app/storage/sop-pdf',
    });
  });

  it('menggunakan default runtime untuk konfigurasi opsional', () => {
    expect(validateEnv(baseEnv)).toMatchObject({
      PORT: 3001,
      SWAGGER_ENABLED: true,
      JWT_EXPIRATION: '7d',
      ALLOWED_ORIGINS: '',
      SOP_PDF_STORAGE_DIR: '/app/storage/sop-pdf',
    });
  });

  it('mewajibkan Google client ID untuk autentikasi', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        GOOGLE_CLIENT_ID: undefined,
      }),
    ).toThrow(/GOOGLE_CLIENT_ID/);
  });

  it('mewajibkan origin eksplisit pada production', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
      }),
    ).toThrow(/PUBLIC_APP_ORIGIN/);
  });

  it('menolak wildcard origin pada production dengan cookie credentials', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
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
        PUBLIC_APP_ORIGIN: 'https://sop.example.test',
        ALLOWED_ORIGINS: 'https://sop.example.test',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
      PUBLIC_APP_ORIGIN: 'https://sop.example.test',
      ALLOWED_ORIGINS: 'https://sop.example.test',
    });
  });
});
