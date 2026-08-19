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
};
