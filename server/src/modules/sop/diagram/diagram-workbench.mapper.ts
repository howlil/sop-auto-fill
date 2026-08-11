import { JenisDiagram } from '../../../generated/prisma';
import type { PenyusunWorkbenchDiagramKonfigurasiDto } from './dto/penyusun-workbench-diagram.dto';
import { buildPathOverridesFromRows } from './diagram-edge-key.util';

export function mapDiagramConfigsToWorkbenchDto(
  configs:
    | Array<{
        jenis: JenisDiagram;
        layoutSeed: number;
        overridePanah: Array<{
          dariLangkahSopId: string;
          keLangkahSopId: string;
          cabang: 'UTAMA' | 'YA' | 'TIDAK';
          sSide: 'top' | 'bottom' | 'left' | 'right';
          eSide: 'top' | 'bottom' | 'left' | 'right';
          startX: number;
          startY: number;
          endX: number;
          endY: number;
          titikTekuk: Array<{ urutan: number; x: number; y: number }>;
        }>;
        overrideLabel: Array<{
          kunciLabel: string;
          posisiX: number;
          posisiY: number;
        }>;
      }>
    | null
    | undefined,
): PenyusunWorkbenchDiagramKonfigurasiDto | undefined {
  const out: {
    flowchart?: PenyusunWorkbenchDiagramKonfigurasiDto['flowchart'];
    bpmn?: PenyusunWorkbenchDiagramKonfigurasiDto['bpmn'];
  } = {};
  for (const cfg of configs ?? []) {
    const slice = {
      layoutSeed: cfg.layoutSeed,
      pathOverrides: buildPathOverridesFromRows({
        edges: cfg.overridePanah,
        labels: cfg.overrideLabel,
      }),
    };
    if (cfg.jenis === JenisDiagram.FLOWCHART) {
      out.flowchart = slice;
    } else if (cfg.jenis === JenisDiagram.BPMN) {
      out.bpmn = slice;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
