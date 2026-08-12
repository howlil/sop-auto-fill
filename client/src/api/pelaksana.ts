import { apiClient, buildQueryString } from '@/lib/api/api-client'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'

export interface PelaksanaDto {
  id: string
  workspaceId: string
  namaPelaksana: string
  createdAt: string
  updatedAt: string
}

export const pelaksanaApi = {
  list: (workspaceId: string) =>
    apiClient.get<ApiSuccessResponse<PelaksanaDto[]>>(
      `/pelaksana${buildQueryString({ workspaceId })}`,
    ),
  create: (workspaceId: string, namaPelaksana: string) =>
    apiClient.post<ApiSuccessResponse<PelaksanaDto>>('/pelaksana', {
      workspaceId,
      namaPelaksana,
    }),
}
