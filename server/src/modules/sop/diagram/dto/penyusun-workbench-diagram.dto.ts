import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiagramPathOverridesDto } from './diagram-path-overrides.dto';

export class PenyusunWorkbenchDiagramSliceDto {
  @ApiProperty()
  readonly layoutSeed!: number;

  @ApiPropertyOptional({ type: DiagramPathOverridesDto, nullable: true })
  readonly pathOverrides!: DiagramPathOverridesDto | null;
}

export class PenyusunWorkbenchDiagramKonfigurasiDto {
  @ApiPropertyOptional({ type: PenyusunWorkbenchDiagramSliceDto })
  readonly flowchart?: PenyusunWorkbenchDiagramSliceDto;

  @ApiPropertyOptional({ type: PenyusunWorkbenchDiagramSliceDto })
  readonly bpmn?: PenyusunWorkbenchDiagramSliceDto;
}
