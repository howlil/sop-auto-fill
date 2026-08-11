import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { SopCatalogRepoResult } from './sop-catalog.repo-result';

export function assertSopCatalogRepoOk<T>(result: SopCatalogRepoResult<T>): T {
  if (result.ok) {
    return result.data;
  }
  switch (result.reason) {
    case 'NOT_FOUND':
      throw new NotFoundException(result.message);
    case 'CONFLICT':
      throw new ConflictException(result.message);
    case 'BAD_REQUEST':
    case 'INVALID_STATE':
      throw new BadRequestException(result.message);
    default:
      throw new BadRequestException(result.message);
  }
}
