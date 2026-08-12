import { z } from 'zod';

const envBoolean = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    const normalized = val.trim().toLowerCase();
    if (normalized === '') return undefined;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return val;
  }, z.boolean().default(defaultValue));

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : value);
const optionalUrl = z.preprocess(
  (value) => {
    const normalized = trimmed(value);
    return normalized === '' ? undefined : normalized;
  },
  z.string().url().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    ALLOWED_ORIGINS: z.preprocess(trimmed, z.string().default('')),
    SWAGGER_ENABLED: envBoolean(true),

    JWT_SECRET: z.string().min(32),
    JWT_EXPIRATION: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().default('7d'),
    ),
    GOOGLE_CLIENT_ID: z.preprocess(trimmed, z.string().min(10)),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_NAME: z.string().min(1),
    DATABASE_URL: z.string().url().optional(),

    PUBLIC_APP_ORIGIN: optionalUrl,
    SOP_PDF_STORAGE_DIR: z.preprocess(
      trimmed,
      z.string().min(1).default('/app/storage/sop-pdf'),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;

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
