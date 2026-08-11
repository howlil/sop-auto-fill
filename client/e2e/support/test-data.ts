export const e2ePin = process.env.E2E_TTE_PIN ?? '1234'

function compactHash(value: string): string {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).slice(-3).padStart(3, '0')
}

export function e2eRunId(prefix = 'E2E'): string {
  const configured = process.env.E2E_TEST_RUN_ID
  const raw = configured ?? `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`
  const normalizedPrefix = prefix.replace(/[^A-Za-z0-9]/g, '') || 'E2E'
  const safePrefix = normalizedPrefix.slice(0, 3)
  const prefixHash = compactHash(normalizedPrefix)
  const safeRaw = raw.replace(/[^A-Za-z0-9]/g, '') || 'run'
  return `${safePrefix}${prefixHash}-${safeRaw.slice(-5)}`.slice(0, 12)
}

export function uniqueEmail(prefix: string): string {
  const localPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'user'
  return `${localPrefix}.${e2eRunId('u').toLowerCase()}@e2e.test`
}

function buildMinimalValidPdfBase64(): string {
  const header = '%PDF-1.4\n'
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\n',
  ]

  let pdf = header
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += object
  }

  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  const xrefRows = [
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
  ]

  pdf += `xref\n0 ${objects.length + 1}\n${xrefRows.join('\n')}\n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'ascii').toString('base64')
}

/**
 * PDF fixture dibuat dengan xref dan page tree lengkap sehingga parser/signing backend
 * menerima dokumen yang sama sebagai PDF valid. Jangan ganti dengan potongan header PDF.
 */
export const validPdfBase64 = buildMinimalValidPdfBase64()

export const invalidPdfBase64 = Buffer.from('not a signed pdf', 'utf8').toString('base64')

export function sopFixture(prefix = 'SOP') {
  const suffix = e2eRunId(prefix)
  return {
    suffix,
    title: `E2E SOP ${suffix}`,
    number: `E2E/${suffix}/26`,
    updatedTitle: `E2E SOP Revisi ${suffix}`,
    baNumber: `BA-${suffix}`,
  }
}

export const scenarioIds = Array.from({ length: 70 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return `E2E-${number}`
})

export const scenarioCoverage: Record<string, string[]> = {
  'auth.spec.ts': ['E2E-01', 'E2E-02', 'E2E-03', 'E2E-06', 'E2E-07'],
  'role-access.spec.ts': ['E2E-04', 'E2E-05', 'E2E-34', 'E2E-44', 'E2E-70'],
  'master-data.spec.ts': [
    'E2E-08',
    'E2E-09',
    'E2E-10',
    'E2E-11',
    'E2E-12',
    'E2E-13',
    'E2E-14',
    'E2E-15',
    'E2E-16',
    'E2E-17',
    'E2E-18',
    'E2E-19',
    'E2E-20',
    'E2E-21',
  ],
  'sop-authoring.spec.ts': [
    'E2E-22',
    'E2E-23',
    'E2E-24',
    'E2E-25',
    'E2E-26',
    'E2E-27',
    'E2E-28',
    'E2E-29',
    'E2E-30',
    'E2E-31',
    'E2E-56',
  ],
  'evaluasi-workflow.spec.ts': [
    'E2E-32',
    'E2E-33',
    'E2E-35',
    'E2E-36',
    'E2E-37',
    'E2E-38',
    'E2E-39',
    'E2E-40',
    'E2E-41',
    'E2E-42',
    'E2E-43',
    'E2E-45',
    'E2E-46',
    'E2E-69',
  ],
  'tte-pengesahan.spec.ts': [
    'E2E-47',
    'E2E-48',
    'E2E-49',
    'E2E-50',
    'E2E-51',
    'E2E-52',
    'E2E-53',
    'E2E-54',
    'E2E-55',
    'E2E-57',
  ],
  'arsip-public.spec.ts': ['E2E-58', 'E2E-59', 'E2E-60', 'E2E-61', 'E2E-62', 'E2E-63', 'E2E-64', 'E2E-65'],
  'pdf-verification.spec.ts': ['E2E-66', 'E2E-67'],
  'list-filter-pagination.spec.ts': ['E2E-68'],
}
