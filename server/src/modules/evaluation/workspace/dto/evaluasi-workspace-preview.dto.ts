import { ApiProperty } from '@nestjs/swagger';
import { PenyusunWorkbenchDataDto } from '../../../sop/catalog/dto/penyusun-workbench-data.dto';

/**
 * Pratinjau dokumen untuk satu DetailSOP (subset selaras GET area kerja penyusun).
 * Klien memetakan `workbench` ke props SOPPreviewTemplate.
 */
export class EvaluasiWorkspacePreviewDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty({ type: () => PenyusunWorkbenchDataDto })
  readonly workbench!: PenyusunWorkbenchDataDto;
}
