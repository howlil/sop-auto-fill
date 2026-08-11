export type NotificationKind =
  | 'EVALUASI_SOP'
  | 'TTD_BA_PJ_EVALUATOR'
  | 'TTD_BA_PJ_PENYUSUN'
  | 'TTD_SOP_KEPALA_OPD'

export type InAppNotificationDto = {
  id: string
  pengajuanEvaluasiId: string
  jenis: NotificationKind
  title: string
  preview: string
  body: string
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationSummaryDto = {
  unreadCount: number
}
