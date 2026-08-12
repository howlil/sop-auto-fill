export type SopCatalogRepoFailureReason =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'BAD_REQUEST';

export type SopCatalogRepoResult<T> =
  | { readonly ok: true; readonly data: T; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: SopCatalogRepoFailureReason;
      readonly message: string;
      readonly value: never;
    };

export function sopCatalogRepoOk<T>(data: T): SopCatalogRepoResult<T> {
  return { ok: true, data, value: data };
}

export function sopCatalogRepoFail<T>(
  reason: SopCatalogRepoFailureReason,
  message: string,
): SopCatalogRepoResult<T> {
  return { ok: false, reason, message, value: undefined as never };
}
