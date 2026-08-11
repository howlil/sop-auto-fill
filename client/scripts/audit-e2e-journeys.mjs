import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = fileURLToPath(new URL('..', import.meta.url))
const journeyDir = path.join(clientDir, 'e2e', 'journeys')
const expectedIds = ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07']
const mutationTokens = [
  'apiPost(',
  'apiPatch(',
  'apiDelete(',
  'createAuthenticatedApiContext(',
  'createReadySopFixture(',
  'createApprovedSopFixture(',
  'signBeritaAcara(',
  'signAllSop(',
]

const files = fs
  .readdirSync(journeyDir)
  .filter((name) => name.endsWith('.spec.ts'))
  .sort()

if (files.length === 0) {
  throw new Error('Tidak ada business journey spec di client/e2e/journeys')
}

const occurrences = new Map(expectedIds.map((id) => [id, []]))
const violations = []

for (const file of files) {
  const absolute = path.join(journeyDir, file)
  const content = fs.readFileSync(absolute, 'utf8')

  const testIds = [...content.matchAll(/\btest\(\s*['"`](J0[1-7])\b/g)].map((match) => match[1])
  for (const id of testIds) {
    occurrences.get(id)?.push(file)
  }

  if (!content.includes('test.step(')) {
    violations.push(`${file}: business journey wajib memakai test.step() untuk audit trail`)
  }

  for (const token of mutationTokens) {
    if (content.includes(token)) {
      violations.push(
        `${file}: mutation API langsung '${token}' dilarang; pindahkan setup ke business-preconditions.ts atau lakukan aksi lewat UI`,
      )
    }
  }
}

for (const id of expectedIds) {
  const locations = occurrences.get(id) ?? []
  if (locations.length !== 1) {
    violations.push(`${id}: harus muncul tepat sekali sebagai executable test, ditemukan ${locations.length}`)
  }
}

if (violations.length > 0) {
  console.error('E2E business journey audit FAILED:')
  for (const violation of violations) console.error(` - ${violation}`)
  process.exit(1)
}

console.log('E2E business journey audit passed.')
for (const id of expectedIds) {
  console.log(` - ${id}: ${occurrences.get(id)?.[0]}`)
}
