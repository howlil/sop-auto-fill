import { ApiProperty } from '@nestjs/swagger';
import { PenyusunWorkbenchDetailDto } from './penyusun-workbench-detail.dto';
import { PenyusunWorkbenchLangkahDto } from './penyusun-workbench-langkah.dto';
import { PenyusunWorkbenchLogEditDto } from './penyusun-workbench-log-edit.dto';
import { PenyusunWorkbenchDiagramKonfigurasiDto } from '../../diagram/dto/penyusun-workbench-diagram.dto';

export class PenyusunWorkbenchDataDto {
  @ApiProperty({ type: () => PenyusunWorkbenchDetailDto })
  readonly detail!: PenyusunWorkbenchDetailDto;

  @ApiProperty({ type: () => [PenyusunWorkbenchLangkahDto] })
  readonly langkah!: PenyusunWorkbenchLangkahDto[];

  @ApiProperty({ type: () => [PenyusunWorkbenchLogEditDto] })
  readonly logEdit!: PenyusunWorkbenchLogEditDto[];

  @ApiProperty({ type: () => PenyusunWorkbenchDiagramKonfigurasiDto, required: false })
  readonly diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasiDto;
}
