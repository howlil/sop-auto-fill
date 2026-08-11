import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { LangkahPatchItem } from './langkah-patch-item.dto';
import { PelaksanaPatchItem } from './pelaksana-patch-item.dto';

/**
 * Muatan data PATCH prosedur SOP — semua field opsional, ramah simpan otomatis.
 * - `pelaksana` (jika diset) mengganti semua jalur pelaksana (DetailSOPPelaksana).
 * - `langkah` (jika diset) mengganti semua langkah prosedur (LangkahSOP) beserta
 *   relasi cabang Ya/Tidak via `tempId` antar entri.
 */
export class UpdateSopProsedurDto {
  @ApiPropertyOptional({
    type: [PelaksanaPatchItem],
    description:
      'Daftar pelaksana di jalur pelaksana (ganti semua). Urutan = posisi index di array.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PelaksanaPatchItem)
  readonly pelaksana?: PelaksanaPatchItem[];

  @ApiPropertyOptional({
    type: [LangkahPatchItem],
    description: 'Daftar langkah prosedur (ganti semua). Urutan = posisi index di array.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LangkahPatchItem)
  readonly langkah?: LangkahPatchItem[];
}
