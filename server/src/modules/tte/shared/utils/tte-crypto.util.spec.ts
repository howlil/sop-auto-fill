import * as crypto from 'crypto';
import {
  decryptP12Passphrase,
  encryptP12Passphrase,
  isLegacyP12PassphraseCiphertext,
} from './tte-crypto.util';

const TEST_SECRET = 'test-tte-encryption-secret-that-is-long-enough-123456';

describe('tte-crypto.util', () => {
  const previousSecret = process.env.TTE_ENCRYPTION_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.TTE_ENCRYPTION_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.TTE_ENCRYPTION_SECRET;
    else process.env.TTE_ENCRYPTION_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('mengenkripsi ciphertext v2 dan dapat didekripsi dengan PIN + secret yang benar', () => {
    const encrypted = encryptP12Passphrase('p12-secret-passphrase', '123456');

    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(isLegacyP12PassphraseCiphertext(encrypted)).toBe(false);
    expect(decryptP12Passphrase(encrypted, '123456')).toBe('p12-secret-passphrase');
  });

  it('menolak PIN yang salah', () => {
    const encrypted = encryptP12Passphrase('p12-secret-passphrase', '123456');

    expect(() => decryptP12Passphrase(encrypted, '654321')).toThrow();
  });

  it('menolak ciphertext v2 jika server secret berbeda', () => {
    const encrypted = encryptP12Passphrase('p12-secret-passphrase', '123456');
    process.env.TTE_ENCRYPTION_SECRET = 'different-server-secret-that-is-long-enough-654321';

    expect(() => decryptP12Passphrase(encrypted, '123456')).toThrow();
  });

  it('tetap dapat membaca ciphertext legacy agar kredensial lama bisa dimigrasikan', () => {
    const legacy = legacyEncrypt('legacy-passphrase', '123456');

    expect(isLegacyP12PassphraseCiphertext(legacy)).toBe(true);
    expect(decryptP12Passphrase(legacy, '123456')).toBe('legacy-passphrase');
  });
});

function legacyEncrypt(passphrase: string, pin: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(pin, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(passphrase, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}
