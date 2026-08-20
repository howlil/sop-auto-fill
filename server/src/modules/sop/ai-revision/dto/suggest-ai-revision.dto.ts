import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { SopQualityFinding } from '../../ai-review/sop-ai-review.types';

const SEVERITIES = ['ERROR', 'WARNING', 'SUGGESTION'] as const;
const CATEGORIES = [
  'PROCESS_STRUCTURE',
  'ACTOR_RESPONSIBILITY',
  'INPUT_OUTPUT',
  'DECISION_ROUTING',
  'CLARITY',
  'SUPPORTING_FIELD',
  'TIME_PLAUSIBILITY',
  'COMPLETENESS',
] as const;
const LOCATION_KINDS = [
  'HEADER',
  'PERINGATAN',
  'KUALIFIKASI_PELAKSANAAN',
  'PERALATAN_PERLENGKAPAN',
  'PENCATATAN_PENDATAAN',
  'ACTOR',
  'STEP',
] as const;

export class SopQualityFindingLocationDto {
  @IsIn(LOCATION_KINDS)
  readonly kind!: SopQualityFinding['location']['kind'];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  readonly actorName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  readonly stepOrder?: number;
}

export class SopQualityFindingDto {
  @IsIn(SEVERITIES)
  readonly severity!: SopQualityFinding['severity'];

  @IsIn(CATEGORIES)
  readonly category!: SopQualityFinding['category'];

  @ValidateNested()
  @Type(() => SopQualityFindingLocationDto)
  readonly location!: SopQualityFindingLocationDto;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  readonly title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  readonly explanation!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  readonly recommendation!: string;
}

export class SuggestAiRevisionDto {
  @ValidateNested()
  @Type(() => SopQualityFindingDto)
  readonly finding!: SopQualityFindingDto;
}
