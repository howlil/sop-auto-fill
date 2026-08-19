import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('smart template persistence contract', () => {
  const serverRoot = process.cwd();
  const schema = readFileSync(join(serverRoot, 'prisma', 'schema.prisma'), 'utf8');

  it('persists exactly the two designed template models with decision-order references', () => {
    expect(schema).toContain('model SopTemplate {');
    expect(schema).toContain('model SopTemplateStep {');
    expect(schema).toContain('peringatan Json');
    expect(schema).toContain('actorName String');
    expect(schema).toContain('targetYaUrutan Int?');
    expect(schema).toContain('targetTidakUrutan Int?');
    expect(schema).toContain('@@unique([templateId, urutan])');
  });

  it('provides the configured production seed entrypoint for idempotent system templates', () => {
    const seedPath = join(serverRoot, 'prisma', 'seed.ts');
    const pkg = JSON.parse(readFileSync(join(serverRoot, 'package.json'), 'utf8')) as {
      prisma?: { seed?: string };
    };

    expect(existsSync(seedPath)).toBe(true);
    expect(pkg.prisma?.seed).toContain('prisma/seed.ts');
  });
});
