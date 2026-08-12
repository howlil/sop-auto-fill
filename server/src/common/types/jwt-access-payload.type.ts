/** Minimal JWT payload for an authenticated Google-backed user. */
export type JwtAccessPayload = {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
};
