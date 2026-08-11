import type { ReactNode } from "react";
import { useState, useMemo, useEffect, useCallback } from "react";

import {
  SOPHeaderInfo,
  type SOPHeaderInfoProps,
} from "./sop-diagram";
import { SOPDiagramFlowchart } from "./sop-diagram";
import { SOPDiagramBpmn } from "./sop-diagram";
import { rowsToSteps } from "./sop-diagram";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TTESignaturePayload } from "@/types/dto/tte.dto";
import type { ProsedurRow, SOPDetailMetadata } from "@/types/ui/sop";
import {
  getInitialSopDetailMetadata,
  getInitialSopDetailImplementers,
} from "@/lib/sop/detailSop.initial-state";
import { SOP_DOCUMENT_CONTENT_WRAPPER_CLASS } from "./sop-diagram";

const DEFAULT_METADATA = getInitialSopDetailMetadata();
const DEFAULT_PROSEDUR_ROWS: ProsedurRow[] = [];
const DEFAULT_IMPLEMENTERS = getInitialSopDetailImplementers().map((p) => ({
  id: p.id,
  name: p.nama,
}));

import type { ArrowConfig, LabelConfig } from "@/components/sop/sop-diagram/core/sopDiagramTypes";
import type { PathUpdatedPayload } from "@/components/sop/sop-diagram/shapes/FlowchartArrowConnector";

interface SopPreviewOptions {
  hideDiagramTabs?: boolean;
  editable?: boolean;
  toolbar?: ReactNode;
  diagramAlternate?: ReactNode;
  showScrollbar?: boolean;
}

interface SopPreviewDiagramState {
  pathLayoutSeed?: number;
  activeTab?: "flowchart" | "bpmn";
  onActiveTabChange?: (v: "flowchart" | "bpmn") => void;
  /** false = tunda mount SOPDiagramFlowchart/BPMN (hindari blok main thread saat buka halaman). */
  diagramMountEnabled?: boolean;
  onRequestDiagramMount?: () => void;
  editMode?: boolean;
  arrowConfig?: ArrowConfig;
  labelConfig?: LabelConfig;
  selectedConnectionId?: string | null;
  onSelectConnection?: (connectionId: string | null) => void;
  onManualPathChange?: (payload: PathUpdatedPayload) => void;
  onResetSelectedPath?: () => void;
}

type SopPreviewMetadata = Partial<
  Omit<SOPHeaderInfoProps, "implementQualification" | "equipment" | "recordData">
> &
  Partial<SOPDetailMetadata> & { name?: string };

export interface SOPPreviewTemplateProps {
  name?: string;
  number?: string;
  tteSignaturePayload?: TTESignaturePayload | null;
  metadata?: SopPreviewMetadata;
  prosedurRows?: ProsedurRow[];
  implementers?: { id: string; name: string }[];
  onMetadataChange?: (field: string, value: unknown) => void;
  previewOptions?: SopPreviewOptions;
  diagramState?: SopPreviewDiagramState;

}

export function SOPPreviewTemplate({
  name: nameOverride,
  number: numberOverride,
  tteSignaturePayload = null,
  metadata: metadataOverride,
  prosedurRows = DEFAULT_PROSEDUR_ROWS,
  implementers = DEFAULT_IMPLEMENTERS,
  onMetadataChange,
  previewOptions = {},
  diagramState = {},
}: SOPPreviewTemplateProps) {
  const effectiveOptions: Required<SopPreviewOptions> = {
    hideDiagramTabs: previewOptions.hideDiagramTabs ?? false,
    editable: previewOptions.editable ?? false,
    toolbar: previewOptions.toolbar ?? null,
    diagramAlternate: previewOptions.diagramAlternate ?? null,
    showScrollbar: previewOptions.showScrollbar ?? false,
  };
  const effectiveDiagramState = {
    pathLayoutSeed: diagramState.pathLayoutSeed ?? 0,
    activeTab: diagramState.activeTab ?? "flowchart",
    onActiveTabChange: diagramState.onActiveTabChange ?? (() => {}),
    diagramMountEnabled: diagramState.diagramMountEnabled ?? true,
    onRequestDiagramMount: diagramState.onRequestDiagramMount,
    editMode: diagramState.editMode ?? false,
    arrowConfig: diagramState.arrowConfig ?? {},
    labelConfig: diagramState.labelConfig ?? {},
    selectedConnectionId: diagramState.selectedConnectionId ?? null,
    onSelectConnection: diagramState.onSelectConnection ?? (() => {}),
    onManualPathChange: diagramState.onManualPathChange,
    onResetSelectedPath: diagramState.onResetSelectedPath,
  };

  const [internalActiveTab, setInternalActiveTab] = useState<
    "flowchart" | "bpmn"
  >("flowchart");
  const isControlledActiveTab = diagramState.activeTab != null;
  const activeTab = isControlledActiveTab
    ? effectiveDiagramState.activeTab
    : internalActiveTab;
  const setActiveTab = isControlledActiveTab
    ? effectiveDiagramState.onActiveTabChange
    : setInternalActiveTab;
  const requestDiagramMount = effectiveDiagramState.onRequestDiagramMount;

  // Defensive normalization: persisted data may contain empty implementer names.
  const safeImplementers = useMemo(
    () =>
      (implementers ?? []).map((impl, index) => ({
        id: impl?.id ?? `impl-${index + 1}`,
        name: (impl?.name ?? impl?.id ?? `Pelaksana ${index + 1}`).toString(),
      })),
    [implementers],
  );

  const diagramSteps = useMemo(
    () => rowsToSteps(prosedurRows, safeImplementers),
    [prosedurRows, safeImplementers],
  );

  /** Selaraskan field metadata penyusun/API (`tanggalPembuatan`, `nama`) ke props header cetak. */
  const metadata: SOPHeaderInfoProps = {
    ...DEFAULT_METADATA,
    ...(nameOverride != null && { name: nameOverride }),
    ...(numberOverride != null && { number: numberOverride }),
    ...metadataOverride,
    implementQualification:
      typeof metadataOverride?.implementQualification === "string"
        ? [metadataOverride.implementQualification]
        : metadataOverride?.implementQualification ??
          (Array.isArray(DEFAULT_METADATA.implementQualification)
            ? DEFAULT_METADATA.implementQualification
            : []),
    equipment:
      typeof metadataOverride?.equipment === "string"
        ? [metadataOverride.equipment]
        : metadataOverride?.equipment ??
          (Array.isArray(DEFAULT_METADATA.equipment) ? DEFAULT_METADATA.equipment : []),
    recordData:
      typeof metadataOverride?.recordData === "string"
        ? [metadataOverride.recordData]
        : metadataOverride?.recordData ??
          (Array.isArray(DEFAULT_METADATA.recordData) ? DEFAULT_METADATA.recordData : []),
    ...(metadataOverride &&
    metadataOverride.tanggalPembuatan != null &&
    String(metadataOverride.tanggalPembuatan).trim() !== ""
      ? { createdDate: String(metadataOverride.tanggalPembuatan) }
      : {}),
    ...(metadataOverride &&
    metadataOverride.tanggalRevisi != null &&
    String(metadataOverride.tanggalRevisi).trim() !== ""
      ? { revisionDate: String(metadataOverride.tanggalRevisi) }
      : {}),
    ...(metadataOverride &&
    metadataOverride.tanggalEfektif != null &&
    String(metadataOverride.tanggalEfektif).trim() !== ""
      ? { effectiveDate: String(metadataOverride.tanggalEfektif) }
      : {}),
    ...(metadataOverride &&
    !metadataOverride.name &&
    metadataOverride.nama != null &&
    String(metadataOverride.nama).trim() !== ""
      ? { name: String(metadataOverride.nama) }
      : {}),
  } as SOPHeaderInfoProps;

  const hasDiagramToolbar = effectiveOptions.toolbar != null;

  /** Hanya mount diagram yang pernah dibuka — hindari routing ganda flowchart+BPMN sejak load. */
  const [visitedTabs, setVisitedTabs] = useState<Set<"flowchart" | "bpmn">>(() => {
    const mountEnabled = diagramState.diagramMountEnabled ?? true;
    if (!mountEnabled) return new Set();
    const initialTab = diagramState.activeTab ?? "flowchart";
    return new Set([initialTab]);
  });


  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    if (!effectiveDiagramState.diagramMountEnabled) return;
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [effectiveDiagramState.diagramMountEnabled, activeTab]);

  const handleDiagramTabChange = useCallback(
    (tab: "flowchart" | "bpmn") => {
      requestDiagramMount?.();
      setVisitedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
      setActiveTab(tab);
    },
    [requestDiagramMount, setActiveTab],
  );



  const diagramDataProps = useMemo(
    () => ({
      flowchart: {
        data: {
          rows: prosedurRows,
          steps: diagramSteps,
          implementers: safeImplementers,
        },
        config: {
          pathLayoutSeed: effectiveDiagramState.pathLayoutSeed,
          arrowConfig: effectiveDiagramState.arrowConfig,
          labelConfig: effectiveDiagramState.labelConfig,
          editMode: effectiveDiagramState.editMode,
          selectedConnectionId: effectiveDiagramState.selectedConnectionId,
        },
        events: {
          onManualChange: effectiveDiagramState.onManualPathChange,
          onSelectConnection: effectiveDiagramState.onSelectConnection,
        },
      },
      bpmn: {
        data: {
          name: metadata.name,
          steps: diagramSteps,
          implementers: safeImplementers,
        },
        config: {
          pathLayoutSeed: effectiveDiagramState.pathLayoutSeed,
          arrowConfig: effectiveDiagramState.arrowConfig,
          labelConfig: effectiveDiagramState.labelConfig,
          editMode: effectiveDiagramState.editMode,
          selectedConnectionId: effectiveDiagramState.selectedConnectionId,
        },
        events: {
          onManualChange: effectiveDiagramState.onManualPathChange,
          onSelectConnection: effectiveDiagramState.onSelectConnection,
        },
      },
    }),
    [
      prosedurRows,
      diagramSteps,
      safeImplementers,
      metadata.name,
      effectiveDiagramState.pathLayoutSeed,
      effectiveDiagramState.arrowConfig,
      effectiveDiagramState.labelConfig,
      effectiveDiagramState.editMode,
      effectiveDiagramState.selectedConnectionId,
      effectiveDiagramState.onManualPathChange,
      effectiveDiagramState.onSelectConnection,
    ],
  );

  const canMountDiagram = effectiveDiagramState.diagramMountEnabled;
  const mountFlowchartDiagram =
    canMountDiagram && visitedTabs.has("flowchart");
  const mountBpmnDiagram =
    canMountDiagram && visitedTabs.has("bpmn");
  const showFlowchartOnScreen =
    mountFlowchartDiagram && activeTab === "flowchart";
  const showBpmnOnScreen = mountBpmnDiagram && activeTab === "bpmn";
  const showDiagramPlaceholder = !canMountDiagram;

  return (
    <div
      className={
        effectiveOptions.showScrollbar
          ? "flex-1 min-h-0 overflow-auto print:overflow-visible"
          : "flex-1 min-h-0 overflow-auto scrollbar-hide print:overflow-visible"
      }
    >
      <div className="sop-print-document sop-a4-preview flex flex-col gap-10 p-4 print:gap-0 print:p-0">
          <section className="sop-print-header">
          <SOPHeaderInfo
            {...metadata}
            editable={effectiveOptions.editable}
            onMetadataChange={onMetadataChange}
            tteSignaturePayload={tteSignaturePayload}
          />
          </section>

          {effectiveOptions.diagramAlternate != null ? (
            <section className="sop-print-langkah flex flex-col gap-6 print:gap-0 w-full">
            <div className="flex justify-center w-full">{effectiveOptions.diagramAlternate}</div>
            </section>
          ) : (
            <section className="sop-print-langkah flex flex-col gap-6 print:gap-0">
            <>
              {!effectiveOptions.hideDiagramTabs && (
                <div className="flex justify-center px-1 print:hidden">
                  <div
                    role="toolbar"
                    aria-label="Kontrol diagram SOP"
                    className={
                      hasDiagramToolbar
                        ? 'inline-flex w-fit max-w-full flex-col items-center gap-2 rounded-xl border border-border/90 bg-surface-subtle/95 px-2 py-1.5 shadow-surface ring-1 ring-gray-950/[0.04] sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-2 sm:gap-y-1.5 sm:px-2.5 sm:py-1.5'
                        : 'inline-flex w-fit max-w-full flex-col items-stretch rounded-xl border border-border/90 bg-surface px-2 py-2 shadow-surface ring-1 ring-gray-950/[0.04]'
                    }
                  >
                    {hasDiagramToolbar ? (
                      <>
                        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
                          {effectiveOptions.toolbar}
                        </div>
                        <div
                          className="hidden h-8 w-px shrink-0 bg-surface-strong/90 sm:mx-0.5 sm:block"
                          aria-hidden
                        />
                      </>
                    ) : null}
                    <Tabs
                      value={activeTab}
                      onValueChange={(v: string) =>
                        handleDiagramTabChange(v as "flowchart" | "bpmn")
                      }
                      className={
                        hasDiagramToolbar
                          ? "w-auto shrink-0"
                          : "w-auto min-w-[13.5rem]"
                      }
                    >
                      <TabsList className="grid h-9 w-auto min-w-[13.5rem] grid-cols-2 gap-0.5 rounded-lg bg-surface/60 p-0.5 ring-1 ring-border/60 sm:h-9">
                        <TabsTrigger
                          value="flowchart"
                          className="h-8 rounded-md text-xs font-medium text-secondary-foreground transition-all data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-surface data-[state=active]:ring-1 data-[state=active]:ring-border/80 data-[state=inactive]:hover:bg-surface/60 data-[state=inactive]:hover:text-foreground"
                        >
                          Flowchart
                        </TabsTrigger>
                        <TabsTrigger
                          value="bpmn"
                          className="h-8 rounded-md text-xs font-medium text-secondary-foreground transition-all data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-surface data-[state=active]:ring-1 data-[state=active]:ring-border/80 data-[state=inactive]:hover:bg-surface/60 data-[state=inactive]:hover:text-foreground"
                        >
                          BPMN
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <div className="sop-diagram-print-host min-w-0 w-full overflow-x-auto px-4 lg:px-0 print:overflow-visible print:px-0">
                  {showDiagramPlaceholder ? (
                    <div
                      className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground print:hidden"
                      role="status"
                      aria-live="polite"
                    >
                      Menyiapkan diagram…
                    </div>
                  ) : null}
                  {mountFlowchartDiagram ? (
                    <div
                      className={`sop-print-diagram-flowchart mx-auto ${SOP_DOCUMENT_CONTENT_WRAPPER_CLASS} ${
                        showFlowchartOnScreen ? "" : "sop-diagram-screen-off"
                      } print:!block`}
                    >
                      <SOPDiagramFlowchart {...diagramDataProps.flowchart} />
                    </div>
                  ) : null}
                  {mountBpmnDiagram ? (
                    <section
                      className={`sop-print-diagram-bpmn sop-print-bpmn-section mx-auto ${SOP_DOCUMENT_CONTENT_WRAPPER_CLASS} ${
                        showBpmnOnScreen ? "" : "sop-diagram-screen-off"
                      } print:!block`}
                    >
                      <SOPDiagramBpmn {...diagramDataProps.bpmn} />
                    </section>
                  ) : null}
                </div>
              </div>
            </>
            </section>
          )}
      </div>
    </div>
  );
}
