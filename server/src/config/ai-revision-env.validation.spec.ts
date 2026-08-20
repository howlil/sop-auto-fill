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

describe('AI revision environment validation', () => {
  it('defaults revision runtime to disabled with 30 second timeout', () => {
    expect(validateEnv(baseEnv)).toMatchObject({
      AI_REVISION_PROVIDER: 'disabled',
      AI_REVISION_TIMEOUT_MS: 30000,
    });
  });

  it('requires the existing OpenAI key and model when revision uses openai', () => {
    expect(() => validateEnv({ ...baseEnv, AI_REVISION_PROVIDER: 'openai' })).toThrow(
      /OPENAI_API_KEY/,
    );
    expect(() =>
      validateEnv({
        ...baseEnv,
        AI_REVISION_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-key',
      }),
    ).toThrow(/OPENAI_MODEL/);
    expect(
      validateEnv({
        ...baseEnv,
        AI_REVISION_PROVIDER: 'openai',
        OPENAI_API_KEY: ' sk-test-key ',
        OPENAI_MODEL: ' gpt-test-model ',
        AI_REVISION_TIMEOUT_MS: '45000',
      }),
    ).toMatchObject({
      AI_REVISION_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test-key',
      OPENAI_MODEL: 'gpt-test-model',
      AI_REVISION_TIMEOUT_MS: 45000,
    });
  });

  it('enforces the 5000..60000 ms timeout boundary', () => {
    expect(() => validateEnv({ ...baseEnv, AI_REVISION_TIMEOUT_MS: '4999' })).toThrow(
      /AI_REVISION_TIMEOUT_MS/,
    );
    expect(() => validateEnv({ ...baseEnv, AI_REVISION_TIMEOUT_MS: '60001' })).toThrow(
      /AI_REVISION_TIMEOUT_MS/,
    );
    expect(validateEnv({ ...baseEnv, AI_REVISION_TIMEOUT_MS: '5000' })).toMatchObject({
      AI_REVISION_TIMEOUT_MS: 5000,
    });
    expect(validateEnv({ ...baseEnv, AI_REVISION_TIMEOUT_MS: '60000' })).toMatchObject({
      AI_REVISION_TIMEOUT_MS: 60000,
    });
  });

  it('allows fake in test but rejects it in production', () => {
    expect(validateEnv({ ...baseEnv, AI_REVISION_PROVIDER: 'fake' })).toMatchObject({
      AI_REVISION_PROVIDER: 'fake',
    });
    expect(() =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        PUBLIC_APP_ORIGIN: 'https://sop.example.test',
        ALLOWED_ORIGINS: 'https://sop.example.test',
        AI_REVISION_PROVIDER: 'fake',
      }),
    ).toThrow(/AI_REVISION_PROVIDER/);
  });
});
