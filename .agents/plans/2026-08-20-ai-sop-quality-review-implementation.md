# AI SOP Quality Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** menambahkan `Periksa dengan AI` pada editor SOP `DRAFT` untuk menghasilkan review kualitas transient dari snapshot database authoritative, tanpa mutation SOP, tanpa history AI, dan tanpa migration.

**Architecture:** backend menambahkan modul `sop/ai-review` yang read-only terhadap data aplikasi. Service memverifikasi provider, owner, dan status; repository memuat snapshot persisted; service mengubahnya menjadi provider-safe context tanpa DB IDs; provider menghasilkan structured review; application schema memvalidasi output terhadap snapshot yang sama. Client memakai autosave existing dan menambahkan hasil boolean pada `flush()` agar review hanya berjalan setelah header dan prosedur benar-benar tersimpan, kemudian menampilkan satu hasil transient pada tab `AI Review` di side panel existing.

**Tech Stack:** NestJS + TypeScript + Prisma + Zod + Node 22 native `fetch`; React + existing API/TanStack stack + Vitest; Playwright; Docker Compose; GitHub Actions.

**Spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`

## Global Constraints

- Review hanya untuk authenticated owner dan SOP status `DRAFT`.
- Browser tidak mengirim body SOP; request review hanya menargetkan `detailSopId`.
- Backend memuat latest persisted snapshot dari database.
- Provider input tidak boleh memuat `detailSopId`, user/workspace ID, actor ID, internal step ID, access token, audit log, atau SOP lain.
- Provider output adalah untrusted `unknown` sampai lolos canonicalization/validation.
- Severity hanya `ERROR | WARNING | SUGGESTION`.
- Status hanya `PERLU_PERBAIKAN | CUKUP_BAIK | SIAP_DIREVIEW`; advisory, bukan approval/compliance score.
- Maksimum 30 findings; invalid actor/step reference menghasilkan safe `422`, bukan silently dropped.
- AI review tidak membuat/update/delete application row.
- Tidak ada Prisma schema change atau migration.
- Tidak ada auto-fix/write-back, regulation lookup, RAG, web/file search, approval/evaluation/TTE/public archive, collaboration, generic chat, model selector, background job, atau persisted review history.
- `AI_REVIEW_PROVIDER=disabled|openai|fake`, default `disabled`; `fake` dilarang di production.
- `AI_REVIEW_TIMEOUT_MS` integer `5000..60000`, default `30000`; jangan rename/repurpose `AI_DRAFT_TIMEOUT_MS`.
- Production OpenAI adapter backend-only, `store:false`, strict JSON Schema, no tools/retrieval, sanitized failures.
- Mandatory CI memakai deterministic fake provider dan tidak memanggil provider live/berbayar.
- Existing blank/template/AI creation, autosave, Flowchart/BPMN, PDF, Complete, immutability, dan Create New Version tidak boleh regress.

## File Structure

Server create:

```text
server/src/modules/sop/ai-review/providers/ai-review-provider.ts
server/src/modules/sop/ai-review/providers/disabled-ai-review.provider.ts
server/src/modules/sop/ai-review/providers/fake-ai-review.provider.ts
server/src/modules/sop/ai-review/providers/openai-ai-review.provider.ts
server/src/modules/sop/ai-review/providers/openai-ai-review.provider.spec.ts
server/src/modules/sop/ai-review/sop-ai-review.controller.ts
server/src/modules/sop/ai-review/sop-ai-review.module.ts
server/src/modules/sop/ai-review/sop-ai-review.repository.ts
server/src/modules/sop/ai-review/sop-ai-review.repository.spec.ts
server/src/modules/sop/ai-review/sop-ai-review.schema.ts
server/src/modules/sop/ai-review/sop-ai-review.schema.spec.ts
server/src/modules/sop/ai-review/sop-ai-review.service.ts
server/src/modules/sop/ai-review/sop-ai-review.service.spec.ts
server/src/modules/sop/ai-review/sop-ai-review.types.ts
```

Server modify:

```text
server/src/app.module.ts
server/src/config/env.validation.ts
server/src/config/env.validation.spec.ts
compose.yml
.env.production.example
scripts/production-contract.sh
.github/workflows/ci.yml
```

Client create:

```text
client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts
client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx
client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx
client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx
client/e2e/journeys/ai-sop-quality-review.spec.ts
```

Client modify:

```text
client/src/api/workspace-sops.ts
client/src/pages/penyusun/sop/hooks/use-sop-header-autosave.ts
client/src/pages/penyusun/sop/hooks/use-sop-prosedur-autosave.ts
client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts
client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopProsedurEditor.tsx
client/playwright.config.ts
```

Iteration final-gate modify:

```text
.agents/CURRENT_ITERATION.md
.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md
```

---

### Task 1: Review Domain Types and Snapshot-Aware Canonicalization

**Files:**
- Create: `server/src/modules/sop/ai-review/sop-ai-review.types.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.schema.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.schema.spec.ts`

**Interfaces:**
- Produces: `SopQualityReviewSnapshot`, `SopQualityReviewProviderInput`, `SopQualityFindingLocation`, `SopQualityFinding`, `SopQualityReviewResult`, `parseAndCanonicalizeAiReview(raw, snapshot)`.

- [ ] **Step 1: Write failing canonicalization tests**

Use a snapshot containing two actors and two steps. Cover: valid output, trim, duplicate collapse, >30 findings, invalid status/severity/category/location, invalid step order, invalid actor name, empty/oversize strings.

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
      langkahSopId: 'step-db-1', urutan: 1, kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR', kelengkapan: 'Formulir', keluaran: 'Permohonan diterima',
      waktu: 5, satuanWaktu: 'm', keterangan: 'Catat', actorName: 'Petugas',
      targetYaUrutan: null, targetTidakUrutan: null,
    },
    {
      langkahSopId: 'step-db-2', urutan: 2, kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEPUTUSAN', kelengkapan: 'Permohonan diterima', keluaran: 'Hasil verifikasi',
      waktu: 10, satuanWaktu: 'm', keterangan: 'Tentukan kelengkapan', actorName: 'Verifikator',
      targetYaUrutan: 1, targetTidakUrutan: 1,
    },
  ],
};

expect(parseAndCanonicalizeAiReview({
  status: 'PERLU_PERBAIKAN',
  summary: '  Ada routing yang perlu diperiksa.  ',
  findings: [{
    severity: 'ERROR',
    category: 'DECISION_ROUTING',
    location: { kind: 'STEP', stepOrder: 2 },
    title: '  Routing keputusan tidak jelas  ',
    explanation: ' Jalur Ya dan Tidak mengarah ke langkah yang sama. ',
    recommendation: ' Bedakan tujuan kedua cabang keputusan. ',
  }],
}, snapshot)).toEqual({
  status: 'PERLU_PERBAIKAN',
  summary: 'Ada routing yang perlu diperiksa.',
  findings: [expect.objectContaining({ title: 'Routing keputusan tidak jelas' })],
});
```

Invalid location must fail:

```ts
expect(() => parseAndCanonicalizeAiReview({
  status: 'CUKUP_BAIK',
  summary: 'Review menemukan satu hal yang harus dicek.',
  findings: [{
    severity: 'WARNING', category: 'CLARITY',
    location: { kind: 'STEP', stepOrder: 99 },
    title: 'Langkah tidak ditemukan',
    explanation: 'Finding menunjuk langkah yang tidak ada pada snapshot.',
    recommendation: 'Gunakan langkah yang benar pada snapshot.',
  }],
}, snapshot)).toThrow();
```

- [ ] **Step 2: Verify RED**

```bash
cd server
pnpm test --runInBand sop-ai-review.schema.spec.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement exact types**

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

Internal `SopQualityReviewSnapshot` contains `detailSopId`, `pelaksanaId`, and `langkahSopId`. Provider-safe `SopQualityReviewProviderInput` repeats the human-readable fields but contains none of those IDs.

- [ ] **Step 4: Implement strict schema/canonicalization**

Use Zod with exact enums, finding max 30, `summary` 10..1500, `title` 3..160, `explanation` 10..1000, `recommendation` 3..1000. Validate STEP order against `snapshot.steps`; normalize ACTOR matching with existing `normalizeActorName()` and validate against `snapshot.actors`.

Deduplicate after trim with:

```ts
function locationKey(location: SopQualityFindingLocation): string {
  if (location.kind === 'STEP') return `STEP:${location.stepOrder}`;
  if (location.kind === 'ACTOR') return `ACTOR:${normalizeActorName(location.actorName)}`;
  return location.kind;
}

function findingKey(finding: SopQualityFinding): string {
  return [
    finding.severity,
    finding.category,
    locationKey(finding.location),
    finding.title.toLocaleLowerCase('id-ID'),
  ].join('|');
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
cd server
pnpm test --runInBand sop-ai-review.schema.spec.ts
pnpm typecheck
git add src/modules/sop/ai-review/sop-ai-review.types.ts \
        src/modules/sop/ai-review/sop-ai-review.schema.ts \
        src/modules/sop/ai-review/sop-ai-review.schema.spec.ts
git commit -m "feat: define AI SOP quality review contract"
```

---

### Task 2: Read-Only Authoritative Review Repository

**Files:**
- Create: `server/src/modules/sop/ai-review/sop-ai-review.repository.ts`
- Create: `server/src/modules/sop/ai-review/sop-ai-review.repository.spec.ts`

**Interfaces:**
- Consumes: `SopQualityReviewSnapshot`.
- Produces: `findReviewContext(detailSopId): Promise<{ ownerId: string; status: StatusSOP; snapshot: SopQualityReviewSnapshot } | null>`.

- [ ] **Step 1: Write failing repository tests**

Mock one `detailSOP.findUnique` result containing `sop.workspace.ownerId`, lampiran arrays, ordered swimlanes/pelaksana, and ordered langkah/pelaksana with internal next-step IDs. Assert exact mapped snapshot and that no mutation methods are called.

```ts
await expect(repository.findReviewContext('detail-1')).resolves.toEqual({
  ownerId: 'user-1',
  status: 'DRAFT',
  snapshot: expect.objectContaining({
    detailSopId: 'detail-1',
    versi: 1,
    actors: [expect.objectContaining({ pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 })],
    steps: [expect.objectContaining({ langkahSopId: 'step-db-1', urutan: 1, actorName: 'Petugas' })],
  }),
});
expect(prisma.$transaction).not.toHaveBeenCalled();
```

- [ ] **Step 2: Verify RED**

```bash
cd server
pnpm test --runInBand sop-ai-review.repository.spec.ts
```

- [ ] **Step 3: Implement the single read query and concrete mapping**

Build `targetOrderById` first:

```ts
const targetOrderById = new Map(row.langkahSOP.map((step) => [step.langkahSopId, step.urutan]));
```

Map actors:

```ts
const actors = [...row.swimlanes]
  .sort((a, b) => a.urutan - b.urutan)
  .filter((lane) => lane.pelaksana !== null)
  .map((lane) => ({
    pelaksanaId: lane.pelaksanaId,
    name: lane.pelaksana!.namaPelaksana,
    order: lane.urutan,
  }));
```

Map steps:

```ts
const steps = [...row.langkahSOP]
  .sort((a, b) => a.urutan - b.urutan)
  .map((step) => ({
    langkahSopId: step.langkahSopId,
    urutan: step.urutan,
    kegiatan: step.kegiatan,
    jenis: step.jenis,
    kelengkapan: step.kelengkapan ?? '',
    keluaran: step.keluaran ?? '',
    waktu: step.waktu ?? 0,
    satuanWaktu: step.satuanWaktu ?? 'm',
    keterangan: step.keterangan ?? '',
    actorName: step.pelaksana?.namaPelaksana ?? '',
    targetYaUrutan: step.langkahSelanjutnyaYaId
      ? (targetOrderById.get(step.langkahSelanjutnyaYaId) ?? null)
      : null,
    targetTidakUrutan: step.langkahSelanjutnyaTidakId
      ? (targetOrderById.get(step.langkahSelanjutnyaTidakId) ?? null)
      : null,
  }));
```

If actual generated Prisma field names differ, use the existing `LangkahSOP` field names revealed by typecheck and existing repository/mappers; do not add new schema fields.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd server
pnpm test --runInBand sop-ai-review.repository.spec.ts
pnpm typecheck
git add src/modules/sop/ai-review/sop-ai-review.repository.ts \
        src/modules/sop/ai-review/sop-ai-review.repository.spec.ts
git commit -m "feat: load authoritative SOP review snapshot"
```

---

### Task 3: Provider Contract, Service Trust Boundary, and Authenticated API

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
- Produces: `AI_REVIEW_PROVIDER`, `AiReviewProvider.review(input)`, `availability()`, `review(user, detailSopId)`, `GET /sop/ai-reviews/availability`, `POST /sop/:detailSopId/ai-review`.

- [ ] **Step 1: Write failing service trust-boundary tests**

```ts
it('rejects disabled provider before loading content', async () => {
  config.get.mockReturnValue('disabled');
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 503 });
  expect(repository.findReviewContext).not.toHaveBeenCalled();
});

it('rejects non-owner before provider invocation', async () => {
  repository.findReviewContext.mockResolvedValue({ ownerId: 'other-user', status: 'DRAFT', snapshot });
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 403 });
  expect(provider.review).not.toHaveBeenCalled();
});

it('rejects completed SOP before provider invocation', async () => {
  repository.findReviewContext.mockResolvedValue({ ownerId: user.sub, status: 'COMPLETED', snapshot });
  await expect(service.review(user, 'detail-1')).rejects.toMatchObject({ status: 409 });
  expect(provider.review).not.toHaveBeenCalled();
});
```

Privacy assertion:

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

- [ ] **Step 3: Implement provider interface and deterministic providers**

```ts
export const AI_REVIEW_PROVIDER = Symbol('AI_REVIEW_PROVIDER');
export interface AiReviewProvider {
  review(input: SopQualityReviewProviderInput): Promise<unknown>;
}
```

`DisabledAiReviewProvider.review()` throws `ServiceUnavailableException('AI review belum tersedia')`.

`FakeAiReviewProvider.review(input)` chooses a valid supplied step and returns exactly one valid finding:

```ts
const target = input.steps.find((step) => step.jenis === 'KEPUTUSAN') ?? input.steps[0];
return target
  ? {
      status: 'CUKUP_BAIK',
      summary: 'Struktur utama dapat dipahami, tetapi beberapa bagian masih perlu ditinjau manusia.',
      findings: [{
        severity: 'WARNING', category: 'CLARITY',
        location: { kind: 'STEP', stepOrder: target.urutan },
        title: 'Perjelas kriteria pelaksanaan',
        explanation: 'Langkah ini masih dapat ditafsirkan berbeda oleh pelaksana.',
        recommendation: 'Gunakan kata kerja operasional dan kriteria hasil yang lebih spesifik.',
      }],
    }
  : {
      status: 'PERLU_PERBAIKAN',
      summary: 'Draft belum memiliki langkah operasional yang dapat dinilai secara memadai.',
      findings: [{
        severity: 'WARNING', category: 'COMPLETENESS', location: { kind: 'HEADER' },
        title: 'Lengkapi prosedur',
        explanation: 'Draft belum memiliki langkah yang dapat direview secara operasional.',
        recommendation: 'Tambahkan langkah prosedur sebelum melakukan review ulang.',
      }],
    };
```

- [ ] **Step 4: Implement exact provider-safe mapping and service sequence**

```ts
function toProviderSafeInput(snapshot: SopQualityReviewSnapshot): SopQualityReviewProviderInput {
  return {
    versi: snapshot.versi,
    judul: snapshot.judul,
    nomorSop: snapshot.nomorSop,
    namaLembaga: snapshot.namaLembaga,
    peringatan: snapshot.peringatan,
    kualifikasiPelaksanaan: snapshot.kualifikasiPelaksanaan,
    peralatanPerlengkapan: snapshot.peralatanPerlengkapan,
    pencatatanPendataan: snapshot.pencatatanPendataan,
    actors: snapshot.actors.map(({ name, order }) => ({ name, order })),
    steps: snapshot.steps.map(({ langkahSopId: _stepId, ...step }) => step),
  };
}
```

Do not include `pelaksanaId` in actors; construct actors explicitly rather than spreading internal actor objects.

Service sequence:

```ts
if (this.providerMode() === 'disabled') throw new ServiceUnavailableException('AI review belum tersedia');
const context = await this.repository.findReviewContext(detailSopId);
if (context === null) throw new NotFoundException('SOP tidak ditemukan');
if (context.ownerId !== user.sub) throw new ForbiddenException('Akses ditolak');
if (context.status !== StatusSOP.DRAFT) throw new ConflictException('Hanya SOP draft yang dapat direview');
const raw = await this.provider.review(toProviderSafeInput(context.snapshot));
const result = parseAndCanonicalizeAiReview(raw, context.snapshot);
return {
  reviewedDetailSopId: context.snapshot.detailSopId,
  reviewedVersion: context.snapshot.versi,
  result,
};
```

Map parse/canonicalization failure to `UnprocessableEntityException('Hasil review AI tidak dapat digunakan. Jalankan review ulang.')` and never include raw payload.

- [ ] **Step 5: Implement authenticated controller/module**

```ts
@ApiTags('SOP AI Reviews')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopAiReviewController {
  constructor(private readonly service: SopAiReviewService) {}

  @Get('sop/ai-reviews/availability')
  availability(): ApiSuccessResponse<{ enabled: boolean }> {
    return { message: 'Status AI review berhasil diambil', success: true, data: this.service.availability() };
  }

  @Post('sop/:detailSopId/ai-review')
  @HttpCode(200)
  async review(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId') detailSopId: string,
  ): Promise<ApiSuccessResponse<SopQualityReviewResponse>> {
    return {
      message: 'Review kualitas SOP berhasil dibuat',
      success: true,
      data: await this.service.review(req.user, detailSopId),
    };
  }
}
```

Add `SopAiReviewModule` to `AppModule`. Keep the review repository/service independent from SOP mutation services.

- [ ] **Step 6: Verify GREEN and commit**

```bash
cd server
pnpm test --runInBand sop-ai-review.service.spec.ts sop-ai-review.schema.spec.ts sop-ai-review.repository.spec.ts
pnpm typecheck
pnpm build
git add src/modules/sop/ai-review src/app.module.ts
git commit -m "feat: add AI SOP review service boundary"
```

---

### Task 4: Production OpenAI Review Adapter and Runtime Safety

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
- Produces OpenAI review provider selected by `AI_REVIEW_PROVIDER` and isolated timeout `AI_REVIEW_TIMEOUT_MS`.

- [ ] **Step 1: Add RED env tests**

```ts
expect(validateEnv(baseEnv)).toMatchObject({
  AI_REVIEW_PROVIDER: 'disabled',
  AI_REVIEW_TIMEOUT_MS: 30000,
});
expect(() => validateEnv({ ...baseEnv, AI_REVIEW_TIMEOUT_MS: '4999' })).toThrow(/AI_REVIEW_TIMEOUT_MS/);
expect(() => validateEnv({ ...baseEnv, AI_REVIEW_TIMEOUT_MS: '60001' })).toThrow(/AI_REVIEW_TIMEOUT_MS/);
expect(() => validateEnv({ ...baseEnv, AI_REVIEW_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
expect(() => validateEnv({
  ...baseEnv,
  NODE_ENV: 'production',
  PUBLIC_APP_ORIGIN: 'https://sop.example.test',
  ALLOWED_ORIGINS: 'https://sop.example.test',
  AI_REVIEW_PROVIDER: 'fake',
})).toThrow(/AI_REVIEW_PROVIDER/);
```

```bash
cd server
pnpm test --runInBand env.validation.spec.ts
```

Expected: RED.

- [ ] **Step 2: Implement env rules**

```ts
AI_REVIEW_PROVIDER: z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.enum(['disabled', 'openai', 'fake']).default('disabled'),
),
AI_REVIEW_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(30000),
```

Require `OPENAI_API_KEY` and `OPENAI_MODEL` when either AI provider is `openai`. Reject `AI_REVIEW_PROVIDER=fake` in production independently from the existing draft rule.

- [ ] **Step 3: Write RED OpenAI transport tests**

Assert URL `https://api.openai.com/v1/responses`, Authorization header, review timeout signal, model, `store:false`, no `tools`, strict format name `sop_quality_review`, and no application IDs in serialized input. Also test 429 -> sanitized 429; HTTP/network/timeout -> sanitized 503; incomplete/refusal/empty/invalid JSON -> 422.

```ts
await makeProvider().review(providerInput);
const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
expect(body.store).toBe(false);
expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'sop_quality_review', strict: true });
expect(body).not.toHaveProperty('tools');
expect(JSON.stringify(body.input)).not.toMatch(/detail-1|actor-db|step-db|user-/);
expect(body.instructions).toContain('kepatuhan hukum');
```

- [ ] **Step 4: Implement native-fetch Responses adapter**

Do not add OpenAI SDK. Request body:

```ts
{
  model,
  store: false,
  instructions: REVIEW_INSTRUCTIONS,
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] }],
  text: {
    format: {
      type: 'json_schema',
      name: 'sop_quality_review',
      strict: true,
      schema: SOP_QUALITY_REVIEW_JSON_SCHEMA,
    },
  },
}
```

JSON schema bounds all enums, location variants, max 30 findings, and text lengths. Return parsed JSON as `unknown`; Task 1 remains final application validation.

- [ ] **Step 5: Wire module provider factory**

```ts
const mode = config.get<string>('AI_REVIEW_PROVIDER') ?? 'disabled';
if (mode === 'fake') return fake;
if (mode === 'openai') return openai;
return disabled;
```

- [ ] **Step 6: Add production config contract**

`compose.yml`:

```yaml
AI_REVIEW_PROVIDER: ${AI_REVIEW_PROVIDER:-disabled}
AI_REVIEW_TIMEOUT_MS: ${AI_REVIEW_TIMEOUT_MS:-30000}
```

`.env.production.example` documents both review vars, with review disabled by default.

`production-contract.sh` adds:

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

- [ ] **Step 7: Verify GREEN and commit**

```bash
cd server
pnpm test --runInBand env.validation.spec.ts openai-ai-review.provider.spec.ts
pnpm typecheck
pnpm build
cd ..
PRODUCTION_ENV_FILE=.env.production.example bash scripts/production-contract.sh
git add server/src/modules/sop/ai-review/providers \
        server/src/modules/sop/ai-review/sop-ai-review.module.ts \
        server/src/config/env.validation.ts server/src/config/env.validation.spec.ts \
        compose.yml .env.production.example scripts/production-contract.sh
git commit -m "feat: add production AI review provider"
```

---

### Task 5: Autosave Result Contract and Client Review Hook

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Modify: `client/src/pages/penyusun/sop/hooks/use-sop-header-autosave.ts`
- Modify: `client/src/pages/penyusun/sop/hooks/use-sop-prosedur-autosave.ts`
- Modify: `client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts`
- Create: `client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx`

**Interfaces:**
- Changes both autosave `flush()` contracts from `Promise<void>` to backward-compatible `Promise<boolean>`; callers that ignore the resolved value continue to work.
- Produces: `flushAllAutosave(): Promise<boolean>`, review API methods/types, `useAiSopQualityReview()`.

- [ ] **Step 1: Change autosave save-result internals with focused RED/GREEN tests**

For both header and procedure hooks, make `performSave()` and `flush()` return `true` when there is no pending diff or save succeeds, and `false` when the existing caught save error path runs. Keep existing `lastError/status` behavior unchanged.

Required implementation shape:

```ts
const performSave = useCallback(async (): Promise<boolean> => {
  if (!enabled || !detailSopId) return true;
  const diff = buildDiff();
  if (!hasAnyKey(diff)) return true;
  const targetSnapshot = latestSnapshotRef.current;
  clearSavedTimer();
  setStatus('saving');
  const promise = saveRef.current(diff)
    .then(() => {
      baselineRef.current = targetSnapshot;
      setLastError(null);
      setStatus('saved');
      scheduleSavedFlash();
      return true;
    })
    .catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setLastError(error);
      setStatus('error');
      return false;
    });
  return promise;
}, [clearSavedTimer, detailSopId, enabled, scheduleSavedFlash]);
```

Update `inFlightRef` to `Promise<boolean> | null`. `flush()`:

```ts
const flush = useCallback(async (): Promise<boolean> => {
  cancelTimer();
  if (inFlightRef.current) {
    const inFlightSucceeded = await inFlightRef.current;
    if (!inFlightSucceeded) return false;
  }
  return performSave();
}, [cancelTimer, performSave]);
```

Add hook-level regression coverage if existing test harness supports renderHook. At minimum the new AI-review hook tests in Step 4 must prove `false` stops the API call, while full existing client tests protect current autosave behavior.

- [ ] **Step 2: Add exact client API types/methods**

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

export interface SopQualityFinding {
  severity: SopQualityFindingSeverity;
  category: 'PROCESS_STRUCTURE' | 'ACTOR_RESPONSIBILITY' | 'INPUT_OUTPUT' |
    'DECISION_ROUTING' | 'CLARITY' | 'SUPPORTING_FIELD' | 'TIME_PLAUSIBILITY' | 'COMPLETENESS';
  location: SopQualityFindingLocation;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface SopQualityReviewResponse {
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: { status: SopQualityReviewStatus; summary: string; findings: SopQualityFinding[] };
}
```

Methods:

```ts
aiReviewAvailability: () =>
  apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>('/sop/ai-reviews/availability'),
reviewAiSop: (detailSopId: string) =>
  apiClient.post<ApiSuccessResponse<SopQualityReviewResponse>>(
    `/sop/${encodeURIComponent(detailSopId)}/ai-review`,
    {},
  ),
```

- [ ] **Step 3: Expose aggregate boolean autosave gate**

In `use-detail-sop-penyusun.ts`:

```ts
const flushAllAutosave = useCallback(async (): Promise<boolean> => {
  const [headerSaved, prosedurSaved] = await Promise.all([
    headerAutosave.flush(),
    prosedurAutosave.flush(),
  ]);
  return headerSaved && prosedurSaved;
}, [headerAutosave.flush, prosedurAutosave.flush]);
```

Existing Complete/retry may continue to await and ignore the boolean in this iteration so lifecycle semantics are not broadened. AI review must consume the boolean.

- [ ] **Step 4: Write RED `useAiSopQualityReview` tests**

Hook contract:

```ts
useAiSopQualityReview({
  detailSopId: 'detail-1',
  isReadOnly: false,
  flushAllAutosave,
  contentFingerprint: 'fingerprint-a',
});
```

Required tests:

```ts
flushAllAutosave.mockResolvedValue(true);
await act(async () => result.current.runReview());
expect(flushAllAutosave).toHaveBeenCalledTimes(1);
expect(reviewAiSop).toHaveBeenCalledWith('detail-1');
```

Failure gate:

```ts
flushAllAutosave.mockResolvedValue(false);
await act(async () => result.current.runReview());
expect(reviewAiSop).not.toHaveBeenCalled();
expect(result.current.error?.message).toMatch(/simpan/i);
```

Also test disabled/read-only no call, successful result storage, fingerprint change clears result, rerun replaces previous result, and no review-history array.

- [ ] **Step 5: Verify RED**

```bash
cd client
pnpm test -- use-ai-sop-quality-review.spec.tsx
```

- [ ] **Step 6: Implement transient hook**

Review sequence:

```ts
const saved = await flushAllAutosave();
if (!saved) {
  setError(new Error('Perubahan SOP belum berhasil disimpan. Simpan ulang sebelum menjalankan AI review.'));
  return;
}
const response = await workspaceSopApi.reviewAiSop(detailSopId);
reviewedFingerprintRef.current = contentFingerprint;
setReview(response.data);
```

Clear after local edit:

```ts
useEffect(() => {
  if (reviewedFingerprintRef.current === null) return;
  if (reviewedFingerprintRef.current !== contentFingerprint) {
    reviewedFingerprintRef.current = null;
    setReview(null);
  }
}, [contentFingerprint]);
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
cd client
pnpm test -- use-ai-sop-quality-review.spec.tsx
pnpm typecheck
git add src/api/workspace-sops.ts \
        src/pages/penyusun/sop/hooks/use-sop-header-autosave.ts \
        src/pages/penyusun/sop/hooks/use-sop-prosedur-autosave.ts \
        src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts \
        src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts \
        src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx
git commit -m "feat: gate AI review on persisted autosave"
```

---

### Task 6: AI Review Tab, Findings UI, and Deterministic Navigation

**Files:**
- Create: `client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx`
- Create: `client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopProsedurEditor.tsx`

**Interfaces:**
- Side panel owns `activeTab`; parent only receives `onNavigateStep(stepOrder)` from the review tab path.
- Non-STEP finding action switches side-panel local state to `edit`.
- STEP finding calls parent navigation, which opens step editing and scrolls to `data-sop-step-order`.

- [ ] **Step 1: Write RED panel tests**

```tsx
expect(screen.getByRole('button', { name: 'Periksa dengan AI' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'Periksa dengan AI' }));
expect(onReview).toHaveBeenCalledTimes(1);
expect(screen.getByText('Perlu perbaikan')).toBeInTheDocument();
expect(screen.getByText('Routing keputusan tidak jelas')).toBeInTheDocument();
expect(screen.getByText(/AI.*ditinjau manusia/i)).toBeInTheDocument();
```

For STEP action:

```ts
await user.click(screen.getByRole('button', { name: /lihat langkah 2/i }));
expect(onNavigateFinding).toHaveBeenCalledWith({ kind: 'STEP', stepOrder: 2 });
```

Disabled copy: `AI review belum tersedia. Editor SOP tetap dapat digunakan seperti biasa.`

- [ ] **Step 2: Verify RED**

```bash
cd client
pnpm test -- AiSopQualityReviewPanel.spec.tsx
```

- [ ] **Step 3: Implement panel states**

States: disabled, ready, loading `Memeriksa SOP...`, safe error + `Coba lagi`, result summary + findings grouped by severity. Status labels:

```ts
const STATUS_LABEL: Record<SopQualityReviewStatus, string> = {
  PERLU_PERBAIKAN: 'Perlu perbaikan',
  CUKUP_BAIK: 'Cukup baik',
  SIAP_DIREVIEW: 'Siap direview manusia',
};
```

No numeric score and no approval/compliance copy.

- [ ] **Step 4: Add local `ai-review` tab to side panel**

```ts
type TabId = 'edit' | 'ai-review' | 'versi' | 'aktivitas';
```

When `!isReadOnly`, tabs are Edit, AI Review, Versi, Aktivitas. For completed/archived, omit AI Review.

Pass these explicit props from parent:

```ts
aiReviewEnabled: boolean;
aiReviewLoading: boolean;
aiReviewError: Error | null;
aiReview: SopQualityReviewResponse | null;
onRunAiReview: () => Promise<void>;
onNavigateAiStep: (stepOrder: number) => void;
```

Side-panel finding handler is exact:

```ts
const handleNavigateFinding = (location: SopQualityFindingLocation) => {
  if (location.kind === 'STEP') {
    onNavigateAiStep(location.stepOrder);
    return;
  }
  setActiveTab('edit');
};
```

- [ ] **Step 5: Build local staleness fingerprint and review hook in parent**

```ts
const reviewContentFingerprint = useMemo(
  () => JSON.stringify({ metadata, implementers, prosedurRows }),
  [metadata, implementers, prosedurRows],
);
const aiReview = useAiSopQualityReview({
  detailSopId: sopDetailId,
  isReadOnly,
  flushAllAutosave,
  contentFingerprint: reviewContentFingerprint,
});
```

Fingerprint is client transient-state logic only and is never sent to backend/provider.

- [ ] **Step 6: Implement STEP navigation**

Wrap each rendered procedure row with:

```tsx
<div data-sop-step-order={row.urutan}>{rowContent}</div>
```

Parent navigation:

```ts
const handleNavigateAiStep = (stepOrder: number) => {
  setIsEditingSteps(true);
  window.requestAnimationFrame(() => {
    document
      .querySelector(`[data-sop-step-order="${stepOrder}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};
```

Do not add field-specific DOM selectors for header/lampiran in Iteration 5; non-step finding returns user to Edit tab and retains the finding text as guidance.

- [ ] **Step 7: Verify GREEN and commit**

```bash
cd client
pnpm test -- AiSopQualityReviewPanel.spec.tsx use-ai-sop-quality-review.spec.tsx
pnpm typecheck
pnpm build
git add src/pages/penyusun/sop/detail src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts
git commit -m "feat: show AI quality review in SOP editor"
```

---

### Task 7: Genuine RED Acceptance and Mandatory CI Fake Provider

**Files:**
- Create: `client/e2e/journeys/ai-sop-quality-review.spec.ts`
- Modify: `client/playwright.config.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces end-to-end proof of persisted review, no mutation, stale-result clearing, rerun, diagram/lifecycle regression.

- [ ] **Step 1: Add test file to `testMatch` before enabling fake review**

```ts
testMatch: [
  'journeys/mvp-vertical-slice.spec.ts',
  'journeys/ai-assisted-draft.spec.ts',
  'journeys/ai-sop-quality-review.spec.ts',
],
```

Do not add `AI_REVIEW_PROVIDER=fake` yet.

- [ ] **Step 2: Write the acceptance journey**

Required actions/assertions:

```text
create workspace and actor
create editable DRAFT
enter at least 3 steps including one decision
wait until autosave shows Tersimpan
open AI Review tab
RED phase: review is unavailable while provider disabled
GREEN phase: click Periksa dengan AI
see advisory warning and finding tied to an existing step
verify an SOP input value is identical before and immediately after review
click STEP finding and verify step editor/target row becomes visible
edit target step and verify prior review disappears
wait autosave, run review again, see new transient result
render BPMN and Flowchart
complete SOP and verify AI Review action is absent in immutable state
create new version and verify v2 is editable and AI Review is available again
```

No direct API mutation setup for the reviewed SOP; use normal UI authoring path.

- [ ] **Step 3: Run genuine RED**

```bash
cd client
pnpm test:e2e
```

Expected: new quality-review journey fails specifically because review provider is disabled; existing active journeys stay green. Record the actual run/SHA during execution.

- [ ] **Step 4: Enable fake review only in E2E**

Add E2E job env:

```yaml
AI_REVIEW_PROVIDER: fake
AI_REVIEW_TIMEOUT_MS: "30000"
```

Production Compose CI temporary env must contain:

```text
AI_REVIEW_PROVIDER=disabled
AI_REVIEW_TIMEOUT_MS=30000
```

- [ ] **Step 5: Run GREEN acceptance and commit**

```bash
cd client
pnpm test:e2e
git add e2e/journeys/ai-sop-quality-review.spec.ts playwright.config.ts ../.github/workflows/ci.yml
git commit -m "test: cover AI SOP quality review lifecycle"
```

Expected: all mandatory journeys pass, including the new quality-review journey.

---

### Task 8: Full Regression, Security Review, and REVIEW_READY Gate

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Modify: `.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md`
- Update: PR #7 on the same branch.

**Interfaces:**
- Produces final verified Iteration 5 `REVIEW_READY`; final merge still requires explicit user approval because the iteration extends the external AI/provider credential surface.

- [ ] **Step 1: Full server verification**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```

- [ ] **Step 2: Full client verification**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 3: Full Playwright acceptance**

```bash
cd client
pnpm test:e2e
```

- [ ] **Step 4: Production contract**

```bash
PRODUCTION_ENV_FILE=.env.production.example bash scripts/production-contract.sh
```

Mandatory GitHub `production-compose` must still build images, deploy migrations twice, seed exact templates, prove DB/PDF persistence, readiness, backup retention, and restore with AI draft/review disabled by default.

- [ ] **Step 5: Focused final trust-boundary audit**

Verify each item in final diff:

```text
JwtAuthGuard protects both review endpoints
owner/status checks occur before provider invocation
provider input has no application IDs/user profile/audit logs
review repository contains no application mutation
review service does not call SOP mutation services
review result never gates Complete
no Prisma schema or migration change
fake review provider rejected in production validation
Compose defaults review disabled
OpenAI credential/model remain backend-only
Responses request has store:false and no tools/retrieval
raw provider body/error is not exposed/logged
failed autosave returns false and prevents review API call
post-review local edit clears transient result
```

- [ ] **Step 6: Wait for mandatory GitHub Actions on final code head**

Required:

```text
server: success
client: success
e2e: success
production-compose: success
```

Do not reuse an older SHA as completion evidence.

- [ ] **Step 7: Update iteration/PR evidence**

Set:

```text
Iteration: 5-ai-sop-quality-review
Status: REVIEW_READY
Working branch: feat/ai-sop-quality-review
Pull request: #7
```

Record actual genuine RED run, GREEN code-bearing run, final head CI, no-migration confirmation, security audit, and unresolved review-thread status. Update PR #7 body from planning to implementation summary. Keep same PR.

- [ ] **Step 8: Mark PR ready after verification and stop at merge gate**

Mark PR ready for review if connector permits. Do not auto-merge: external provider/credential handling is security-sensitive under repository workflow. Final squash merge uses explicit user approval plus expected head SHA.

---

## Acceptance Checklist

- [ ] Authenticated availability endpoint leaks no provider/key/model detail.
- [ ] Review endpoint accepts no SOP document body as authority.
- [ ] Non-owner and non-DRAFT are rejected before provider call.
- [ ] Provider-safe input contains no application/user/workspace IDs.
- [ ] Invalid provider step/actor references yield safe `422`.
- [ ] Review repository performs no mutation.
- [ ] Both autosave `flush()` methods report success/failure without breaking existing callers.
- [ ] Failed autosave prevents review API call.
- [ ] Successful review never changes SOP values.
- [ ] Local edit clears transient review; rerun replaces it.
- [ ] STEP finding opens/scrolls to corresponding procedural row.
- [ ] Non-STEP finding returns user to Edit tab without fake field targeting.
- [ ] UI shows no numeric score or compliance/approval claim.
- [ ] AI disabled/failure does not block ordinary editor lifecycle.
- [ ] Blank/template/AI-assisted regression journeys remain green.
- [ ] Flowchart/BPMN, Complete, immutability, and Create New Version remain green.
- [ ] Production defaults `AI_REVIEW_PROVIDER=disabled` and rejects fake in production.
- [ ] No Prisma schema/migration change exists.
- [ ] All four mandatory CI jobs are green on final head.
