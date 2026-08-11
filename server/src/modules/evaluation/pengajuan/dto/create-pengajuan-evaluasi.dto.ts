import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsUUID } from 'class-validator';
import { JenisPengajuanEvaluasi } from '../../../../generated/prisma';

/** Body POST `/evaluasi` — buka pengajuan evaluasi untuk sekumpulan DetailSOP satu OPD (PJ Evaluator). */
export class CreatePengajuanEvaluasiDto {
  @ApiProperty({ enum: JenisPengajuanEvaluasi })
  @IsEnum(JenisPengajuanEvaluasi)
  readonly jenis!: JenisPengajuanEvaluasi;

  @ApiProperty({
    type: [String],
    description: 'Minimal satu DetailSOP milik OPD, siap masuk evaluasi',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  readonly sopDetailIds!: string[];
}
