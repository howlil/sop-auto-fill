import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { JwtAccessPayload } from '../types/jwt-access-payload.type';

export const E2E_IDENTITY = Object.freeze({
  googleSub: 'sop-auto-fill-e2e-user',
  email: 'e2e@sop-auto-fill.test',
  name: 'E2E User',
});

type E2eEnvironment = {
  readonly NODE_ENV?: string;
  readonly E2E_TEST?: string;
};

type E2eUser = {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
};

export function assertE2eEnvironment(env: E2eEnvironment): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('E2E test harness tidak boleh dijalankan pada NODE_ENV=production');
  }
  if (env.E2E_TEST !== '1') {
    throw new Error('E2E test harness membutuhkan E2E_TEST=1');
  }
}

export async function issueE2eAccessToken(
  secret: string,
  user: E2eUser,
): Promise<string> {
  if (secret.trim() === '') {
    throw new Error('JWT_SECRET wajib diisi untuk E2E session');
  }

  const payload: JwtAccessPayload = {
    sub: user.userId,
    email: user.email,
    name: user.name,
  };
  const signOptions: JwtSignOptions = { expiresIn: 15 * 60 };
  return new JwtService({ secret }).signAsync(payload, signOptions);
}
