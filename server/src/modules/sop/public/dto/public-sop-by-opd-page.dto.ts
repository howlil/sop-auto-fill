import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedData } from '../../../../common/utils/pagination.util';
import { PublicSopItemDto } from './public-sop-item.dto';

/** Respons daftar SOP per OPD beserta meta OPD (satu round-trip). */
export class PublicSopByOpdPageDto implements PaginatedData<PublicSopItemDto> {
  @ApiProperty({ type: [PublicSopItemDto] })
  readonly items!: PublicSopItemDto[];

  @ApiProperty()
  readonly pagination!: PaginatedData<PublicSopItemDto>['pagination'];

  @ApiProperty({ description: 'OPD pemilik daftar SOP' })
  readonly opd!: { opdId: string; nama: string };
}
