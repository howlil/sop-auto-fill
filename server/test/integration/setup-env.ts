import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertIntegrationDockerOnly } from './helpers/integration-runtime.util';

const runtimeEnvKeys = new Set(Object.keys(process.env));

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.SWAGGER_ENABLED = process.env.SWAGGER_ENABLED ?? 'false';
process.env.PDF_SIGNING_ENABLED = 'false';

function loadEnvFile(filePath: string, override: boolean): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (runtimeEnvKeys.has(key)) {
      continue;
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const rootDir = resolve(__dirname, '..', '..');
loadEnvFile(resolve(rootDir, '.env'), false);
loadEnvFile(resolve(rootDir, `.env.${process.env.NODE_ENV}`), true);
loadEnvFile(resolve(rootDir, `.env.${process.env.NODE_ENV}.local`), true);
process.env.PDF_SIGNING_ENABLED = 'false';
assertIntegrationDockerOnly();
