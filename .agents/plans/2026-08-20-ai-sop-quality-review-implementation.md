# AI SOP Quality Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** menambahkan `Periksa dengan AI` pada editor SOP `DRAFT` untuk menghasilkan review kualitas transient dari snapshot database authoritative, tanpa mutation SOP, tanpa history AI, dan tanpa migration.

**Architecture:** backend menambahkan modul `sop/ai-review` yang read-only terhadap data aplikasi: service memverifikasi owner/status, repository memuat snapshot persisted, service memetakan snapshot ke provider-safe context tanpa DB IDs, provider menghasilkan structured review, dan application schema memvalidasi output terhadap snapshot yang sama. Client menunggu existing header+prosedur autosave selesai melalui `flushAllAutosave()`, memanggil review endpoint, menampilkan hasil di tab side panel existing, dan menghapus hasil ketika konten lokal berubah setelah review.

**Tech Stack:** NestJS + TypeScript + Prisma + Zod + Node 22 native `fetch`; React + TanStack Query/API client + Vitest; Playwright; Docker Compose/GitHub Actions.

**Spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`

## Global Constraints

- Review hanya untuk authenticated owner dan SOP status `DRAFT`.
- Browser tidak mengirim body SOP; request review hanya menargetkan `detailSopId`.
- Backend memuat latest persisted snapshot dari database.
- Provider input tidak boleh memuat `detailSopId`, user/workspace ID, actor ID, internal step ID, access token, audit log, atau SOP lain.
- Provider output adalah untrusted `unknown` sampai lolos canonicalization/validation.
- Severity hanya `ERROR | WARNING | SUGGESTION`.
- Status hanya `PERLU_PERBAIKAN | CUKUP_BAIK | SIAP_DIREVIEW`; advisory, bukan approval/compliance score.
- Maksimum 30 findings; invalid actor/step reference harus menghasilkan safe `422`, bukan silently dropped.
- AI review tidak membuat/update/delete application row.
- Tidak ada Prisma schema change atau migration.
- Tidak ada auto-fix/write-back, regulation lookup, RAG, web/file search, approval/evaluation/TTE/public archive, collaboration, generic chat, model selector, background job, atau persisted review history.
- `AI_REVIEW_PROVIDER=disabled|openai|fake`, default `disabled`; `fake` dilarang di production.
- `AI_REVIEW_TIMEOUT_MS` integer `5000..60000`, default `30000`; jangan rename/repurpose `AI_DRAFT_TIMEOUT_MS`.
- Production OpenAI adapter backend-only, `store:false`, strict JSON Schema, no tools/retrieval, sanitized failures.
- Mandatory CI memakai deterministic fake provider dan tidak memanggil provider live/berbayar.
- Existing blank/template/AI creation, autosave, Flowchart/BPMN, PDF, Complete, immutability, dan Create New Version tidak boleh regress.

## File Structure

Server files to create:

```text
server/src/modules/sop/ai-review/
  providers/
    ai-review-provider.ts
    disabled-ai-review.provider.ts
    fake-ai-review.provider.ts
    openai-ai-review.provider.ts
    openai-ai-review.provider.spec.ts
  sop-ai-review.controller.ts
  sop-ai-review.module.ts
  sop-ai-review.repository.ts
  sop-ai-review.repository.spec.ts
  sop-ai-review.schema.ts
  sop-ai-review.schema.spec.ts
  sop-ai-review.service.ts
  sop-ai-review.service.spec.ts
  sop-ai-review.types.ts
```

Server files to modify:

```text
server/src/app.module.ts
server/src/config/env.validation.ts
server/src/config/env.validation.spec.ts
compose.yml
.env.production.example
scripts/production-contract.sh
.github/workflows/ci.yml
```

Client files to create:

```text
client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts
client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx
client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx
client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx
client/e2e/journeys/ai-sop-quality-review.spec.ts
```

Client files to modify:

```text
client/src/api/workspace-sops.ts
client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts
client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopProsedurEditor.tsx
client/playwright.config.ts
```

Iteration files to modify at final gate:

```text
.agents/CURRENT_ITERATION.md
.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md
```

---

### Task 1: Review Domain Types and Canonical Output Validation

**Files:**
- Create: `server/src/modules/sop/ai-review/sop-ai-review.types.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.schema.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.schema.spec.ts`

**Interfaces:**
- Produces: `SopQualityReviewSnapshot`, `SopQualityReviewProviderInput`, `SopQualityFindingLocation`, `SopQualityFinding`, `SopQualityReviewResult`, `parseAndCanonicalizeAiReview(raw, snapshot)`.
- Consumes: existing Prisma enum string values `AWAL_AKHIR | KEGIATAN | KEPUTUSAN` and `m | h | d | w | mo | y` only as data values; this task does not touch persistence.

- [ ] **Step 1: Write failing canonicalization tests**

Create tests that cover valid output, whitespace trimming, deterministic duplicate collapse, >30 findings, invalid enum, invalid step reference, invalid actor reference, and unknown location shape.

```ts
const snapshot: SopQualityReviewSnapshot = {
  detailSopId: 'detail-1',
  versi: 1,
  judul: 'SOP Pelayanan',
  nomorSop: '001',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [
    { pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 },
    { pelaksanaId: 'actor-db-2', name: 'Verifikator', order: 2 },
  ],
  steps: [
    {
      langkahSopId: 'step-db-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Catat',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      langkahSopId: 'step-db-2',
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEPUTUSAN',
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: 'm',
      keterangan: 'Tentukan kelengkapan',
      actorName: 'Verifikator',
      targetYaUrutan: 1,
      targetTidakUrutan: 1,
    },
  ],
};

expect(
  parseAndCanonicalizeAiReview(
    {
      status: 'PERLU_PERBAIKAN',
      summary: '  Ada routing yang perlu diperiksa.  ',
      findings: [
        {
          severity: 'ERROR',
          category: 'DECISION_ROUTING',
          location: { kind: 'STEP', stepOrder: 2 },
          title: '  Routing keputusan tidak jelas  ',
          explanation: ' Jalur Ya dan Tidak mengarah ke langkah yang sama. ',
          recommendation: ' Bedakan tujuan kedua cabang keputusan. ',
        },
      ],
    },
    snapshot,
  ),
).toEqual({
  status: 'PERLU_PERBAIKAN',
  summary: 'Ada routing yang perlu diperiksa.',
  findings: [
    expect.objectContaining({ title: 'Routing keputusan tidak jelas' }),
  ],
});
```

For invalid references:

```ts
expect(() =>
  parseAndCanonicalizeAiReview(
    {
      status: 'CUKUP_BAIK',
      summary: 'Review menemukan satu hal yang harus dicek.',
      findings: [
        {
          severity: 'WARNING',
          category: 'CLARITY',
          location: { kind: 'STEP', stepOrder: 99 },
          title: 'Langkah tidak ditemukan',
          explanation: 'Finding menunjuk langkah yang tidak ada pada snapshot.',
          recommendation: 'Gunakan langkah yang benar pada snapshot.',
        },
      ],
    },
    snapshot,
  ),
).toThrow(/langkah/i);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd server
pnpm test --runInBand sop-ai-review.schema.spec.ts
```

Expected: FAIL because module/types/functions do not exist yet.

- [ ] **Step 3: Implement review types**

Define exact unions and internal/provider-safe shapes. Keep DB IDs only on internal snapshot.

```ts
export type SopQualityFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION';
export type SopQualityReviewStatus = 'PERLU_PERBAIKAN' | 'CUKUP_BAIK' | 'SIAP_DIREVIEW';

export type SopQualityFindingLocation =
  | { kind: 'HEADER' }
  | { kind: 'PERINGATAN' }
  | { kind: 'KUALIFIKASI_PELAKSANAAN' }
  | { kind: 'PERALATAN_PERLENGKAPAN' }
  | { kind: 'PENCATATAN_PENDATAAN' }
  | { kind: 'ACTOR'; actorName: string }
  | { kind: 'STEP'; stepOrder: number };
```

Define `SopQualityReviewProviderInput` without any ID fields:

```ts
export interface SopQualityReviewProviderInput {
  versi: number;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: Array<{ name: string; order: number }>;
  steps: Array<{
    urutan: number;
    kegiatan: string;
    jenis: 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN';
    kelengkapan: string;
    keluaran: string;
    waktu: number;
    satuanWaktu: 'm' | 'h' | 'd' | 'w' | 'mo' | 'y';
    keterangan: string;
    actorName: string;
    targetYaUrutan: number | null;
    targetTidakUrutan: number | null;
  }>;
}
```

- [ ] **Step 4: Implement strict canonicalization**

Use Zod discriminated location validation and snapshot-aware refinements. Normalize actor names with the existing `normalizeActorName()` helper from `../draft/sop-draft-normalization` so review matching uses the same actor normalization semantics as Iteration 4.

Duplicate key must be deterministic:

```ts
function findingKey(finding: SopQualityFinding): string {
  return [
    finding.severity,
    finding.category,
    JSON.stringify(finding.location),
    finding.title.trim().toLocaleLowerCase('id-ID'),
  ].join('|');
}
```

Reject invalid actor/step references with `UnprocessableEntityException('Hasil review AI tidak valid. Jalankan review ulang.')` at the module/service boundary; schema helper itself may throw `ZodError`/domain error as long as the service maps it safely in Task 3.

- [ ] **Step 5: Run schema tests and server typecheck**

```bash
cd server
pnpm test --runInBand sop-ai-review.schema.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add server/src/modules/sop/ai-review/sop-ai-review.types.ts \
        server/src/modules/sop/ai-review/sop-ai-review.schema.ts \
        server/src/modules/sop/ai-review/sop-ai-review.schema.spec.ts
git commit -m "feat: define AI SOP quality review contract"
```

---

### Task 2: Read-Only Authoritative Snapshot Repository

**Files:**
- Create: `server/src/modules/sop/ai-review/sop-ai-review.repository.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.repository.spec.ts`

**Interfaces:**
- Consumes: `SopQualityReviewSnapshot` from Task 1.
- Produces: `findReviewContext(detailSopId): Promise<{ ownerId: string; status: StatusSOP; snapshot: SopQualityReviewSnapshot } | null>`.

- [ ] **Step 1: Write the failing repository test**

Mock `PrismaService.detailSOP.findUnique` and assert the query reads only the current detail plus owning workspace, lampiran arrays, ordered swimlanes/pelaksana, and ordered langkah/pelaksana.

```ts
await expect(repository.findReviewContext('detail-1')).resolves.toEqual({
  ownerId: 'user-1',
  status: 'DRAFT',
  snapshot: expect.objectContaining({
    detailSopId: 'detail-1',
    versi: 1,
    actors: [expect.objectContaining({ name: 'Petugas', order: 1 })],
    steps: [expect.objectContaining({ urutan: 1, actorName: 'Petugas' })],
  }),
});
```

Also assert source implementation has no `$transaction`, `.create(`, `.update(`, `.delete(` calls in review repository. Prefer a direct unit assertion on mocked Prisma mutation methods remaining untouched.

- [ ] **Step 2: Verify RED**

```bash
cd server
pnpm test --runInBand sop-ai-review.repository.spec.ts
```

Expected: FAIL because repository does not exist.

- [ ] **Step 3: Implement one Prisma read query**

Use `detailSOP.findUnique({ where: { detailSopId }, include: ... })`. Required mappings:

```ts
return {
  ownerId: row.sop.workspace.ownerId,
  status: row.sop.status,
  snapshot: {
    detailSopId: row.detailSopId,
    versi: row.versi,
    judul: row.sop.judul,
    nomorSop: row.nomorSOP,
    namaLembaga: row.namaLembaga,
    peringatan: row.lampiranPeringatan.map((x) => x.isi),
    kualifikasiPelaksanaan: row.lampiranKualifikasiPelaksanaan.map((x) => x.isi),
    peralatanPerlengkapan: row.lampiranPeralatanPerlengkapan.map((x) => x.isi),
    pencatatanPendataan: row.lampiranPencatatanPendataan.map((x) => x.isi),
    actors: orderedSwimlanes.map(...),
    steps: orderedSteps.map(...),
  },
};
```

When mapping decision targets, translate internal target IDs to target step `urutan` using a local `Map<langkahSopId, urutan>`. Do not leak those IDs outside `snapshot`.

- [ ] **Step 4: Run repository test and server typecheck**

```bash
cd server
pnpm test --runInBand sop-ai-review.repository.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add server/src/modules/sop/ai-review/sop-ai-review.repository.ts \
        server/src/modules/sop/ai-review/sop-ai-review.repository.spec.ts
git commit -m "feat: load authoritative SOP review snapshot"
```

---

### Task 3: Review Provider Contract, Service Trust Boundary, and Authenticated API

**Files:**
- Create: `server/src/modules/sop/ai-review/providers/ai-review-provider.ts`
- Create: `server/src/modules/sop/ai-review/providers/disabled-ai-review.provider.ts`
- Create: `server/src/modules/sop/ai-review/providers/fake-ai-review.provider.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.service.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.service.spec.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.controller.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: repository context from Task 2 and canonicalization from Task 1.
- Produces: `AI_REVIEW_PROVIDER`, `AiReviewProvider.review(input)`, `SopAiReviewService.availability()`, `SopAiReviewService.review(user, detailSopId)`, authenticated `GET /sop/ai-reviews/availability`, `POST /sop/:detailSopId/ai-review`.

- [ ] **Step 1: Write failing service tests**

Cover these gates in this order:

```ts
it('rejects disabled provider before loading SOP content', async () => {
  config.get.mockReturnValue('disabled');
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 503 });
  expect(repository.findReviewContext).not.toHaveBeenCalled();
});

it('rejects non-owner before provider invocation', async () => {
  repository.findReviewContext.mockResolvedValue({
    ownerId: 'other-user',
    status: 'DRAFT',
    snapshot,
  });
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 403 });
  expect(provider.review).not.toHaveBeenCalled();
});

it('rejects completed SOP before provider invocation', async () => {
  repository.findReviewContext.mockResolvedValue({
    ownerId: user.sub,
    status: 'COMPLETED',
    snapshot,
  });
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 409 });
  expect(provider.review).not.toHaveBeenCalled();
});
```

Provider-safe input assertion is mandatory:

```ts
await service.review(user, 'detail-1');
const providerInput = provider.review.mock.calls[0][0];
const serialized = JSON.stringify(providerInput);
expect(serialized).not.toContain('detail-1');
expect(serialized).not.toContain('actor-db-1');
expect(serialized).not.toContain('step-db-1');
expect(serialized).not.toContain(user.sub);
expect(providerInput.steps[0]).toMatchObject({ urutan: 1, actorName: 'Petugas' });
```

- [ ] **Step 2: Verify RED**

```bash
cd server
pnpm test --runInBand sop-ai-review.service.spec.ts
```

Expected: FAIL because provider/service do not exist.

- [ ] **Step 3: Implement provider interface and deterministic fake/disabled providers**

```ts
export const AI_REVIEW_PROVIDER = Symbol('AI_REVIEW_PROVIDER');

export interface AiReviewProvider {
  review(input: SopQualityReviewProviderInput): Promise<unknown>;
}
```

`DisabledAiReviewProvider.review()` throws `ServiceUnavailableException('AI review belum tersedia')`.

`FakeAiReviewProvider` must produce only references that are valid for the supplied input. Example behavior:

```ts
const step = input.steps.find((item) => item.jenis === 'KEPUTUSAN') ?? input.steps[0];
return {
  status: 'CUKUP_BAIK',
  summary: 'Struktur utama dapat dipahami, tetapi beberapa bagian masih perlu ditinjau manusia.',
  findings: step
    ? [{
        severity: 'WARNING',
        category: 'CLARITY',
        location: { kind: 'STEP', stepOrder: step.urutan },
        title: 'Perjelas kriteria pelaksanaan',
        explanation: 'Langkah ini masih dapat ditafsirkan berbeda oleh pelaksana.',
        recommendation: 'Gunakan kata kerja operasional dan kriteria hasil yang lebih spesifik.',
      }]
    : [{
        severity: 'WARNING',
        category: 'COMPLETENESS',
        location: { kind: 'HEADER' },
        title: 'Lengkapi prosedur',
        explanation: 'Draft belum memiliki langkah yang dapat direview secara operasional.',
        recommendation: 'Tambahkan langkah prosedur sebelum melakukan review ulang.',
      }],
};
```

- [ ] **Step 4: Implement service orchestration**

Required sequence:

```ts
if (this.providerMode() === 'disabled') throw new ServiceUnavailableException(...);
const context = await this.repository.findReviewContext(detailSopId);
if (!context) throw new NotFoundException('SOP tidak ditemukan');
if (context.ownerId !== user.sub) throw new ForbiddenException('Akses ditolak');
if (context.status !== StatusSOP.DRAFT) throw new ConflictException('Hanya SOP draft yang dapat direview');
const providerInput = toProviderSafeInput(context.snapshot);
const raw = await this.provider.review(providerInput);
const result = parseAndCanonicalizeAiReview(raw, context.snapshot);
return {
  reviewedDetailSopId: context.snapshot.detailSopId,
  reviewedVersion: context.snapshot.versi,
  result,
};
```

Map schema/provider invalid output to `UnprocessableEntityException('Hasil review AI tidak dapat digunakan. Jalankan review ulang.')` without exposing raw payload.

- [ ] **Step 5: Implement authenticated controller/module**

Controller shape:

```ts
@ApiTags('SOP AI Reviews')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
@Controller()
export class SopAiReviewController {
  @Get('sop/ai-reviews/availability')
  availability() { ... }

  @Post('sop/:detailSopId/ai-review')
  @HttpCode(200)
  review(@Req() req: Request & { user: JwtAccessPayload }, @Param('detailSopId') detailSopId: string) {
    return this.service.review(req.user, detailSopId);
  }
}
```

`SopAiReviewModule` imports only what it needs; do not import mutation-oriented modules solely for review. Add `SopAiReviewModule` to `AppModule` alongside `SopAiDraftModule`.

- [ ] **Step 6: Run focused tests and server build**

```bash
cd server
pnpm test --runInBand sop-ai-review.service.spec.ts sop-ai-review.schema.spec.ts sop-ai-review.repository.spec.ts
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add server/src/modules/sop/ai-review server/src/app.module.ts
git commit -m "feat: add AI SOP review service boundary"
```

---

### Task 4: Production OpenAI Review Adapter and Runtime Safety Contract

**Files:**
- Create: `server/src/modules/sop/ai-review/providers/openai-ai-review.provider.ts`
- Create: `server/src/modules/sop/ai-review/providers/openai-ai-review.provider.spec.ts`
- Modify: `server/src/modules/sop/ai-review/sop-ai-review.module.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/env.validation.spec.ts`
- Modify: `compose.yml`
- Modify: `.env.production.example`
- Modify: `scripts/production-contract.sh`

**Interfaces:**
- Consumes: `AiReviewProvider`, `SopQualityReviewProviderInput`.
- Produces: OpenAI-backed provider selected by `AI_REVIEW_PROVIDER` and independently configurable timeout.

- [ ] **Step 1: Add RED environment tests**

Add assertions:

```ts
expect(validateEnv(baseEnv)).toMatchObject({
  AI_REVIEW_PROVIDER: 'disabled',
  AI_REVIEW_TIMEOUT_MS: 30000,
});

expect(() => validateEnv({ ...baseEnv, AI_REVIEW_TIMEOUT_MS: '4999' }))
  .toThrow(/AI_REVIEW_TIMEOUT_MS/);
expect(() => validateEnv({ ...baseEnv, AI_REVIEW_TIMEOUT_MS: '60001' }))
  .toThrow(/AI_REVIEW_TIMEOUT_MS/);

expect(() => validateEnv({ ...baseEnv, AI_REVIEW_PROVIDER: 'openai' }))
  .toThrow(/OPENAI_API_KEY/);

expect(() => validateEnv({
  ...baseEnv,
  NODE_ENV: 'production',
  PUBLIC_APP_ORIGIN: 'https://sop.example.test',
  ALLOWED_ORIGINS: 'https://sop.example.test',
  AI_REVIEW_PROVIDER: 'fake',
})).toThrow(/AI_REVIEW_PROVIDER/);
```

Run:

```bash
cd server
pnpm test --runInBand env.validation.spec.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement environment schema**

Add:

```ts
AI_REVIEW_PROVIDER: z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['disabled', 'openai', 'fake']).default('disabled'),
),
AI_REVIEW_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(30000),
```

OpenAI credential rule must apply when either `AI_DRAFT_PROVIDER === 'openai'` or `AI_REVIEW_PROVIDER === 'openai'`. Production must reject fake for each provider independently.

- [ ] **Step 3: Write RED OpenAI transport tests**

Mirror the strong Iteration 4 transport assertions, but require review-specific schema and privacy.

```ts
await makeProvider().review(providerInput);
const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
expect(body.store).toBe(false);
expect(body.text.format).toMatchObject({
  type: 'json_schema',
  name: 'sop_quality_review',
  strict: true,
});
expect(body).not.toHaveProperty('tools');
expect(JSON.stringify(body.input)).not.toMatch(/detail-1|actor-db|step-db|user-/);
expect(body.instructions).toContain('jangan menyatakan kepatuhan hukum');
```

Also test 429 -> safe 429, HTTP/network/timeout -> 503, refusal/incomplete/empty/invalid JSON -> 422, and absence of raw provider error text.

- [ ] **Step 4: Implement OpenAI Responses transport**

Use Node 22 native `fetch` consistently with `OpenAiDraftProvider`; do not add a new SDK dependency.

Request invariants:

```ts
body: JSON.stringify({
  model,
  store: false,
  instructions: REVIEW_INSTRUCTIONS,
  input: [{
    role: 'user',
    content: [{ type: 'input_text', text: JSON.stringify(input) }],
  }],
  text: {
    format: {
      type: 'json_schema',
      name: 'sop_quality_review',
      strict: true,
      schema: SOP_QUALITY_REVIEW_JSON_SCHEMA,
    },
  },
})
```

The JSON schema must exactly bound statuses, severities, categories, location union, max 30 findings, and text lengths. `review()` returns parsed JSON as `unknown`; application schema remains the final authority.

- [ ] **Step 5: Wire provider selection**

In `SopAiReviewModule`, use a factory parallel to Iteration 4:

```ts
const mode = config.get<string>('AI_REVIEW_PROVIDER') ?? 'disabled';
if (mode === 'fake') return fake;
if (mode === 'openai') return openai;
return disabled;
```

- [ ] **Step 6: Add production configuration contract**

`compose.yml` backend adds:

```yaml
AI_REVIEW_PROVIDER: ${AI_REVIEW_PROVIDER:-disabled}
AI_REVIEW_TIMEOUT_MS: ${AI_REVIEW_TIMEOUT_MS:-30000}
```

`.env.production.example` documents review as separately disabled by default.

`production-contract.sh` asserts:

```bash
grep -q 'AI_REVIEW_PROVIDER: disabled' <<<"$backend_block" || {
  echo "production AI review must default to disabled" >&2
  exit 1
}
! grep -q 'AI_REVIEW_PROVIDER: fake' <<<"$backend_block" || {
  echo "fake AI review provider must never be used by production Compose" >&2
  exit 1
}
```

- [ ] **Step 7: Run provider/config/production contract tests**

```bash
cd server
pnpm test --runInBand env.validation.spec.ts openai-ai-review.provider.spec.ts
pnpm typecheck
pnpm build
cd ..
PRODUCTION_ENV_FILE=.env.production.example bash scripts/production-contract.sh
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add server/src/modules/sop/ai-review/providers \
        server/src/modules/sop/ai-review/sop-ai-review.module.ts \
        server/src/config/env.validation.ts server/src/config/env.validation.spec.ts \
        compose.yml .env.production.example scripts/production-contract.sh
git commit -m "feat: add production AI review provider"
```

---

### Task 5: Client Review API and Autosave-Settled Review Hook

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Modify: `client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts`
- Create: `client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx`

**Interfaces:**
- Produces client types matching server response, `workspaceSopApi.aiReviewAvailability()`, `workspaceSopApi.reviewAiSop(detailSopId)`, `flushAllAutosave()`, and `useAiSopQualityReview(...)`.
- Consumes existing header/prosedur `flush()` implementations; no new persistence path.

- [ ] **Step 1: Add client response types/API methods**

Add exact union types in `workspace-sops.ts`:

```ts
export type SopQualityFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION';
export type SopQualityReviewStatus = 'PERLU_PERBAIKAN' | 'CUKUP_BAIK' | 'SIAP_DIREVIEW';

export interface SopQualityReviewResponse {
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: {
    status: SopQualityReviewStatus;
    summary: string;
    findings: SopQualityFinding[];
  };
}
```

API methods:

```ts
aiReviewAvailability: () =>
  apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>('/sop/ai-reviews/availability'),
reviewAiSop: (detailSopId: string) =>
  apiClient.post<ApiSuccessResponse<SopQualityReviewResponse>>(
    `/sop/${encodeURIComponent(detailSopId)}/ai-review`,
    {},
  ),
```

- [ ] **Step 2: Expose one existing autosave gate from editor hook**

In `use-detail-sop-penyusun.ts`, expose the existing `flushAll` as public `flushAllAutosave: () => Promise<void>`; do not change header/prosedur autosave internals.

```ts
const flushAllAutosave = useCallback(async () => {
  await Promise.all([headerAutosave.flush(), prosedurAutosave.flush()]);
}, [headerAutosave.flush, prosedurAutosave.flush]);
```

Use that same function for Complete/retry so there remains one aggregate gate.

- [ ] **Step 3: Write RED hook tests**

The hook receives:

```ts
useAiSopQualityReview({
  detailSopId,
  isReadOnly,
  flushAllAutosave,
  contentFingerprint,
});
```

Required behaviors:

1. loads availability;
2. `runReview()` first awaits `flushAllAutosave()` then calls API;
3. if flush rejects, API is not called and error is exposed;
4. no review when `isReadOnly` or disabled;
5. successful result captures the current `contentFingerprint`;
6. later fingerprint change clears transient result;
7. rerun replaces prior result; no review history array.

Example assertion:

```ts
await act(async () => result.current.runReview());
expect(flushAllAutosave).toHaveBeenCalledTimes(1);
expect(reviewAiSop).toHaveBeenCalledWith('detail-1');
expect(result.current.review?.reviewedDetailSopId).toBe('detail-1');
```

- [ ] **Step 4: Verify RED**

```bash
cd client
pnpm test -- use-ai-sop-quality-review.spec.tsx
```

Expected: FAIL before hook implementation.

- [ ] **Step 5: Implement transient hook**

Keep only one result in state. Track `reviewedFingerprintRef`; clear if current fingerprint differs.

```ts
useEffect(() => {
  if (reviewedFingerprintRef.current === null) return;
  if (reviewedFingerprintRef.current !== contentFingerprint) {
    reviewedFingerprintRef.current = null;
    setReview(null);
  }
}, [contentFingerprint]);
```

`runReview()` sequence must be:

```ts
await flushAllAutosave();
const response = await workspaceSopApi.reviewAiSop(detailSopId);
reviewedFingerprintRef.current = contentFingerprint;
setReview(response.data);
```

Do not send editor state to API.

- [ ] **Step 6: Run client focused tests/typecheck**

```bash
cd client
pnpm test -- use-ai-sop-quality-review.spec.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add client/src/api/workspace-sops.ts \
        client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts \
        client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts \
        client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx
git commit -m "feat: add autosave-gated AI review client"
```

---

### Task 6: Existing Editor AI Review Tab, Findings UI, and Location Navigation

**Files:**
- Create: `client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx`
- Create: `client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopProsedurEditor.tsx`

**Interfaces:**
- Consumes: `useAiSopQualityReview`, existing side-panel tabs, `isEditingSteps` state.
- Produces: `AI Review` side-panel tab for editable drafts, explicit `Periksa dengan AI`, advisory summary/findings, and step navigation.

- [ ] **Step 1: Write RED component test**

Render `AiSopQualityReviewPanel` with deterministic props and assert:

```tsx
expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'Periksa dengan AI' }));
expect(onReview).toHaveBeenCalledTimes(1);
expect(screen.getByText('Perlu perbaikan')).toBeInTheDocument();
expect(screen.getByText('Routing keputusan tidak jelas')).toBeInTheDocument();
expect(screen.getByText(/AI memberikan saran/i)).toBeInTheDocument();
```

For a STEP finding, clicking the finding action must call `onNavigateFinding(finding.location)`.

Disabled provider copy must be explicit and non-blocking: `AI review belum tersedia. Editor SOP tetap dapat digunakan seperti biasa.`

- [ ] **Step 2: Verify RED**

```bash
cd client
pnpm test -- AiSopQualityReviewPanel.spec.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement review panel**

Panel states:

- disabled provider;
- ready/no review;
- flushing/reviewing (`Memeriksa SOP...`);
- safe error with `Coba lagi`;
- result summary + findings grouped by severity.

Do not render a numeric score or approval wording. Map advisory status labels:

```ts
const statusLabel = {
  PERLU_PERBAIKAN: 'Perlu perbaikan',
  CUKUP_BAIK: 'Cukup baik',
  SIAP_DIREVIEW: 'Siap direview manusia',
};
```

- [ ] **Step 4: Add AI Review tab to existing side panel**

Extend `TabId` to `'edit' | 'ai-review' | 'versi' | 'aktivitas'` and use a `Sparkles`/`ScanSearch` icon. Only include the AI review tab when `!isReadOnly`; completed/archived editor stays unchanged.

Pass review state/handlers from `DetailSOPPenyusun` as explicit props rather than creating a second editor context.

- [ ] **Step 5: Build stable local content fingerprint**

In `DetailSOPPenyusun`, derive fingerprint from the same data domains autosave tracks:

```ts
const reviewContentFingerprint = useMemo(
  () => JSON.stringify({ metadata, implementers, prosedurRows }),
  [metadata, implementers, prosedurRows],
);
```

Call `useAiSopQualityReview` with `flushAllAutosave` from the editor hook. This fingerprint is only for transient staleness UI; it is not server authority and is never sent to provider.

- [ ] **Step 6: Implement STEP finding navigation without new routing subsystem**

Annotate each rendered procedure row container in `DetailSopProsedurEditor.tsx`:

```tsx
<div data-sop-step-order={row.urutan}>...</div>
```

In `DetailSOPPenyusun`, navigation for `{ kind: 'STEP', stepOrder }`:

```ts
setIsEditingSteps(true);
requestAnimationFrame(() => {
  document
    .querySelector(`[data-sop-step-order="${stepOrder}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
```

For non-step locations, switch side panel back to `edit` through an `onRequestTab`/controlled active-tab callback and show the finding location label. Do not build DOM-selector coupling for every metadata field in this iteration.

- [ ] **Step 7: Run UI tests and full client checks**

```bash
cd client
pnpm test -- AiSopQualityReviewPanel.spec.tsx use-ai-sop-quality-review.spec.tsx
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```bash
git add client/src/pages/penyusun/sop/detail \
        client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts
git commit -m "feat: show AI quality review in SOP editor"
```

---

### Task 7: Acceptance Journey and Mandatory CI Provider Wiring

**Files:**
- Create: `client/e2e/journeys/ai-sop-quality-review.spec.ts`
- Modify: `client/playwright.config.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: deterministic `fake` review provider and existing authenticated E2E bootstrap.
- Produces: end-to-end proof that review uses persisted data, does not mutate, clears after edits, reruns, and leaves lifecycle features intact.

- [ ] **Step 1: Add the new Playwright file to `testMatch` before enabling fake review**

```ts
testMatch: [
  'journeys/mvp-vertical-slice.spec.ts',
  'journeys/ai-assisted-draft.spec.ts',
  'journeys/ai-sop-quality-review.spec.ts',
],
```

Do **not** add `AI_REVIEW_PROVIDER=fake` yet. This creates a genuine RED acceptance gate proving the new test is actually executed.

- [ ] **Step 2: Write acceptance journey**

Use normal UI to create a workspace/SOP (blank or existing AI draft path is acceptable, but keep this journey focused). Required sequence:

```text
create workspace + actor
create editable DRAFT
enter at least 3 steps including one decision
wait for autosave "Tersimpan"
open AI Review tab
assert Periksa dengan AI is disabled/unavailable in first RED run
(after fake enabled) click Periksa dengan AI
assert advisory warning + finding tied to a real step
assert activity/input values remain unchanged after review
click STEP finding and assert step editor opens/target row is visible
edit that step
assert previous review disappears/stale result is not shown
wait autosave
run review again
assert result reappears
switch BPMN and Flowchart and assert both render
complete SOP
assert AI Review action no longer appears in completed immutable state
create new version
assert v2 is editable and AI Review is available again
```

Add an explicit no-mutation check by capturing an input value before review and asserting it remains identical immediately after review.

- [ ] **Step 3: Run genuine RED acceptance**

With backend running under default `AI_REVIEW_PROVIDER=disabled`, run:

```bash
cd client
pnpm test:e2e
```

Expected: new quality-review journey FAILS at review availability/action while existing blank/template/AI-assisted journeys continue to pass. Record this run in the implementation plan evidence section when executing.

- [ ] **Step 4: Enable deterministic review provider in E2E CI**

Add to `.github/workflows/ci.yml` E2E env:

```yaml
AI_REVIEW_PROVIDER: fake
AI_REVIEW_TIMEOUT_MS: "30000"
```

Production Compose CI env must keep:

```text
AI_REVIEW_PROVIDER=disabled
AI_REVIEW_TIMEOUT_MS=30000
```

- [ ] **Step 5: Run GREEN E2E locally/CI-compatible**

```bash
cd client
pnpm test:e2e
```

Expected: all four mandatory journeys pass: MVP blank, template lifecycle, AI-assisted draft lifecycle, AI quality review lifecycle.

- [ ] **Step 6: Commit Task 7**

```bash
git add client/e2e/journeys/ai-sop-quality-review.spec.ts \
        client/playwright.config.ts .github/workflows/ci.yml
git commit -m "test: cover AI SOP quality review lifecycle"
```

---

### Task 8: Full Regression, Security Review, PR Update, and Iteration Review-Ready Gate

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Modify: `.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md`
- Update: PR #7 description/title as implementation proceeds; keep same branch/PR.

**Interfaces:**
- Consumes: all tasks above.
- Produces: verified `REVIEW_READY` Iteration 5 state. Because external AI/provider credential boundary is security-sensitive, do not merge without explicit final user approval.

- [ ] **Step 1: Run complete server verification**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Run complete client verification**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 3: Run full Playwright acceptance**

```bash
cd client
pnpm test:e2e
```

Expected: all mandatory journeys PASS with deterministic fake providers.

- [ ] **Step 4: Run production deployment contract**

```bash
PRODUCTION_ENV_FILE=.env.production.example bash scripts/production-contract.sh
```

Then rely on mandatory GitHub Actions `production-compose` to build images, run migrations twice, seed exact template state, prove DB/PDF persistence, readiness, backup retention, and restore with both AI features disabled by default.

- [ ] **Step 5: Perform focused security/trust-boundary review**

Inspect final diff and explicitly verify:

```text
- endpoint guarded by JwtAuthGuard
- owner/status check before provider invocation
- provider input contains no application IDs/user profile/audit logs
- repository is read-only
- AI review does not call SOP mutation services
- result never becomes completion gate
- no Prisma migration/schema change
- fake review provider rejected in production env validation
- Compose defaults review disabled
- OpenAI key/model backend-only
- no tools/retrieval in review transport
- store:false
- raw provider body/error not exposed/logged
- result cleared after local edits
- autosave failure prevents review call
```

Any blocker remains on this same branch/PR and must be fixed before review-ready state.

- [ ] **Step 6: Wait for mandatory GitHub Actions on final head**

Required jobs:

```text
server: success
client: success
e2e: success
production-compose: success
```

Do not claim completion based on an older SHA.

- [ ] **Step 7: Update iteration evidence**

Set `.agents/CURRENT_ITERATION.md`:

```text
Iteration: 5-ai-sop-quality-review
Status: REVIEW_READY
Working branch: feat/ai-sop-quality-review
Pull request: #7
```

Record:

- genuine RED acceptance run SHA/run number;
- GREEN code-bearing SHA/run number;
- final documentation head CI run;
- explicit statement that no Prisma migration was added;
- explicit trust-boundary audit result;
- unresolved review thread status.

Update this implementation plan checkboxes/evidence to reflect actual execution; do not fabricate run numbers.

- [ ] **Step 8: Update PR #7 from design-only to implementation review**

PR body must summarize:

```text
product behavior
server trust boundary
runtime/provider configuration
client autosave/staleness behavior
acceptance journeys
production safety
final CI evidence
merge gate
```

Keep PR draft until final review-ready verification is complete, then mark ready for review if connector permits.

- [ ] **Step 9: Final integration gate**

Do not auto-merge. Iteration 5 extends the external AI provider surface and server-side credential use, so treat final merge as security-sensitive under repository `AGENTS.md`. Require explicit user approval after `REVIEW_READY`, then squash merge with expected head SHA.

---

## Acceptance Checklist

The iteration is functionally complete only when all of these are proven:

- [ ] `GET /sop/ai-reviews/availability` is authenticated and leaks no provider details.
- [ ] `POST /sop/:detailSopId/ai-review` accepts no SOP body as authority.
- [ ] Non-owner review is rejected before provider call.
- [ ] COMPLETED/ARCHIVED review is rejected before provider call.
- [ ] Provider-safe input contains no application IDs or user/workspace metadata.
- [ ] Provider output with invalid step/actor references yields safe `422`.
- [ ] Review repository performs no application mutation.
- [ ] Review waits for existing autosave flush; failed autosave prevents review call.
- [ ] Review never changes SOP field values.
- [ ] Editing after review clears transient result.
- [ ] Review can be run again after successful autosave.
- [ ] STEP finding navigation opens/scrolls to the corresponding procedural row.
- [ ] No numeric AI score or legal/compliance certification wording appears.
- [ ] AI review disabled/failure does not block normal editor lifecycle.
- [ ] Blank/template/AI-assisted creation regression journeys remain green.
- [ ] Flowchart/BPMN, Complete, immutability, and Create New Version remain green.
- [ ] Production Compose boots with `AI_REVIEW_PROVIDER=disabled` and no OpenAI credential.
- [ ] Production validation rejects `AI_REVIEW_PROVIDER=fake`.
- [ ] No Prisma schema/migration change exists in the final diff.
- [ ] All four mandatory CI jobs are green on the final head.
