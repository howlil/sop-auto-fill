import { apiClient } from "@/lib/api/api-client";
import type { ApiSuccessResponse } from "@/types/dto/auth.dto";

export interface WorkspaceDto {
  workspaceId: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const workspaceApi = {
  list: () => apiClient.get<ApiSuccessResponse<WorkspaceDto[]>>("/workspaces"),
  get: (workspaceId: string) =>
    apiClient.get<ApiSuccessResponse<WorkspaceDto>>(`/workspaces/${workspaceId}`),
  create: (name: string) =>
    apiClient.post<ApiSuccessResponse<WorkspaceDto>>("/workspaces", { name }),
  rename: (workspaceId: string, name: string) =>
    apiClient.patch<ApiSuccessResponse<WorkspaceDto>>(`/workspaces/${workspaceId}`, { name }),
  remove: (workspaceId: string) => apiClient.delete<void>(`/workspaces/${workspaceId}`),
};
