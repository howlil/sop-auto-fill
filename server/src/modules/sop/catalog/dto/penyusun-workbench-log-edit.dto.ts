import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PenyusunWorkbenchLogEditMetaDto {
  @ApiProperty({ type: [String] })
  readonly fields!: string[];

  @ApiProperty()
  readonly count!: number;
}

export class PenyusunWorkbenchLogEditDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly sopDetailId!: string;

  @ApiProperty()
  readonly userId!: string;

  @ApiProperty({ enum: ['HEADER', 'LANGKAH', 'STATUS'] })
  readonly bagian!: 'HEADER' | 'LANGKAH' | 'STATUS';

  @ApiPropertyOptional({ nullable: true })
  readonly keterangan?: string | null;

  @ApiPropertyOptional({ type: () => PenyusunWorkbenchLogEditMetaDto, nullable: true })
  readonly meta?: PenyusunWorkbenchLogEditMetaDto | null;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly closedAt?: string | null;

  @ApiPropertyOptional()
  readonly user?: { id: string; nama: string; email: string };
}
