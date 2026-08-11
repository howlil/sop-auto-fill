import type { PaginationQueryDto } from '../dto/pagination-query.dto';

export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: PaginationMeta;
};

/** Hitung `skip` / `take` untuk Prisma dari query yang sudah divalidasi. */
export function resolvePagination(query: PaginationQueryDto): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.max(1, query.limit ?? 10);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/** Bungkus hasil query + total menjadi bentuk `data` untuk respons API. */
export function toPaginatedData<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedData<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    items,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages,
    },
  };
}
