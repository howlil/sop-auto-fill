import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { StatusSOP } from '../../../../generated/prisma';

const STATUS_FILTER_VALUES = [...Object.values(StatusSOP), 'all'] as const;

export class ListSopQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Workspace yang sedang dibuka' })
  @IsUUID()
  readonly workspaceId!: string;

  @ApiPropertyOptional({ enum: STATUS_FILTER_VALUES })
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES as unknown as string[])
  readonly status?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly tanggalDari?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly tanggalSampai?: string;
}
