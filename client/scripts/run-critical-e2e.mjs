import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = resolve(clientDir, '..', 'server')
const journeyIds = ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07']

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function assertDisposableDatabase() {
  const identity = `${process.env.DATABASE_NAME ?? ''} ${process.env.DATABASE_URL ?? ''}`
  if (!/(^|[^a-z])(test|ci_e2e)([^a-z]|$)/i.test(identity)) {
    console.error(
      'Critical E2E menolak reset database karena DATABASE_NAME/DATABASE_URL tidak terlihat sebagai database test.',
    )
    console.error('Gunakan database disposable yang namanya mengandung "test" atau "ci_e2e".')
    process.exit(1)
  }
}

assertDisposableDatabase()
run(process.execPath, ['scripts/audit-e2e-journeys.mjs'], clientDir)

for (const journeyId of journeyIds) {
  console.log(`\n=== ${journeyId}: reset disposable database ===`)
  run('pnpm', ['prisma', 'db', 'push', '--force-reset', '--accept-data-loss'], serverDir)
  run('pnpm', ['db:seed:e2e'], serverDir)

  console.log(`=== ${journeyId}: execute isolated journey ===`)
  run(
    process.execPath,
    ['scripts/run-e2e.mjs', 'journeys', '--grep', `${journeyId}\\b`, '--project=chromium'],
    clientDir,
    {
      E2E_SEED: 'false',
      E2E_TEST_RUN_ID: `${journeyId}-${Date.now()}`,
    },
  )
}
