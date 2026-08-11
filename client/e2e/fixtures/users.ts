export type RoleKey =
  | 'PJ_EVALUATOR'
  | 'EVALUATOR'
  | 'KEPALA_OPD'
  | 'PJ_PENYUSUN'
  | 'PENYUSUN'

export interface E2eUser {
  role: RoleKey
  roleLabel: string
  email: string
  password: string
  landingPath: string
}

const defaultPassword = process.env.E2E_SEED_PASSWORD ?? '@Password123:)'

export const users = {
  pjEvaluator: {
    role: 'PJ_EVALUATOR',
    roleLabel: 'PJ Evaluator',
    email: process.env.E2E_PJ_EVALUATOR_EMAIL ?? 'pjevaluator@gmail.com',
    password: process.env.E2E_PJ_EVALUATOR_PASSWORD ?? defaultPassword,
    landingPath: '/pj-evaluator/grafik-evaluasi',
  },
  evaluator: {
    role: 'EVALUATOR',
    roleLabel: 'Evaluator',
    email: process.env.E2E_EVALUATOR_EMAIL ?? 'evaluator1@gmail.com',
    password: process.env.E2E_EVALUATOR_PASSWORD ?? defaultPassword,
    landingPath: '/evaluator/evaluasi',
  },
  kepalaOpd: {
    role: 'KEPALA_OPD',
    roleLabel: 'Kepala OPD',
    email: process.env.E2E_KEPALA_OPD_EMAIL ?? 'kepalaopd.dinkes@gmail.com',
    password: process.env.E2E_KEPALA_OPD_PASSWORD ?? defaultPassword,
    landingPath: '/kepala-opd/sop',
  },
  pjPenyusun: {
    role: 'PJ_PENYUSUN',
    roleLabel: 'PJ Penyusun',
    email: process.env.E2E_PJ_PENYUSUN_EMAIL ?? 'pjpenyusun.dinkes@gmail.com',
    password: process.env.E2E_PJ_PENYUSUN_PASSWORD ?? defaultPassword,
    landingPath: '/penyusun/sop',
  },
  penyusun: {
    role: 'PENYUSUN',
    roleLabel: 'Penyusun',
    email: process.env.E2E_PENYUSUN_EMAIL ?? 'penyusun.dinkes@gmail.com',
    password: process.env.E2E_PENYUSUN_PASSWORD ?? defaultPassword,
    landingPath: '/penyusun/sop',
  },
} satisfies Record<string, E2eUser>

export const allUsers = Object.values(users)

export const navByRole: Record<RoleKey, string[]> = {
  PJ_EVALUATOR: [
    'Grafik Evaluasi',
    'OPD',
    'Penyusun',
    'Evaluator',
    'Evaluasi SOP',
  ],
  EVALUATOR: ['Evaluasi SOP'],
  KEPALA_OPD: ['Pantau SOP', 'Pengajuan SOP'],
  PJ_PENYUSUN: [
    'SOP',
    'Pelaksana SOP',
    'Peraturan',
    'Berita Acara',
  ],
  PENYUSUN: [
    'SOP',
    'Pelaksana SOP',
    'Peraturan',
  ],
}

export const protectedRouteMatrix: Record<RoleKey, string[]> = {
  PJ_EVALUATOR: [
    '/pj-evaluator/grafik-evaluasi',
    '/pj-evaluator/opd',
    '/pj-evaluator/penyusun',
    '/pj-evaluator/evaluator',
    '/pj-evaluator/evaluasi',
  ],
  EVALUATOR: ['/evaluator/evaluasi'],
  KEPALA_OPD: ['/kepala-opd/sop', '/kepala-opd/pengajuan'],
  PJ_PENYUSUN: [
    '/penyusun/sop',
    '/penyusun/pelaksana',
    '/penyusun/peraturan',
    '/penyusun/pj-penyusun/berita-acara',
  ],
  PENYUSUN: ['/penyusun/sop', '/penyusun/pelaksana', '/penyusun/peraturan'],
}

export const allProtectedRoutes = Array.from(
  new Set(Object.values(protectedRouteMatrix).flat()),
)

export const publicRoutes = ['/', '/login', '/arsip', '/validasi/pdf']
