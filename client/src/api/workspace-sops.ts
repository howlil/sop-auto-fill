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

export const workspaceSopApi = {
  list: (workspaceId: string) =>
    apiClient.get<ApiSuccessResponse<WorkspaceSopRow[]>>(
      `/sop?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
  create: (input: {
    workspaceId: string;
    judul: string;
    nomorSop: string;
    namaLembaga?: string;
  }) => apiClient.post<ApiSuccessResponse<WorkspaceSopRow>>("/sop", input),
};
