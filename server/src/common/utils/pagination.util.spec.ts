import { resolvePagination, toPaginatedData } from './pagination.util';

describe('Pengujian util pagination', () => {
  it('seharusnya memakai default page dan limit ketika query kosong', () => {
    expect(resolvePagination({} as never)).toEqual({
      page: 1,
      limit: 10,
      skip: 0,
      take: 10,
    });
  });

  it('seharusnya menormalisasi page dan limit minimum ke 1', () => {
    expect(resolvePagination({ page: -5, limit: 0 })).toEqual({
      page: 1,
      limit: 1,
      skip: 0,
      take: 1,
    });
  });

  it('seharusnya menghitung skip dan take dari query valid', () => {
    expect(resolvePagination({ page: 3, limit: 25 })).toEqual({
      page: 3,
      limit: 25,
      skip: 50,
      take: 25,
    });
  });

  it('seharusnya membungkus item dan meta pagination', () => {
    expect(toPaginatedData(['a', 'b'], 11, 2, 5)).toEqual({
      items: ['a', 'b'],
      pagination: {
        page: 2,
        limit: 5,
        totalItems: 11,
        totalPages: 3,
      },
    });
  });

  it('seharusnya mengembalikan totalPages nol ketika limit tidak valid', () => {
    expect(toPaginatedData([], 10, 1, 0).pagination.totalPages).toBe(0);
  });
});
