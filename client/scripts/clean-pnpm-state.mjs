import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  'node_modules',
  'package-lock.json',
  'pnpm-dev.err.log',
  'pnpm-dev.out.log',
  'pnpm-dev-verify.err.log',
  'pnpm-dev-verify.out.log',
]

if (process.argv.includes('--tests')) {
  targets.push('test-results', 'playwright-report')
}

for (const target of targets) {
  const absoluteTarget = resolve(clientDir, target)
  if (absoluteTarget !== clientDir && absoluteTarget.startsWith(`${clientDir}\\`)) {
    await rm(absoluteTarget, { recursive: true, force: true })
  }
}
