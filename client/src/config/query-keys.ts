/**
 * Query keys untuk TanStack Query
 * Centralized query key management
 */

export const queryKeys = {
  // Auth
  auth: ['auth'] as const,
  user: (userId: string) => ['auth', 'user', userId] as const,
  users: ['users'] as const,
  usersList: (params?: {
    page?: number
    limit?: number
    opdId?: string
    peran?: string
    search?: string
  }) => ['users', 'list', params] as const,

  /** Manajemen Kepala OPD (Biro) — GET/PATCH/DELETE `/kepala-opd` */
  kepalaOpd: ['kepalaOpd'] as const,
  /** GET `/kepala-opd` — termasuk query `search` */
  kepalaOpdList: (search?: string) =>
    ['kepalaOpd', 'list', 'v2', search ?? ''] as const,
  kepalaOpdRiwayat: (penggunaId: string) => ['kepalaOpd', 'riwayatOpd', penggunaId] as const,

  // Peraturan
  peraturan: ['peraturan'] as const,
  peraturanList: (opdId?: string) => ['peraturan', 'list', opdId] as const,

  // SOP
  sop: ['sop'] as const,
  sopRiwayatVersi: (sopId: string) => ['sop', 'riwayat-versi', sopId] as const,
  sopList: (params?: {
    opdId?: string
    status?: string
    tanggalDari?: string
    tanggalSampai?: string
  }) => ['sop', 'list', params] as const,
  /** GET `/sop/penyusun-workbench/:detailSopId` — agregat detail + langkah + log */
  penyusunWorkbench: (detailSopId: string) => ['sop', 'penyusunWorkbench', detailSopId] as const,

  /** Prefix invalidasi cache detail SOP (mis. setelah TTE / status). */
  detailSop: ['detailSop'] as const,

  // Pelaksana
  pelaksana: ['pelaksana'] as const,
  pelaksanaByOpd: (opdId: string) => ['pelaksana', 'byOpd', opdId] as const,

  // OPD
  opd: ['opd'] as const,
  /** v2: invalidasi cache setelah respons API memakai bungkus { data } konsisten */
  /** GET `/opd` — termasuk query `search` (PJ_EVALUATOR) */
  opdList: (search?: string) => ['opd', 'list', 'v2', search ?? ''] as const,
  /** Manajemen penyusun Biro (GET /api/v1/penyusun — grup per OPD) */
  penyusun: ['penyusun'] as const,
  penyusunGrup: (search?: string) => ['penyusun', 'grup', 'v1', search ?? ''] as const,
  penyusunRiwayatOpd: (penggunaId: string) =>
    ['penyusun', 'riwayatOpd', penggunaId] as const,

  /** Manajemen anggota evaluator Biro — GET/POST/PATCH/DELETE `/evaluator` */
  evaluatorAnggota: ['evaluatorAnggota'] as const,
  /** GET `/evaluator` — termasuk query `search` */
  evaluatorAnggotaList: (search?: string) =>
    ['evaluatorAnggota', 'list', 'v3', search ?? ''] as const,

  // Evaluasi
  evaluasi: ['evaluasi'] as const,
  evaluasiList: (params?: {
    opdId?: string
    status?: string
    jenis?: string
    statusIn?: readonly string[]
  }) =>
    [
      'evaluasi',
      'list',
      params?.opdId,
      params?.status,
      params?.jenis,
      params?.statusIn?.length ? [...params.statusIn].slice().sort().join(',') : '',
    ] as const,
  evaluasiPengajuanShell: (id: string) => ['evaluasi', 'pengajuan', 'shell', id] as const,
  evaluasiPengajuanSopDokumen: (
    pengajuanId: string,
    detailSopId: string,
    logsLimit?: number,
  ) => ['evaluasi', 'pengajuan', 'sopDokumen', pengajuanId, detailSopId, logsLimit ?? 100] as const,
  evaluasiPengajuanBeritaAcara: (id: string) => ['evaluasi', 'pengajuan', 'beritaAcara', id] as const,
  evaluasiGrafikTahunan: (params?: { tahun?: number; tahunDari?: number; tahunSampai?: number }) =>
    ['evaluasi', 'grafikTahunan', params ?? {}] as const,
  /** GET `/evaluasi/workspace/opd/:opdId` — invalidate seluruh subtree dengan prefix ini setelah mutasi nilai */
  evaluasiWorkspaceOpdAll: ['evaluasi', 'workspaceOpd'] as const,
  evaluasiWorkspaceOpdSayaAll: ['evaluasi', 'workspaceOpdSaya'] as const,
  evaluasiWorkspaceOpdSaya: (
    params?: { detailSopId?: string; expand?: string; riwayatLimit?: number },
  ) => ['evaluasi', 'workspaceOpdSaya', params ?? {}] as const,
  evaluasiWorkspaceOpd: (
    opdId: string,
    params?: { detailSopId?: string; expand?: string; riwayatLimit?: number },
  ) => ['evaluasi', 'workspaceOpd', opdId, params ?? {}] as const,
  evaluasiWorkspacePengajuanAll: ['evaluasi', 'workspacePengajuan'] as const,
  evaluasiWorkspacePengajuan: (
    pengajuanId: string,
    params?: { detailSopId?: string; expand?: string; riwayatLimit?: number },
  ) => ['evaluasi', 'workspacePengajuan', pengajuanId, params ?? {}] as const,
  evaluasiRingkas: (params?: Record<string, unknown>) =>
    ['evaluasi', 'ringkas', params ?? {}] as const,
  /** Invalidate semua query GET `/evaluasi/ringkas` */
  evaluasiRingkasAll: ['evaluasi', 'ringkas'] as const,

  // TTE
  tte: ['tte'] as const,
  tteProfil: ['tte', 'profil'] as const,
  /** GET `/tte/public/pengesahan/:dokumenTteId/:userId` — verifikasi publik (tanpa sesi). */
  ttePengesahanPublic: (dokumenTteId: string, userId: string) =>
    ['tte', 'pengesahan-public', dokumenTteId, userId] as const,
  /** GET `/tte/public/pdf-signing/status` */
  ttePdfSigningStatus: ['tte', 'pdf-signing-status'] as const,

  /** GET `/evaluasi/umpan-balik/detail/:detailSopId` */
  evaluasiUmpanBalik: (detailSopId: string) =>
    ['evaluasi', 'umpan-balik', detailSopId] as const,

  /** Arsip SOP publik — GET `/sop/public/...` */
  sopPublicOpdList: (params?: { page?: number; limit?: number; search?: string }) =>
    ['sop', 'public', 'opd', params ?? {}] as const,
  sopPublicSopList: (
    opdId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) => ['sop', 'public', 'opd', opdId, 'sop', params ?? {}] as const,
  sopPublicSopGlobal: (params?: { page?: number; limit?: number; search?: string }) =>
    ['sop', 'public', 'sop', params ?? {}] as const,
  sopPublicDokumen: (detailSopId: string) =>
    ['sop', 'public', 'dokumen', detailSopId] as const,
}
