import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2).filter((arg) => arg !== '--seed')
const shouldSeed = process.argv.slice(2).includes('--seed')
const env = {
  ...process.env,
}

if (shouldSeed) {
  env.E2E_SEED = 'true'
}

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const playwrightCli = resolve(clientDir, 'node_modules/@playwright/test/cli.js')

const child = spawn(process.execPath, [playwrightCli, 'test', ...args], {
  cwd: clientDir,
  env,
  shell: false,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
