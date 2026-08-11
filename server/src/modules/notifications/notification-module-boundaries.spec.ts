import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PROVIDER_IMPLEMENTATION_DETAILS = [
  /whaapi\.flobaze\.com/i,
  /\/api\/v1\/send-message/i,
  /whaapi\.provider/i,
] as const;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function mayReferenceConcreteProvider(relativePath: string): boolean {
  return (
    relativePath.startsWith(`reminders${process.platform === 'win32' ? '\\' : '/'}providers`) ||
    relativePath.endsWith('reminders/notification.module.ts') ||
    relativePath.endsWith('reminders\\notification.module.ts')
  );
}

describe('Notification module boundaries', () => {
  it('mengisolasi detail implementasi provider dari domain reminder', () => {
    const moduleRoot = __dirname;
    const files = listFiles(moduleRoot).filter(
      (file) => !file.endsWith('notification-module-boundaries.spec.ts'),
    );
    const violations = files.flatMap((file) => {
      const rel = relative(moduleRoot, file);
      if (mayReferenceConcreteProvider(rel)) {
        return [];
      }
      const fileText = readFileSync(file, 'utf8');
      return PROVIDER_IMPLEMENTATION_DETAILS.flatMap((term) =>
        term.test(fileText) ? [`content:${rel}`] : [],
      );
    });

    expect(violations).toEqual([]);
  });
});
