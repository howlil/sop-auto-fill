import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { JenisDiagram } from '../../../../generated/prisma';

export class DiagramPathPointDto {
  @ApiProperty()
  @IsNumber()
  readonly x!: number;

  @ApiProperty()
  @IsNumber()
  readonly y!: number;
}

export class DiagramArrowConnectionDto {
  @ApiProperty({ enum: ['top', 'bottom', 'left', 'right'] })
  @IsString()
  readonly sSide!: 'top' | 'bottom' | 'left' | 'right';

  @ApiProperty({ enum: ['top', 'bottom', 'left', 'right'] })
  @IsString()
  readonly eSide!: 'top' | 'bottom' | 'left' | 'right';

  @ApiProperty({ type: DiagramPathPointDto })
  @ValidateNested()
  @Type(() => DiagramPathPointDto)
  readonly startPoint!: DiagramPathPointDto;

  @ApiProperty({ type: DiagramPathPointDto })
  @ValidateNested()
  @Type(() => DiagramPathPointDto)
  readonly endPoint!: DiagramPathPointDto;

  @ApiProperty({ type: [DiagramPathPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagramPathPointDto)
  readonly bendPoints!: DiagramPathPointDto[];
}

/** Muatan data JSON pathOverrides — kunci edge = `${dariLangkahId}|${keLangkahId}|${cabang}`. */
export class DiagramPathOverridesDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/DiagramArrowConnectionDto' },
  })
  @IsOptional()
  @IsObject()
  readonly edges?: Record<string, DiagramArrowConnectionDto>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
    },
  })
  @IsOptional()
  @IsObject()
  readonly labels?: Record<string, { x: number; y: number }>;
}

export class UpdateSopDiagramDto {
  @ApiProperty({ enum: JenisDiagram })
  @IsEnum(JenisDiagram)
  readonly jenis!: JenisDiagram;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly layoutSeed?: number;

  @ApiPropertyOptional({ type: DiagramPathOverridesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagramPathOverridesDto)
  readonly pathOverrides?: DiagramPathOverridesDto | null;
}
