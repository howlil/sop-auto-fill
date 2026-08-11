import {
  buildDiagramEdgeKey,
  filterFlattenedDiagramRowsByLangkahIds,
  flattenDiagramPathOverridesToRows,
  hasInvalidDiagramEdgeKeys,
  parseDiagramEdgeKey,
} from './diagram-edge-key.util';

describe('Pengujian util kunci edge diagram', () => {
  it('seharusnya mendeteksi tidak valid edge key', () => {
    expect(
      hasInvalidDiagramEdgeKeys({
        edges: {
          'invalid-key': {
            sSide: 'bottom',
            eSide: 'top',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 10, y: 10 },
            bendPoints: [],
          },
        },
      }),
    ).toBe(true);
  });

  it('seharusnya meratakan path overrides menjadi relasional baris', () => {
    const edgeKey = buildDiagramEdgeKey('from-1', 'to-1', 'UTAMA');
    const actual = flattenDiagramPathOverridesToRows({
      detailSopId: 'detail-1',
      jenis: 'FLOWCHART',
      pathOverrides: {
        edges: {
          [edgeKey]: {
            sSide: 'bottom',
            eSide: 'top',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 10, y: 10 },
            bendPoints: [{ x: 5, y: 5 }],
          },
        },
        labels: {
          [edgeKey]: { x: 3, y: 4 },
        },
      },
    });

    expect(actual.edges).toHaveLength(1);
    expect(actual.edges[0]?.dariLangkahSopId).toBe('from-1');
    expect(actual.edges[0]?.keLangkahSopId).toBe('to-1');
    expect(actual.bendPoints).toHaveLength(1);
    expect(actual.bendPoints[0]?.urutan).toBe(0);
    expect(actual.labels).toHaveLength(1);
  });

  it('seharusnya memproses valid edge key', () => {
    const key = buildDiagramEdgeKey('from-1', 'to-1', 'UTAMA');
    expect(parseDiagramEdgeKey(key)?.dariLangkahId).toBe('from-1');
    expect(parseDiagramEdgeKey(key)?.keLangkahId).toBe('to-1');
  });

  it('seharusnya membuang edge dengan ID langkah yang tidak dikenal', () => {
    const validKey = buildDiagramEdgeKey('langkah-a', 'langkah-b', 'UTAMA');
    const invalidKey = buildDiagramEdgeKey('start-terminator', 'langkah-b', 'UTAMA');
    const flattened = flattenDiagramPathOverridesToRows({
      detailSopId: 'detail-1',
      jenis: 'BPMN',
      pathOverrides: {
        edges: {
          [validKey]: {
            sSide: 'bottom',
            eSide: 'top',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 10, y: 10 },
            bendPoints: [],
          },
          [invalidKey]: {
            sSide: 'bottom',
            eSide: 'top',
            startPoint: { x: 1, y: 1 },
            endPoint: { x: 2, y: 2 },
            bendPoints: [],
          },
        },
        labels: {
          [validKey]: { x: 3, y: 4 },
          [invalidKey]: { x: 5, y: 6 },
        },
      },
    });
    const actual = filterFlattenedDiagramRowsByLangkahIds(
      flattened,
      new Set(['langkah-a', 'langkah-b']),
    );
    expect(actual.edges).toHaveLength(1);
    expect(actual.edges[0]?.dariLangkahSopId).toBe('langkah-a');
    expect(actual.labels).toHaveLength(1);
    expect(actual.labels[0]?.kunciLabel).toBe(validKey);
  });
});
