export type SopCatalogRepoFailureReason =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'BAD_REQUEST';

export type SopCatalogRepoResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly reason: SopCatalogRepoFailureReason;
      readonly message: string;
    };

export function sopCatalogRepoOk<T>(data: T): SopCatalogRepoResult<T> {
  return { ok: true, data };
}

export function sopCatalogRepoFail<T>(
  reason: SopCatalogRepoFailureReason,
  message: string,
): SopCatalogRepoResult<T> {
  return { ok: false, reason, message };
}
