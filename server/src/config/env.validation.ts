import { z } from 'zod';

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') {
      return val;
    }
    const normalized = val.trim().toLowerCase();
    if (normalized === '') {
      return undefined;
    }
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
    return val;
  }, z.boolean().default(defaultValue));

const trimmedEnvironmentString = (val: unknown) => (typeof val === 'string' ? val.trim() : val);

const optionalUrl = z.preprocess((val) => {
  const normalized = trimmedEnvironmentString(val);
  return normalized === '' ? undefined : normalized;
}, z.string().url().optional());

const optionalTrimmedString = z.preprocess((val) => {
  const normalized = trimmedEnvironmentString(val);
  return normalized === '' ? undefined : normalized;
}, z.string().optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    ALLOWED_ORIGINS: z.preprocess(trimmedEnvironmentString, z.string().default('')),
    SWAGGER_ENABLED: envBoolean(true),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32).optional(),
    JWT_EXPIRATION: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().default('15m'),
    ),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().min(1),
    DATABASE_URL: z.string().url().optional(),
    /** Origin kanonis frontend production. */
    PUBLIC_APP_ORIGIN: optionalUrl,
    SOP_PDF_STORAGE_DIR: z.preprocess(
      trimmedEnvironmentString,
      z.string().min(1).default('/app/storage/sop-pdf'),
    ),

    NOTIFICATION_IN_APP_ENABLED: envBoolean(true),
    NOTIFICATION_RECONCILE_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),

    /** Outbound WhatsApp benar-benar opsional. */
    WHATSAPP_ENABLED: envBoolean(false),
    WHAAPI_BASE_URL: z.preprocess(
      trimmedEnvironmentString,
      z.string().url().default('https://whaapi.flobaze.com'),
    ),
    WHAAPI_TOKEN: z.preprocess(trimmedEnvironmentString, z.string().default('')),
    WHAAPI_CHANNEL_ID: z.preprocess(trimmedEnvironmentString, z.string().default('')),
    WHATSAPP_ALLOWED_RECIPIENTS: z.preprocess(trimmedEnvironmentString, z.string().default('')),
    WHATSAPP_REMINDER_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(43_200).default(1440),
    WHATSAPP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
    WHATSAPP_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
    WHATSAPP_LOCK_LEASE_SECONDS: z.coerce.number().int().min(10).max(600).default(60),

    /** Secret server khusus untuk melindungi passphrase sertifikat personal TTE. */
    TTE_ENCRYPTION_SECRET: z.preprocess(
      trimmedEnvironmentString,
      z.string().min(32, 'TTE_ENCRYPTION_SECRET minimal 32 karakter'),
    ),
    /**
     * Menonaktifkan pembuatan signature baru tanpa mematikan endpoint verifikasi.
     * P12 signing utama berasal dari kredensial personal pengguna, bukan P12 global server.
     */
    PDF_SIGNING_ENABLED: envBoolean(true),
    /** Legacy compatibility; tidak lagi diwajibkan untuk signing personal. */
    PDF_SIGNING_P12_BASE64: optionalTrimmedString,
    PDF_SIGNING_P12_PASSPHRASE: z.string().default(''),
    PDF_SIGNING_REASON: z.string().default('Pengesahan dokumen SOP'),
    PDF_SIGNING_LOCATION: z.string().default('Indonesia'),
    PDF_SIGNING_CONTACT: z.string().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.WHATSAPP_ENABLED && data.WHAAPI_TOKEN === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WHAAPI_TOKEN wajib diisi ketika WHATSAPP_ENABLED=true',
        path: ['WHAAPI_TOKEN'],
      });
    }
    if (data.WHATSAPP_ENABLED && data.WHAAPI_CHANNEL_ID === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WHAAPI_CHANNEL_ID wajib diisi ketika WHATSAPP_ENABLED=true',
        path: ['WHAAPI_CHANNEL_ID'],
      });
    }
    if (data.TTE_ENCRYPTION_SECRET === data.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gunakan secret TTE yang berbeda dari JWT_SECRET',
        path: ['TTE_ENCRYPTION_SECRET'],
      });
    }
    if (
      data.JWT_REFRESH_SECRET !== undefined &&
      data.TTE_ENCRYPTION_SECRET === data.JWT_REFRESH_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gunakan secret TTE yang berbeda dari JWT_REFRESH_SECRET',
        path: ['TTE_ENCRYPTION_SECRET'],
      });
    }
    if (data.NODE_ENV !== 'production') {
      return;
    }
    if (data.JWT_REFRESH_SECRET === undefined || data.JWT_REFRESH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'JWT_REFRESH_SECRET wajib pada NODE_ENV=production (minimal 32 karakter). Gunakan secret berbeda dari JWT_SECRET.',
        path: ['JWT_REFRESH_SECRET'],
      });
    }

    const allowedOrigins = data.ALLOWED_ORIGINS.trim().toLowerCase();
    if (allowedOrigins === '*' || allowedOrigins === 'all') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Wildcard origin tidak diizinkan pada production dengan cookie credentials',
        path: ['ALLOWED_ORIGINS'],
      });
    }
    if (data.PUBLIC_APP_ORIGIN === undefined && allowedOrigins === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PUBLIC_APP_ORIGIN atau ALLOWED_ORIGINS wajib diisi pada production',
        path: ['PUBLIC_APP_ORIGIN'],
      });
    }
  });

export type ValidatedEnvironment = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): ValidatedEnvironment {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((error) => `${error.path.join('.')}: ${error.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  return parsed.data;
}
