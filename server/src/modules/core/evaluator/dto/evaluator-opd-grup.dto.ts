import { ApiProperty } from '@nestjs/swagger';
import { AnggotaEvaluatorItemDto } from './anggota-evaluator-item.dto';

/** Grup evaluator per OPD Biro untuk GET list. */
export class EvaluatorOpdGrupDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly namaOpd!: string;

  @ApiProperty({ type: [AnggotaEvaluatorItemDto] })
  readonly evaluator!: AnggotaEvaluatorItemDto[];
}
