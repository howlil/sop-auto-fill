import {
  Document,
  Image,
  Page,
  Polygon,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import appLogoUrl from "@/assets/logo.svg";
import { SOP_INSTITUTION_LOGO_URL } from "@/lib/sop/sop-institution-logo";
import { getInitialSopDetailMetadata } from "@/lib/sop/detailSop.initial-state";
import { getFullTimeUnit } from "@/components/sop/sop-diagram/core/sopDiagramTypes";
import type { DiagramPageSnapshot } from "@/lib/print/sop-diagram-export.util";
import type { SOPPreviewTemplateProps } from "@/components/sop/sop-preview-template";
import type { ProsedurRow, SOPDetailMetadata } from "@/types/ui/sop";
import type { PenyusunWorkbenchDiagramKonfigurasi } from "@/types/dto/sop.dto";
import type { TTESignaturePayload } from "@/types/dto/tte.dto";
import { formatIsoToDdMmYyyyWib } from "@/utils/format-date";

export type SopPdfPrintMode =
  | "full"
  | "steps_only"
  | "diagrams_only"
  | "steps_and_diagrams"
  | "header_and_steps"
  | "header_steps_bpmn";

export interface SopPdfDocumentProps {
  name?: string;
  number?: string;
  metadata?: SOPPreviewTemplateProps["metadata"];
  prosedurRows?: ProsedurRow[];
  implementers?: { id: string; name: string }[];
  tteSignaturePayload?: TTESignaturePayload | null;
  qrDataUrlKepalaOpd?: string;
  includeHeader?: boolean;
  printMode?: SopPdfPrintMode;
  diagramSnapshots?: DiagramPageSnapshot[];
  diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasi;
}

const DEFAULT_METADATA = getInitialSopDetailMetadata();
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const PAGE_PADDING = 28;
const CONTENT_WIDTH = A4_LANDSCAPE[0] - PAGE_PADDING * 2;
const STEP_ROWS_PER_PAGE = 8;
const SIGNATURE_ROLE_BOTTOM_MARGIN = 8;
const SIGNATURE_NAME_TOP_MARGIN = 8;

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#000000",
  },
  centeredPage: {
    padding: PAGE_PADDING,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  headerSheet: {
    width: CONTENT_WIDTH,
  },
  table: {
    width: "100%",
    borderTopWidth: 1.4,
    borderLeftWidth: 1.4,
    borderColor: "#000000",
  },
  row: {
    flexDirection: "row",
    width: "100%",
  },
  cell: {
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    padding: 3,
    minHeight: 16,
  },
  cellTight: {
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    padding: 2,
    minHeight: 14,
  },
  label: {
    fontFamily: "Helvetica-Bold",
  },
  centerText: {
    textAlign: "center",
  },
  justifyText: {
    textAlign: "justify",
  },
  logo: {
    width: 74,
    height: 92,
    objectFit: "contain",
    alignSelf: "center",
    marginBottom: 8,
  },
  institutionText: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    fontSize: 8,
    lineHeight: 1.2,
  },
  signatureQr: {
    width: 54,
    height: 54,
    alignSelf: "center",
  },
  signatureRole: {
    fontSize: 7,
    marginBottom: SIGNATURE_ROLE_BOTTOM_MARGIN,
    textAlign: "center",
  },
  signatureName: {
    marginTop: SIGNATURE_NAME_TOP_MARGIN,
  },
  signatureSpacer: {
    height: 44,
  },
  stepTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  stepHeaderCell: {
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    backgroundColor: "#d9d9d9",
    padding: 3,
    minHeight: 18,
    justifyContent: "center",
  },
  stepBodyCell: {
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    padding: 3,
    minHeight: 48,
  },
  stepText: {
    fontSize: 7,
    lineHeight: 1.25,
  },
  stepSheet: {
    width: CONTENT_WIDTH,
  },
  brandMark: {
    position: "absolute",
    right: PAGE_PADDING,
    bottom: 10,
    width: 24,
    height: 24,
    objectFit: "contain",
  },
  pageNumber: {
    position: "absolute",
    left: PAGE_PADDING,
    bottom: 14,
    fontSize: 7,
    color: "#374151",
  },
});

function SopPdfBrandMark() {
  return <Image src={appLogoUrl} style={styles.brandMark} />;
}

function resolvePrintSections(props: SopPdfDocumentProps): {
  showHeader: boolean;
  showSteps: boolean;
  showDiagrams: boolean;
} {
  const printMode = props.printMode ?? (props.includeHeader === false ? "diagrams_only" : "full");
  const hasDiagrams = (props.diagramSnapshots?.length ?? 0) > 0;
  const showHeader =
    props.includeHeader !== false && printMode !== "diagrams_only" && printMode !== "steps_only";
  const showSteps =
    printMode === "full" ||
    printMode === "header_and_steps" ||
    printMode === "steps_only" ||
    printMode === "steps_and_diagrams" ||
    (printMode === "diagrams_only" && !hasDiagrams);
  const showDiagrams =
    hasDiagrams &&
    (printMode === "full" ||
      printMode === "diagrams_only" ||
      printMode === "steps_and_diagrams" ||
      printMode === "header_steps_bpmn");
  return { showHeader, showSteps, showDiagrams };
}

function diagramPageLabel(snapshot: DiagramPageSnapshot): string {
  const kindLabel = snapshot.kind === "bpmn" ? "BPMN" : "Flowchart";
  return `${kindLabel} ${snapshot.pageIndex + 1}`;
}

function toArrayField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item) => item.trim() !== "");
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

function headerDisplayDate(raw: string | undefined): string {
  const s = raw?.trim() ?? "";
  if (!s) return "";
  if (s.includes("T") || s.endsWith("Z")) return formatIsoToDdMmYyyyWib(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatIsoToDdMmYyyyWib(`${s}T12:00:00+07:00`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

function normalizeMetadata(
  nameOverride?: string,
  numberOverride?: string,
  metadataOverride?: SOPPreviewTemplateProps["metadata"],
) {
  const metadata = metadataOverride as Partial<SOPDetailMetadata> | undefined;
  return {
    ...DEFAULT_METADATA,
    ...(nameOverride != null && { name: nameOverride }),
    ...(numberOverride != null && { number: numberOverride }),
    ...metadataOverride,
    implementQualification:
      typeof metadataOverride?.implementQualification === "string"
        ? [metadataOverride.implementQualification]
        : (metadataOverride?.implementQualification ??
          (Array.isArray(DEFAULT_METADATA.implementQualification)
            ? DEFAULT_METADATA.implementQualification
            : [])),
    equipment:
      typeof metadataOverride?.equipment === "string"
        ? [metadataOverride.equipment]
        : (metadataOverride?.equipment ??
          (Array.isArray(DEFAULT_METADATA.equipment) ? DEFAULT_METADATA.equipment : [])),
    recordData:
      typeof metadataOverride?.recordData === "string"
        ? [metadataOverride.recordData]
        : (metadataOverride?.recordData ??
          (Array.isArray(DEFAULT_METADATA.recordData) ? DEFAULT_METADATA.recordData : [])),
    ...(metadata?.tanggalPembuatan != null && String(metadata.tanggalPembuatan).trim() !== ""
      ? { createdDate: String(metadata.tanggalPembuatan) }
      : {}),
    ...(metadata?.tanggalRevisi != null && String(metadata.tanggalRevisi).trim() !== ""
      ? { revisionDate: String(metadata.tanggalRevisi) }
      : {}),
    ...(metadata?.tanggalEfektif != null && String(metadata.tanggalEfektif).trim() !== ""
      ? { effectiveDate: String(metadata.tanggalEfektif) }
      : {}),
    ...(metadata && !metadata.name && metadata.nama != null && String(metadata.nama).trim() !== ""
      ? { name: String(metadata.nama) }
      : {}),
  };
}

function splitRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function ListText({ items, ordered = true }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) {
    return <Text> - </Text>;
  }
  return (
    <View>
      {items.map((item, index) => (
        <Text key={`${ordered ? "ordered" : "plain"}-${item}`} style={styles.stepText}>
          {ordered ? `${index + 1}. ` : "- "}
          {item}
        </Text>
      ))}
    </View>
  );
}

function HeaderPage({
  metadata,
  tteSignaturePayload,
  qrDataUrlKepalaOpd,
}: {
  metadata: ReturnType<typeof normalizeMetadata>;
  tteSignaturePayload?: TTESignaturePayload | null;
  qrDataUrlKepalaOpd?: string;
}) {
  const institutionLines = metadata.institutionLines ?? [];
  const lawBasis = toArrayField(metadata.lawBasis);
  const implementQualification = toArrayField(metadata.implementQualification);
  const relatedSop = toArrayField(metadata.relatedSop);
  const equipment = toArrayField(metadata.equipment);
  const warning = toArrayField(metadata.warning);
  const recordData = toArrayField(metadata.recordData);
  const revisionDate =
    Number(metadata.version ?? 1) > 1 ? headerDisplayDate(metadata.revisionDate) : "";

  return (
    <Page size="A4" orientation="landscape" style={styles.centeredPage}>
      <View style={styles.headerSheet}>
        <View style={styles.table}>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "45%", minHeight: 160, alignItems: "center" }]}>
              <Image src={SOP_INSTITUTION_LOGO_URL} style={styles.logo} />
              {institutionLines.length > 0 ? (
                institutionLines.slice(0, 4).map((line) => (
                  <Text key={line} style={styles.institutionText}>
                    {line}
                  </Text>
                ))
              ) : (
                <Text style={styles.institutionText}> - </Text>
              )}
            </View>
            <View style={{ width: "55%" }}>
              {[
                ["NOMOR SOP", metadata.number || metadata.nomorSOP || " - "],
                ["TANGGAL PEMBUATAN", headerDisplayDate(metadata.createdDate)],
                ["TANGGAL REVISI", revisionDate],
                ["TANGGAL EFEKTIF", headerDisplayDate(metadata.effectiveDate) || " - "],
              ].map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <View style={[styles.cellTight, { width: "47%" }]}>
                    <Text style={styles.label}>{label}</Text>
                  </View>
                  <View style={[styles.cellTight, { width: "5%" }]}>
                    <Text style={styles.centerText}>:</Text>
                  </View>
                  <View style={[styles.cellTight, { width: "48%" }]}>
                    <Text>{value}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.row}>
                <View style={[styles.cellTight, { width: "47%", minHeight: 110 }]}>
                  <Text style={styles.label}>DISAHKAN OLEH</Text>
                </View>
                <View style={[styles.cellTight, { width: "5%", minHeight: 110 }]}>
                  <Text style={styles.centerText}>:</Text>
                </View>
                <View
                  style={[styles.cellTight, { width: "48%", minHeight: 110, alignItems: "center", justifyContent: "center" }]}
                >
                  <Text style={styles.signatureRole}>
                    {metadata.picRole || "Penanggung Jawab"},
                  </Text>
                  {qrDataUrlKepalaOpd ? (
                    <Image src={qrDataUrlKepalaOpd} style={styles.signatureQr} />
                  ) : (
                    <View style={styles.signatureSpacer} />
                  )}
                  <Text style={[styles.label, styles.centerText, styles.signatureName]}>
                    {tteSignaturePayload?.namaLengkap || metadata.picName || " - "}
                  </Text>
                  <Text style={[styles.centerText, { fontSize: 7 }]}>
                    NIP. {tteSignaturePayload?.nip || metadata.picNumber || " - "}
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.cellTight, { width: "47%" }]}>
                  <Text style={styles.label}>SOP</Text>
                </View>
                <View style={[styles.cellTight, { width: "5%" }]}>
                  <Text style={styles.centerText}>:</Text>
                </View>
                <View style={[styles.cellTight, { width: "48%" }]}>
                  <Text style={styles.label}>{metadata.name || " - "}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cellTight, { width: "45%" }]}>
              <Text style={styles.label}>DASAR HUKUM</Text>
            </View>
            <View style={[styles.cellTight, { width: "55%" }]}>
              <Text style={styles.label}>KUALIFIKASI PELAKSANAAN</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "45%", minHeight: 58 }]}>
              <ListText items={lawBasis} />
            </View>
            <View style={[styles.cell, { width: "55%", minHeight: 58 }]}>
              <ListText items={implementQualification} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cellTight, { width: "45%" }]}>
              <Text style={styles.label}>KETERKAITAN DENGAN SOP LAIN</Text>
            </View>
            <View style={[styles.cellTight, { width: "55%" }]}>
              <Text style={styles.label}>PERALATAN / PERLENGKAPAN</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "45%", minHeight: 48 }]}>
              <ListText items={relatedSop} />
            </View>
            <View style={[styles.cell, { width: "55%", minHeight: 48 }]}>
              <ListText items={equipment} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.cellTight, { width: "45%" }]}>
              <Text style={styles.label}>PERINGATAN</Text>
            </View>
            <View style={[styles.cellTight, { width: "55%" }]}>
              <Text style={styles.label}>PENCATATAN DAN PENDATAAN</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.cell, { width: "45%", minHeight: 48 }]}>
              <ListText items={warning} />
            </View>
            <View style={[styles.cell, { width: "55%", minHeight: 48 }]}>
              <ListText items={recordData} ordered={false} />
            </View>
          </View>
        </View>
      </View>
      <SopPdfBrandMark />
    </Page>
  );
}

function FlowShape({ type }: { type?: ProsedurRow["type"] }) {
  if (type === "decision") {
    return (
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Polygon points="14,1 27,14 14,27 1,14" fill="none" stroke="#000000" strokeWidth={1.2} />
      </Svg>
    );
  }
  if (type === "terminator") {
    return (
      <Svg width={34} height={18} viewBox="0 0 34 18">
        <Rect
          x={1}
          y={1}
          width={32}
          height={16}
          rx={8}
          ry={8}
          fill="none"
          stroke="#000000"
          strokeWidth={1.2}
        />
      </Svg>
    );
  }
  return (
    <Svg width={34} height={18} viewBox="0 0 34 18">
      <Rect x={1} y={1} width={32} height={16} fill="none" stroke="#000000" strokeWidth={1.2} />
    </Svg>
  );
}

function rowTime(row: ProsedurRow): string {
  if (row.time !== undefined && row.time_unit != null) {
    return row.time === 0 ? "" : `${row.time} ${getFullTimeUnit(row.time_unit)}`;
  }
  return row.mutu_waktu || " - ";
}

function StepsPage({
  rows,
  implementers,
  pageLabel,
}: {
  rows: ProsedurRow[];
  implementers: { id: string; name: string }[];
  pageLabel: string;
}) {
  const safeImplementers =
    implementers.length > 0 ? implementers : [{ id: "pelaksana-1", name: "Pelaksana" }];
  const pelaksanaWidth = 24;
  const implWidth = pelaksanaWidth / safeImplementers.length;

  return (
    <Page size="A4" orientation="landscape" style={styles.centeredPage}>
      <View style={styles.stepSheet}>
        <View style={styles.table}>
          <View style={[styles.row, { borderBottomWidth: 1.4, borderColor: "#000000" }]}>
            <View style={[styles.stepHeaderCell, { width: "5%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>NO</Text>
            </View>
            <View style={[styles.stepHeaderCell, { width: "24%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>KEGIATAN</Text>
            </View>
            <View
              style={{
                width: `${pelaksanaWidth}%`,
                flexDirection: "column",
                borderRightWidth: 1.4,
                borderColor: "#000000",
                backgroundColor: "#d9d9d9",
              }}
            >
              <View
                style={{
                  padding: 3,
                  minHeight: 18,
                  justifyContent: "center",
                  borderBottomWidth: 1.4,
                  borderColor: "#000000",
                }}
              >
                <Text style={[styles.label, styles.centerText]}>PELAKSANA</Text>
              </View>
              <View style={{ flexDirection: "row", flex: 1 }}>
                {safeImplementers.map((impl, index) => (
                  <View
                    key={impl.id}
                    style={{
                      width: `${100 / safeImplementers.length}%`,
                      borderRightWidth: index < safeImplementers.length - 1 ? 1.4 : 0,
                      borderColor: "#000000",
                      padding: 3,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={[styles.label, styles.centerText, { fontSize: 6 }]}>
                      {impl.name.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.stepHeaderCell, { width: "14%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>KELENGKAPAN</Text>
            </View>
            <View style={[styles.stepHeaderCell, { width: "8%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>WAKTU</Text>
            </View>
            <View style={[styles.stepHeaderCell, { width: "13%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>OUTPUT</Text>
            </View>
            <View style={[styles.stepHeaderCell, { width: "12%", borderBottomWidth: 0 }]}>
              <Text style={[styles.label, styles.centerText]}>KET</Text>
            </View>
          </View>
          {rows.map((row) => (
            <View key={row.id} style={styles.row} wrap={false}>
              <View style={[styles.stepBodyCell, { width: "5%" }]}>
                <Text style={[styles.centerText, styles.stepText]}>{row.no ?? row.urutan}</Text>
              </View>
              <View style={[styles.stepBodyCell, { width: "24%" }]}>
                <Text style={[styles.justifyText, styles.stepText]}>{row.kegiatan || " - "}</Text>
              </View>
              {safeImplementers.map((impl) => (
                <View
                  key={impl.id}
                  style={[
                    styles.stepBodyCell,
                    { width: `${implWidth}%`, alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  {row.pelaksana === impl.id || row.pelaksanaIds?.includes(impl.id) ? (
                    <FlowShape type={row.type} />
                  ) : null}
                </View>
              ))}
              <View style={[styles.stepBodyCell, { width: "14%" }]}>
                <Text style={[styles.justifyText, styles.stepText]}>
                  {row.mutu_kelengkapan || row.kelengkapan || " - "}
                </Text>
              </View>
              <View style={[styles.stepBodyCell, { width: "8%" }]}>
                <Text style={[styles.justifyText, styles.stepText]}>{rowTime(row)}</Text>
              </View>
              <View style={[styles.stepBodyCell, { width: "13%" }]}>
                <Text style={[styles.justifyText, styles.stepText]}>
                  {row.output || row.keluaran || " - "}
                </Text>
              </View>
              <View style={[styles.stepBodyCell, { width: "12%" }]}>
                <Text style={[styles.justifyText, styles.stepText]}>{row.keterangan || " - "}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.pageNumber}>{pageLabel}</Text>
      <SopPdfBrandMark />
    </Page>
  );
}

function DiagramImagePage({
  snapshot,
  pageLabel,
}: {
  snapshot: DiagramPageSnapshot;
  pageLabel: string;
}) {
  const maxWidth = CONTENT_WIDTH;
  const maxHeight = A4_LANDSCAPE[1] - PAGE_PADDING * 2 - 20;
  const scale = Math.min(maxWidth / snapshot.width, maxHeight / snapshot.height, 1);
  const renderWidth = snapshot.width * scale;
  const renderHeight = snapshot.height * scale;
  return (
    <Page size="A4" orientation="landscape" style={styles.centeredPage}>
      <View
        style={{
          width: renderWidth,
          height: renderHeight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          src={snapshot.dataUrl}
          style={{ width: renderWidth, height: renderHeight, objectFit: "contain" }}
        />
      </View>
      <Text style={styles.pageNumber}>{pageLabel}</Text>
      <SopPdfBrandMark />
    </Page>
  );
}

export function SopPdfDocument({
  name,
  number,
  metadata: metadataOverride,
  prosedurRows = [],
  implementers = [],
  tteSignaturePayload = null,
  qrDataUrlKepalaOpd,
  includeHeader,
  printMode,
  diagramSnapshots = [],
}: SopPdfDocumentProps) {
  const metadata = normalizeMetadata(name, number, metadataOverride);
  const normalizedRows = [...prosedurRows].sort((a, b) => (a.no ?? a.urutan) - (b.no ?? b.urutan));
  const stepPages = splitRows(normalizedRows, STEP_ROWS_PER_PAGE);
  const sections = resolvePrintSections({
    includeHeader,
    printMode,
    diagramSnapshots,
  });
  const pageDescriptors: Array<
    | { type: "header" }
    | { type: "steps"; rows: ProsedurRow[]; index: number }
    | { type: "diagram"; snapshot: DiagramPageSnapshot }
  > = [];
  if (sections.showHeader) {
    pageDescriptors.push({ type: "header" });
  }
  if (sections.showSteps) {
    stepPages.forEach((rows, index) => {
      pageDescriptors.push({ type: "steps", rows, index });
    });
  }
  if (sections.showDiagrams) {
    diagramSnapshots.forEach((snapshot) => {
      pageDescriptors.push({ type: "diagram", snapshot });
    });
  }
  const totalPages = pageDescriptors.length;

  return (
    <Document title={`SOP - ${metadata.name || metadata.number || "Dokumen"}`}>
      {pageDescriptors.map((descriptor, globalIndex) => {
        const pageLabel = `Halaman ${globalIndex + 1}/${totalPages}`;
        if (descriptor.type === "header") {
          return (
            <HeaderPage
              key="header"
              metadata={metadata}
              tteSignaturePayload={tteSignaturePayload}
              qrDataUrlKepalaOpd={qrDataUrlKepalaOpd}
            />
          );
        }
        if (descriptor.type === "steps") {
          return (
            <StepsPage
              key={`steps-${descriptor.rows[0]?.id ?? descriptor.index}`}
              rows={descriptor.rows}
              implementers={implementers}
              pageLabel={pageLabel}
            />
          );
        }
        return (
          <DiagramImagePage
            key={`diagram-${descriptor.snapshot.kind}-${descriptor.snapshot.pageIndex}`}
            snapshot={descriptor.snapshot}
            pageLabel={`${diagramPageLabel(descriptor.snapshot)} · ${pageLabel}`}
          />
        );
      })}
    </Document>
  );
}
