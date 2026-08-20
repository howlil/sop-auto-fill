import { apiClient } from "@/lib/api/api-client";
import type { ApiSuccessResponse } from "@/types/dto/auth.dto";

export interface WorkspaceSopRow {
  id: string;
  workspaceId: string;
  detailSopId: string | null;
  judul: string;
  nomorSop: string | null;
  versi: number | null;
  status: "DRAFT" | "COMPLETED" | "ARCHIVED";
  statusLabel: string;
  terakhirDiperbarui: string | null;
  canBuatVersiBaru: boolean;
  canHapusSopDraft: boolean;
  versionCount: number;
}

export interface SopTemplateSummary {
  templateId: string;
  key: string;
  name: string;
  description: string;
  version: number;
  stepCount: number;
  actorNames: string[];
}

export interface SopTemplatePreview {
  template: SopTemplateSummary;
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
  stepCount: number;
  lampiranDefaults: Partial<{
    peringatan: string[];
    kualifikasiPelaksanaan: string[];
    peralatanPerlengkapan: string[];
    pencatatanPendataan: string[];
  }>;
}

export interface SopTemplateCreateIdentity {
  sopId: string;
  detailSopId: string;
  workspaceId: string;
  status: "DRAFT";
}

export interface AiDraftStep {
  urutan: number;
  kegiatan: string;
  jenis: "AWAL_AKHIR" | "KEGIATAN" | "KEPUTUSAN";
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: "m" | "h" | "d" | "w" | "mo" | "y";
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
}

export interface AiDraftProposal {
  suggestedTitle: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: string[];
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
  steps: AiDraftStep[];
}

export interface GenerateAiDraftInput {
  workspaceId: string;
  deskripsiProses: string;
  tujuanProses?: string;
  catatanTambahan?: string;
}

export interface CreateSopFromAiDraftInput {
  workspaceId: string;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  proposal: AiDraftProposal;
}

export interface CreateWorkspaceSopInput {
  workspaceId: string;
  judul: string;
  nomorSop: string;
  namaLembaga?: string;
}

export interface CreateSopFromTemplateInput {
  workspaceId: string;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
}

export type SopQualityFindingSeverity = "ERROR" | "WARNING" | "SUGGESTION";
export type SopQualityReviewStatus = "PERLU_PERBAIKAN" | "CUKUP_BAIK" | "SIAP_DIREVIEW";
export type SopQualityFindingCategory =
  | "PROCESS_STRUCTURE"
  | "ACTOR_RESPONSIBILITY"
  | "INPUT_OUTPUT"
  | "DECISION_ROUTING"
  | "CLARITY"
  | "SUPPORTING_FIELD"
  | "TIME_PLAUSIBILITY"
  | "COMPLETENESS";

export type SopQualityFindingLocation =
  | { kind: "HEADER" }
  | { kind: "PERINGATAN" }
  | { kind: "KUALIFIKASI_PELAKSANAAN" }
  | { kind: "PERALATAN_PERLENGKAPAN" }
  | { kind: "PENCATATAN_PENDATAAN" }
  | { kind: "ACTOR"; actorName: string }
  | { kind: "STEP"; stepOrder: number };

export interface SopQualityFinding {
  severity: SopQualityFindingSeverity;
  category: SopQualityFindingCategory;
  location: SopQualityFindingLocation;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface SopQualityReviewResponse {
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: {
    status: SopQualityReviewStatus;
    summary: string;
    findings: SopQualityFinding[];
  };
}

export type SopAiRevisionTarget =
  | { kind: "HEADER"; field: "JUDUL" }
  | { kind: "PERINGATAN"; itemIndex: number }
  | {
      kind: "STEP";
      stepOrder: number;
      field: "KEGIATAN" | "KELENGKAPAN" | "KELUARAN" | "KETERANGAN";
    };

export interface SopAiRevisionResponse {
  sourceDetailSopId: string;
  sourceVersion: number;
  suggestion: {
    target: SopAiRevisionTarget;
    before: string;
    after: string;
    rationale: string;
  };
}

export const workspaceSopApi = {
  list: (workspaceId: string) =>
    apiClient.get<ApiSuccessResponse<WorkspaceSopRow[]>>(
      `/sop?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  create: (input: CreateWorkspaceSopInput) =>
    apiClient.post<ApiSuccessResponse<WorkspaceSopRow>>("/sop", input),
  listTemplates: () =>
    apiClient.get<ApiSuccessResponse<SopTemplateSummary[]>>("/sop/templates"),
  previewTemplate: (templateId: string, workspaceId: string) =>
    apiClient.get<ApiSuccessResponse<SopTemplatePreview>>(
      `/sop/templates/${encodeURIComponent(templateId)}/preview?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  createFromTemplate: (templateId: string, input: CreateSopFromTemplateInput) =>
    apiClient.post<ApiSuccessResponse<SopTemplateCreateIdentity>>(
      `/sop/templates/${encodeURIComponent(templateId)}/create`,
      input,
    ),
  aiDraftAvailability: () =>
    apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>("/sop/ai-drafts/availability"),
  generateAiDraft: (input: GenerateAiDraftInput) =>
    apiClient.post<ApiSuccessResponse<{ proposal: AiDraftProposal }>>(
      "/sop/ai-drafts/generate",
      input,
    ),
  createFromAiDraft: (input: CreateSopFromAiDraftInput) =>
    apiClient.post<ApiSuccessResponse<SopTemplateCreateIdentity>>("/sop/ai-drafts/create", input),
  aiReviewAvailability: () =>
    apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>("/sop/ai-reviews/availability"),
  reviewAiSop: (detailSopId: string) =>
    apiClient.post<ApiSuccessResponse<SopQualityReviewResponse>>(
      `/sop/${encodeURIComponent(detailSopId)}/ai-review`,
    ),
  aiRevisionAvailability: () =>
    apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>("/sop/ai-revisions/availability"),
  suggestAiRevision: (detailSopId: string, finding: SopQualityFinding) =>
    apiClient.post<ApiSuccessResponse<SopAiRevisionResponse>>(
      `/sop/${encodeURIComponent(detailSopId)}/ai-revisions/suggest`,
      { finding },
    ),
};
