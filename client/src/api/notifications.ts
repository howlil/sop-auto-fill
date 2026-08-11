import { resolveApiBaseUrl } from '@/config/env'
import { apiClient, buildQueryString } from '@/lib/api/api-client'
import { unwrapApiData } from '@/lib/api/response'
import type { ApiSuccessResponse } from '@/types/dto/auth.dto'
import type {
  InAppNotificationDto,
  NotificationSummaryDto,
} from '@/types/dto/notifications.dto'

export const notificationApi = {
  summary: () =>
    unwrapApiData(
      apiClient.get<ApiSuccessResponse<NotificationSummaryDto>>('/notifications/summary'),
    ),

  list: (limit = 10) =>
    unwrapApiData(
      apiClient.get<ApiSuccessResponse<InAppNotificationDto[]>>(
        `/notifications${buildQueryString({ limit })}`,
      ),
    ),

  markRead: (id: string) =>
    unwrapApiData(
      apiClient.post<ApiSuccessResponse<NotificationSummaryDto>>(
        `/notifications/${id}/read`,
      ),
    ),

  markAllRead: () =>
    unwrapApiData(
      apiClient.post<ApiSuccessResponse<NotificationSummaryDto & { updated: number }>>(
        '/notifications/read-all',
      ),
    ),
}

export function resolveNotificationStreamUrl(): string {
  return `${resolveApiBaseUrl()}/notifications/stream`
}
