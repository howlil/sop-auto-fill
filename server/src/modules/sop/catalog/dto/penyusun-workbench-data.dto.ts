import { ApiProperty } from '@nestjs/swagger';
import { PenyusunWorkbenchDetailDto } from './penyusun-workbench-detail.dto';
import { PenyusunWorkbenchLangkahDto } from './penyusun-workbench-langkah.dto';
import { PenyusunWorkbenchLogEditDto } from './penyusun-workbench-log-edit.dto';
import { PenyusunWorkbenchDiagramKonfigurasiDto } from '../../diagram/dto/penyusun-workbench-diagram.dto';
import { BeritaAcaraTteSignaturePayloadDto } from '../../../evaluation/pengajuan-detail/dto/berita-acara-evaluasi-view.dto';

/** Muatan data GET area kerja penyusun: detail + semua langkah + log (satu respons). */
export class PenyusunWorkbenchDataDto {
  @ApiProperty({ type: () => PenyusunWorkbenchDetailDto })
  readonly detail!: PenyusunWorkbenchDetailDto;

  @ApiProperty({
    type: () => [PenyusunWorkbenchLangkahDto],
    description: 'Semua langkah prosedur berurutan; tidak dipaginasi.',
  })
  readonly langkah!: PenyusunWorkbenchLangkahDto[];

  @ApiProperty({ type: () => [PenyusunWorkbenchLogEditDto] })
  readonly logEdit!: PenyusunWorkbenchLogEditDto[];

  @ApiProperty({ type: () => PenyusunWorkbenchDiagramKonfigurasiDto, required: false })
  readonly diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasiDto;

  @ApiProperty({ type: () => BeritaAcaraTteSignaturePayloadDto, required: false })
  readonly tteSignaturePayloadKepalaOpd?: BeritaAcaraTteSignaturePayloadDto;
}
