export const queryKeys = {
  auth: ['auth'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: string) => ['workspaces', workspaceId] as const,

  peraturan: ['peraturan'] as const,
  peraturanList: ['peraturan', 'list'] as const,

  pelaksana: ['pelaksana'] as const,
  pelaksanaByWorkspace: (workspaceId: string) => ['pelaksana', 'workspace', workspaceId] as const,

  sop: ['sop'] as const,
  sopList: (params?: {
    workspaceId?: string
    status?: string
    tanggalDari?: string
    tanggalSampai?: string
  }) => ['sop', 'list', params ?? {}] as const,
  sopRiwayatVersi: (sopId: string) => ['sop', 'riwayat-versi', sopId] as const,
  penyusunWorkbench: (detailSopId: string) => ['sop', 'workbench', detailSopId] as const,
  detailSop: ['sop', 'detail'] as const,
} as const
