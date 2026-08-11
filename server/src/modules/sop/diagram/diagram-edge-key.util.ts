/** Cabang koneksi diagram untuk kunci edge stabil. */
export type CabangDiagram = 'UTAMA' | 'YA' | 'TIDAK';

export interface DiagramPathOverridesJson {
  edges?: Record<
    string,
    {
      sSide: 'top' | 'bottom' | 'left' | 'right';
      eSide: 'top' | 'bottom' | 'left' | 'right';
      startPoint: { x: number; y: number };
      endPoint: { x: number; y: number };
      bendPoints: { x: number; y: number }[];
    }
  >;
  labels?: Record<string, { x: number; y: number }>;
}

export interface DiagramArrowConnectionJson {
  sSide: 'top' | 'bottom' | 'left' | 'right';
  eSide: 'top' | 'bottom' | 'left' | 'right';
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  bendPoints: { x: number; y: number }[];
}

export interface DiagramEdgeOverrideRowInput {
  detailSopId: string;
  jenis: 'FLOWCHART' | 'BPMN';
  dariLangkahSopId: string;
  keLangkahSopId: string;
  cabang: CabangDiagram;
  sSide: 'top' | 'bottom' | 'left' | 'right';
  eSide: 'top' | 'bottom' | 'left' | 'right';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface DiagramBendPointRowInput {
  detailSopId: string;
  jenis: 'FLOWCHART' | 'BPMN';
  dariLangkahSopId: string;
  keLangkahSopId: string;
  cabang: CabangDiagram;
  urutan: number;
  x: number;
  y: number;
}

export interface DiagramLabelOverrideRowInput {
  detailSopId: string;
  jenis: 'FLOWCHART' | 'BPMN';
  kunciLabel: string;
  posisiX: number;
  posisiY: number;
}

export interface DiagramEdgeOverrideReadRow {
  dariLangkahSopId: string;
  keLangkahSopId: string;
  cabang: CabangDiagram;
  sSide: 'top' | 'bottom' | 'left' | 'right';
  eSide: 'top' | 'bottom' | 'left' | 'right';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  titikTekuk: Array<{ urutan: number; x: number; y: number }>;
}

export interface DiagramLabelOverrideReadRow {
  kunciLabel: string;
  posisiX: number;
  posisiY: number;
}

export function buildDiagramEdgeKey(
  dariLangkahId: string,
  keLangkahId: string,
  cabang: CabangDiagram,
): string {
  return `${dariLangkahId}|${keLangkahId}|${cabang}`;
}

export function parseDiagramEdgeKey(key: string): {
  dariLangkahId: string;
  keLangkahId: string;
  cabang: CabangDiagram;
} | null {
  const parts = key.split('|');
  if (parts.length !== 3) return null;
  const cabang = parts[2];
  if (cabang !== 'UTAMA' && cabang !== 'YA' && cabang !== 'TIDAK') return null;
  return {
    dariLangkahId: parts[0],
    keLangkahId: parts[1],
    cabang,
  };
}

export function isValidDiagramPathOverrides(value: unknown): value is DiagramPathOverridesJson {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.edges !== undefined) {
    if (typeof obj.edges !== 'object' || obj.edges === null || Array.isArray(obj.edges)) {
      return false;
    }
    for (const edge of Object.values(obj.edges as Record<string, unknown>)) {
      if (!isValidArrowConnection(edge)) return false;
    }
  }
  if (obj.labels !== undefined) {
    if (typeof obj.labels !== 'object' || obj.labels === null || Array.isArray(obj.labels)) {
      return false;
    }
  }
  return true;
}

export function hasInvalidDiagramEdgeKeys(
  overrides: DiagramPathOverridesJson | null | undefined,
): boolean {
  if (overrides === null || overrides === undefined || overrides.edges === undefined) return false;
  for (const key of Object.keys(overrides.edges)) {
    if (parseDiagramEdgeKey(key) === null) return true;
  }
  return false;
}

export function flattenDiagramPathOverridesToRows(params: {
  detailSopId: string;
  jenis: 'FLOWCHART' | 'BPMN';
  pathOverrides: DiagramPathOverridesJson | null | undefined;
}): {
  edges: DiagramEdgeOverrideRowInput[];
  bendPoints: DiagramBendPointRowInput[];
  labels: DiagramLabelOverrideRowInput[];
} {
  const { detailSopId, jenis, pathOverrides } = params;
  if (pathOverrides === null || pathOverrides === undefined) {
    return { edges: [], bendPoints: [], labels: [] };
  }
  const edges: DiagramEdgeOverrideRowInput[] = [];
  const bendPoints: DiagramBendPointRowInput[] = [];
  for (const [key, config] of Object.entries(pathOverrides.edges ?? {})) {
    const parsed = parseDiagramEdgeKey(key);
    if (parsed === null) continue;
    edges.push({
      detailSopId,
      jenis,
      dariLangkahSopId: parsed.dariLangkahId,
      keLangkahSopId: parsed.keLangkahId,
      cabang: parsed.cabang,
      sSide: config.sSide,
      eSide: config.eSide,
      startX: config.startPoint.x,
      startY: config.startPoint.y,
      endX: config.endPoint.x,
      endY: config.endPoint.y,
    });
    config.bendPoints.forEach((point, index) => {
      bendPoints.push({
        detailSopId,
        jenis,
        dariLangkahSopId: parsed.dariLangkahId,
        keLangkahSopId: parsed.keLangkahId,
        cabang: parsed.cabang,
        urutan: index,
        x: point.x,
        y: point.y,
      });
    });
  }
  const labels: DiagramLabelOverrideRowInput[] = Object.entries(pathOverrides.labels ?? {}).map(
    ([kunciLabel, posisi]) => ({
      detailSopId,
      jenis,
      kunciLabel,
      posisiX: posisi.x,
      posisiY: posisi.y,
    }),
  );
  return { edges, bendPoints, labels };
}

export function filterFlattenedDiagramRowsByLangkahIds(
  flattened: {
    edges: DiagramEdgeOverrideRowInput[];
    bendPoints: DiagramBendPointRowInput[];
    labels: DiagramLabelOverrideRowInput[];
  },
  validLangkahIds: ReadonlySet<string>,
): {
  edges: DiagramEdgeOverrideRowInput[];
  bendPoints: DiagramBendPointRowInput[];
  labels: DiagramLabelOverrideRowInput[];
} {
  const edges = flattened.edges.filter(
    (edge) =>
      validLangkahIds.has(edge.dariLangkahSopId) && validLangkahIds.has(edge.keLangkahSopId),
  );
  const edgeKeys = new Set(
    edges.map((edge) =>
      buildDiagramEdgeKey(edge.dariLangkahSopId, edge.keLangkahSopId, edge.cabang),
    ),
  );
  const bendPoints = flattened.bendPoints.filter((point) =>
    edgeKeys.has(buildDiagramEdgeKey(point.dariLangkahSopId, point.keLangkahSopId, point.cabang)),
  );
  const labels = flattened.labels.filter((label) => edgeKeys.has(label.kunciLabel));
  return { edges, bendPoints, labels };
}

export function buildPathOverridesFromRows(params: {
  edges: DiagramEdgeOverrideReadRow[];
  labels: DiagramLabelOverrideReadRow[];
}): DiagramPathOverridesJson | null {
  const edgeMap: Record<string, DiagramArrowConnectionJson> = {};
  for (const edge of params.edges) {
    const key = buildDiagramEdgeKey(edge.dariLangkahSopId, edge.keLangkahSopId, edge.cabang);
    edgeMap[key] = {
      sSide: edge.sSide,
      eSide: edge.eSide,
      startPoint: { x: edge.startX, y: edge.startY },
      endPoint: { x: edge.endX, y: edge.endY },
      bendPoints: [...edge.titikTekuk]
        .sort((a, b) => a.urutan - b.urutan)
        .map((point) => ({ x: point.x, y: point.y })),
    };
  }
  const labelMap: Record<string, { x: number; y: number }> = {};
  for (const label of params.labels) {
    labelMap[label.kunciLabel] = { x: label.posisiX, y: label.posisiY };
  }
  const hasEdges = Object.keys(edgeMap).length > 0;
  const hasLabels = Object.keys(labelMap).length > 0;
  if (!hasEdges && !hasLabels) return null;
  return {
    edges: hasEdges ? edgeMap : undefined,
    labels: hasLabels ? labelMap : undefined,
  };
}

function isValidArrowConnection(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const sides = ['top', 'bottom', 'left', 'right'];
  if (!sides.includes(String(c.sSide)) || !sides.includes(String(c.eSide))) return false;
  if (!isValidPoint(c.startPoint) || !isValidPoint(c.endPoint)) return false;
  if (!Array.isArray(c.bendPoints)) return false;
  return c.bendPoints.every(isValidPoint);
}

function isValidPoint(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.x === 'number' && typeof p.y === 'number' && !Number.isNaN(p.x) && !Number.isNaN(p.y)
  );
}
