import { JwtService } from '@nestjs/jwt';
import {
  E2E_IDENTITY,
  assertDisposableE2eDatabase,
  assertE2eEnvironment,
  issueE2eAccessToken,
} from './e2e-session.helper';

describe('E2E session helper', () => {
  it('rejects execution without the explicit E2E marker', () => {
    expect(() =>
      assertE2eEnvironment({ NODE_ENV: 'test', E2E_TEST: undefined }),
    ).toThrow('E2E_TEST=1');
  });

  it('rejects execution in production even with the E2E marker', () => {
    expect(() =>
      assertE2eEnvironment({ NODE_ENV: 'production', E2E_TEST: '1' }),
    ).toThrow('production');
  });

  it('rejects a database name that is not explicitly test/e2e', () => {
    expect(() =>
      assertDisposableE2eDatabase({ host: '127.0.0.1', database: 'sop_app' }),
    ).toThrow('database');
  });

  it('rejects a remote database host', () => {
    expect(() =>
      assertDisposableE2eDatabase({ host: 'db.internal.example', database: 'sop_e2e' }),
    ).toThrow('localhost');
  });

  it('accepts a local disposable E2E database', () => {
    expect(() =>
      assertDisposableE2eDatabase({ host: '127.0.0.1', database: 'sop_e2e' }),
    ).not.toThrow();
  });

  it('issues a JWT accepted with the configured test secret and current auth payload', async () => {
    const secret = 'e2e-secret-that-is-long-enough-for-tests-only';
    const token = await issueE2eAccessToken(secret, {
      userId: 'user-e2e-1',
      email: E2E_IDENTITY.email,
      name: E2E_IDENTITY.name,
    });

    const payload = await new JwtService({ secret }).verifyAsync(token);
    expect(payload).toMatchObject({
      sub: 'user-e2e-1',
      email: E2E_IDENTITY.email,
      name: E2E_IDENTITY.name,
    });
  });
});
