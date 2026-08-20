# AI-Assisted SOP Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, transient AI revision flow that turns one eligible AI Review finding into one user-approved textual change in the existing SOP editor, with no direct AI database write path.

**Architecture:** Extract Iteration 5's authoritative read-only SOP snapshot loader into an internal `ai-common` boundary shared by AI Review and AI Revision. The new `ai-revision` server module validates finding eligibility, strips database identifiers before provider invocation, accepts one strict provider proposal, derives `before` from the persisted snapshot, and returns a transient suggestion. The client requests suggestions only after autosave succeeds, displays before/after, rejects stale responses/applies, and writes accepted text only into existing React editor state so existing autosave remains the sole persistence path.

**Tech Stack:** NestJS, TypeScript, Prisma/MySQL, class-validator, Zod-style application validation, Node 22 native `fetch`, OpenAI Responses API Structured Outputs, React, Vitest/Testing Library, Jest, Playwright, GitHub Actions.

**Spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`

## Global Constraints

- Work only on branch `feat/ai-assisted-revision` and existing PR #8; never write feature commits directly to `master`.
- Status/lifecycle remains `DRAFT | COMPLETED | ARCHIVED`; AI Revision is available only for editable `DRAFT` owned by the authenticated user.
- Exactly one textual target may be proposed per request.
- Allowed targets are only SOP title, one existing `peringatan` item, or one existing step's `kegiatan`, `kelengkapan`, `keluaran`, or `keterangan`.
- Never add/delete/reorder steps or warning items, change actors/swimlanes, decision routing, step type, timing, SOP number, organization identity, regulations, related SOPs, lifecycle state, or versioning behavior.
- There is no revision `/apply` endpoint. Apply modifies existing client editor state; existing header/procedure autosave performs persistence.
- Browser-supplied finding and provider output are untrusted. The persisted server snapshot determines ownership/status, canonical target, allowed targets, and `before`.
- Provider-safe input contains no `detailSopId`, user/workspace/SOP DB IDs, actor IDs, internal step IDs, email, token/cookie, audit log, API key, official SOP number, or organization identity.
- `PERINGATAN.itemIndex` is zero-based. `STEP.stepOrder` is one-based human-visible order.
- Revision output limits: title `1..500`, peringatan item `1..2000`, step kegiatan/kelengkapan/keluaran/keterangan `1..2000`, rationale `1..1000` after trimming.
- `AI_REVISION_PROVIDER=disabled|openai|fake`, default `disabled`.
- `AI_REVISION_TIMEOUT_MS` range is `5000..60000`, default `30000`.
- `openai` uses existing server-side `OPENAI_API_KEY` and `OPENAI_MODEL`; `fake` is rejected in production.
- OpenAI requests use Node 22 native `fetch`, `store:false`, strict JSON Schema Structured Outputs, no tools, no web/file retrieval, bounded timeout, and sanitized failures.
- No AI revision persistence/history/chat/job/background queue and no Prisma schema/migration change.
- Existing AI Draft, AI Review, editor/autosave, Flowchart, BPMN, PDF/print, Complete immutability, and Create New Version behavior must remain regression-green.

---

### Task 1: Extract the shared authoritative AI snapshot boundary without changing AI Review behavior

**Files:**
- Create: `server/src/modules/sop/ai-common/sop-ai-snapshot.types.ts`
- Create: `server/src/modules/sop/ai-common/sop-ai-snapshot.repository.ts`
- Create: `server/src/modules/sop/ai-common/sop-ai-snapshot.repository.spec.ts`
- Modify: `server/src/modules/sop/ai-review/sop-ai-review.types.ts`
- Modify: `server/src/modules/sop/ai-review/sop-ai-review.service.ts`
- Modify: `server/src/modules/sop/ai-review/sop-ai-review.module.ts`
- Modify: `server/src/modules/sop/ai-review/sop-ai-review.service.spec.ts`
- Delete after GREEN: `server/src/modules/sop/ai-review/sop-ai-review.repository.ts`
- Delete after GREEN: `server/src/modules/sop/ai-review/sop-ai-review.repository.spec.ts`

**Interfaces:**

```ts
export type SopProcedureStepKind = 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN'
export type SopProcedureTimeUnit = 'm' | 'h' | 'd' | 'w' | 'mo' | 'y'

export interface SopAiSnapshotActor {
  pelaksanaId: string
  name: string
  order: number
}

export interface SopAiSnapshotStep {
  langkahSopId: string
  urutan: number
  kegiatan: string
  jenis: SopProcedureStepKind
  kelengkapan: string
  keluaran: string
  waktu: number
  satuanWaktu: SopProcedureTimeUnit
  keterangan: string
  actorName: string
  targetYaUrutan: number | null
  targetTidakUrutan: number | null
}

export interface SopAiSnapshot {
  detailSopId: string
  versi: number
  judul: string
  nomorSop: string
  namaLembaga: string
  peringatan: string[]
  kualifikasiPelaksanaan: string[]
  peralatanPerlengkapan: string[]
  pencatatanPendataan: string[]
  actors: SopAiSnapshotActor[]
  steps: SopAiSnapshotStep[]
}

export interface SopAiSnapshotContext {
  ownerId: string
  status: StatusSOP
  snapshot: SopAiSnapshot
}

export class SopAiSnapshotRepository {
  findContext(detailSopId: string): Promise<SopAiSnapshotContext | null>
}
```

`server/src/modules/sop/ai-review/sop-ai-review.types.ts` imports/re-exports the shared primitive/snapshot types so current review provider/schema imports keep one source of truth.

- [ ] **Step 1: Write the failing shared-repository test before moving production code**

Create the same Prisma fixture used by the current review repository test and assert:

```ts
expect(prisma.detailSOP.findUnique).toHaveBeenCalledWith({
  where: { detailSopId: 'detail-1' },
  include: expect.objectContaining({
    sop: { include: { workspace: true } },
    lampiranPeringatan: { orderBy: { createdAt: 'asc' } },
    lampiranKualifikasiPelaksanaan: { orderBy: { createdAt: 'asc' } },
    lampiranPeralatanPerlengkapan: { orderBy: { createdAt: 'asc' } },
    lampiranPencatatanPendataan: { orderBy: { createdAt: 'asc' } },
    swimlanes: expect.objectContaining({ orderBy: { urutan: 'asc' } }),
    langkahSOP: expect.objectContaining({ orderBy: { urutan: 'asc' } }),
  }),
})
expect(result?.ownerId).toBe('owner-1')
expect(result?.snapshot.detailSopId).toBe('detail-1')
expect(result?.snapshot.steps[0].targetYaUrutan).toBe(3)
expect(result?.snapshot.steps[0].targetTidakUrutan).toBe(2)
```

Also assert `null` when Prisma returns `null`.

- [ ] **Step 2: Run the new test and verify RED**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-common/sop-ai-snapshot.repository.spec.ts
```

Expected: FAIL because the shared repository/types do not exist.

- [ ] **Step 3: Implement the shared read-only repository**

Move the current `SopAiReviewRepository.findReviewContext()` query/mapping into `SopAiSnapshotRepository.findContext()` unchanged except names. Do not add `create`, `update`, `delete`, or a mutating `$transaction` method.

- [ ] **Step 4: Rewire AI Review to the shared repository**

Use:

```ts
constructor(
  private readonly repository: SopAiSnapshotRepository,
  @Inject(AI_REVIEW_PROVIDER) private readonly provider: AiReviewProvider,
  private readonly config: ConfigService,
) {}

const context = await this.repository.findContext(detailSopId)
```

Register `SopAiSnapshotRepository` in `SopAiReviewModule`. Preserve existing owner/status/provider-safe stripping behavior and HTTP response exactly.

- [ ] **Step 5: Run focused review regressions**

```bash
cd server
pnpm test --runInBand \
  src/modules/sop/ai-common/sop-ai-snapshot.repository.spec.ts \
  src/modules/sop/ai-review/sop-ai-review.service.spec.ts \
  src/modules/sop/ai-review/sop-ai-review.schema.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Delete the obsolete review-specific repository**

Delete `sop-ai-review.repository.ts` and `sop-ai-review.repository.spec.ts`. Repository search for `SopAiReviewRepository` must return zero references.

- [ ] **Step 7: Run the server gate**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/modules/sop/ai-common server/src/modules/sop/ai-review
git commit -m "refactor: share authoritative SOP AI snapshot"
```

---

### Task 2: Define revision targets, finding eligibility, and snapshot-aware proposal validation

**Files:**
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.types.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.schema.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.schema.spec.ts`
- Create: `server/src/modules/sop/ai-revision/dto/suggest-ai-revision.dto.ts`

**Interfaces:**

```ts
export type SopAiRevisionTarget =
  | { kind: 'HEADER'; field: 'JUDUL' }
  | { kind: 'PERINGATAN'; itemIndex: number }
  | {
      kind: 'STEP'
      stepOrder: number
      field: 'KEGIATAN' | 'KELENGKAPAN' | 'KELUARAN' | 'KETERANGAN'
    }

export interface AiRevisionProviderResult {
  target: SopAiRevisionTarget
  after: string
  rationale: string
}

export interface SopAiRevisionSuggestion {
  target: SopAiRevisionTarget
  before: string
  after: string
  rationale: string
}

export function deriveAllowedRevisionTargets(
  finding: SopQualityFinding,
  snapshot: SopAiSnapshot,
): SopAiRevisionTarget[]

export function readRevisionTargetValue(
  target: SopAiRevisionTarget,
  snapshot: SopAiSnapshot,
): string

export function parseAndCanonicalizeAiRevision(
  raw: unknown,
  finding: SopQualityFinding,
  snapshot: SopAiSnapshot,
): SopAiRevisionSuggestion

export function revisionTargetKey(target: SopAiRevisionTarget): string
```

- [ ] **Step 1: Write table-driven RED tests for every eligibility mapping**

Required exact examples:

```ts
expect(deriveAllowedRevisionTargets(
  finding({ location: { kind: 'HEADER' }, category: 'CLARITY' }),
  snapshot,
)).toEqual([{ kind: 'HEADER', field: 'JUDUL' }])

expect(deriveAllowedRevisionTargets(
  finding({ location: { kind: 'STEP', stepOrder: 2 }, category: 'INPUT_OUTPUT' }),
  snapshot,
)).toEqual([
  { kind: 'STEP', stepOrder: 2, field: 'KELENGKAPAN' },
  { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
])

expect(deriveAllowedRevisionTargets(
  finding({ location: { kind: 'ACTOR', actorName: 'Verifikator' }, category: 'CLARITY' }),
  snapshot,
)).toEqual([])

expect(deriveAllowedRevisionTargets(
  finding({ location: { kind: 'STEP', stepOrder: 1 }, category: 'DECISION_ROUTING' }),
  snapshot,
)).toEqual([])
```

Also cover:
- `PERINGATAN + CLARITY/SUPPORTING_FIELD/COMPLETENESS` with at least one warning -> one target per existing warning item;
- empty warning list -> no target;
- `STEP + CLARITY` -> `KEGIATAN`, `KETERANGAN`;
- `STEP + COMPLETENESS` -> all four step text targets;
- `STEP + SUPPORTING_FIELD` -> `KETERANGAN`;
- `PROCESS_STRUCTURE`, `ACTOR_RESPONSIBILITY`, `DECISION_ROUTING`, `TIME_PLAUSIBILITY` -> no target.

- [ ] **Step 2: Write RED validation/canonicalization tests**

Assert:
- invalid target discriminator/field is rejected;
- `itemIndex < 0`, non-existing warning index, `stepOrder < 1`, non-existing step order are rejected;
- structurally valid target outside the derived allowlist is rejected;
- provider cannot supply/override `before`;
- trimmed empty `after` is rejected;
- normalized no-op (`after.trim() === before.trim()`) is rejected;
- title after > 500 is rejected;
- warning/step after > 2000 is rejected;
- rationale > 1000 is rejected;
- `revisionTargetKey()` returns `HEADER:JUDUL`, `PERINGATAN:0`, `STEP:2:KELUARAN` deterministically.

- [ ] **Step 3: Run schema tests and verify RED**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-revision/sop-ai-revision.schema.spec.ts
```

Expected: FAIL because revision domain code does not exist.

- [ ] **Step 4: Implement explicit allowlist and target readers**

`readRevisionTargetValue()` must use an exhaustive switch, never generic object indexing:

```ts
if (target.kind === 'HEADER') return snapshot.judul
if (target.kind === 'PERINGATAN') return snapshot.peringatan[target.itemIndex]
const step = snapshot.steps.find((item) => item.urutan === target.stepOrder)
if (!step) throw new Error('invalid revision target')
switch (target.field) {
  case 'KEGIATAN': return step.kegiatan
  case 'KELENGKAPAN': return step.kelengkapan
  case 'KELUARAN': return step.keluaran
  case 'KETERANGAN': return step.keterangan
}
```

- [ ] **Step 5: Implement browser finding DTO**

`SuggestAiRevisionDto` contains only a nested `finding`. Validate severity/category/location enums and bounded strings: title `3..160`, explanation `10..1000`, recommendation `3..1000`. Do not declare a client target field.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-revision/sop-ai-revision.schema.spec.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/modules/sop/ai-revision
git commit -m "feat: define AI revision proposal contract"
```

---

### Task 3: Add the authenticated read-only revision API and deterministic non-production providers

**Files:**
- Create: `server/src/modules/sop/ai-revision/providers/ai-revision-provider.ts`
- Create: `server/src/modules/sop/ai-revision/providers/disabled-ai-revision.provider.ts`
- Create: `server/src/modules/sop/ai-revision/providers/fake-ai-revision.provider.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.service.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.service.spec.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.controller.ts`
- Create: `server/src/modules/sop/ai-revision/sop-ai-revision.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**

```ts
export const AI_REVISION_PROVIDER = Symbol('AI_REVISION_PROVIDER')

export interface SopAiRevisionProviderInput {
  versi: number
  judul: string
  peringatan: string[]
  actors: Array<{ name: string; order: number }>
  steps: Array<{
    urutan: number
    kegiatan: string
    jenis: SopProcedureStepKind
    kelengkapan: string
    keluaran: string
    waktu: number
    satuanWaktu: SopProcedureTimeUnit
    keterangan: string
    actorName: string
    targetYaUrutan: number | null
    targetTidakUrutan: number | null
  }>
  finding: SopQualityFinding
  allowedTargets: SopAiRevisionTarget[]
}

export interface AiRevisionProvider {
  suggest(input: SopAiRevisionProviderInput): Promise<unknown>
}

export interface SuggestAiRevisionResponse {
  sourceDetailSopId: string
  sourceVersion: number
  suggestion: SopAiRevisionSuggestion
}
```

- [ ] **Step 1: Write service RED tests for the trust-boundary sequence**

Prove all ten cases:
1. disabled provider -> 503 before repository read;
2. missing detail -> 404 and provider not called;
3. owner mismatch -> 403 and provider not called;
4. `COMPLETED` and `ARCHIVED` -> 409 and provider not called;
5. non-eligible finding -> 422 and provider not called;
6. eligible finding -> provider called once;
7. provider input omits `detailSopId`, `ownerId`, `nomorSop`, `namaLembaga`, actor IDs, internal step IDs;
8. provider receives exactly the derived `allowedTargets`;
9. invalid provider output -> safe 422;
10. success returns `sourceDetailSopId`, source version, canonical `before`, `after`, rationale.

Use this no-ID assertion:

```ts
const providerInput = provider.suggest.mock.calls[0][0]
expect(JSON.stringify(providerInput)).not.toContain('detail-1')
expect(JSON.stringify(providerInput)).not.toContain('actor-db-id')
expect(JSON.stringify(providerInput)).not.toContain('step-db-id')
expect(providerInput).not.toHaveProperty('nomorSop')
expect(providerInput).not.toHaveProperty('namaLembaga')
```

- [ ] **Step 2: Run service test and verify RED**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-revision/sop-ai-revision.service.spec.ts
```

Expected: FAIL because service/providers do not exist.

- [ ] **Step 3: Implement provider interface, disabled provider, and deterministic fake provider**

Fake provider selects `input.allowedTargets[0]` and returns a target-specific non-no-op `after` value plus rationale. If `allowedTargets` is empty, throw an internal test-provider error; production service must prevent that call.

- [ ] **Step 4: Implement service in exact order**

```ts
if (this.providerMode() === 'disabled') {
  throw new ServiceUnavailableException('AI revision belum tersedia')
}
const context = await this.repository.findContext(detailSopId)
if (context === null) throw new NotFoundException('SOP tidak ditemukan')
if (context.ownerId !== user.sub) throw new ForbiddenException('Akses SOP ditolak')
if (context.status !== StatusSOP.DRAFT) {
  throw new ConflictException('AI revision hanya tersedia untuk SOP draft')
}
const allowedTargets = deriveAllowedRevisionTargets(finding, context.snapshot)
if (allowedTargets.length === 0) {
  throw new UnprocessableEntityException('Finding ini perlu diperbaiki secara manual')
}
const raw = await this.provider.suggest(
  this.toProviderInput(context.snapshot, finding, allowedTargets),
)
const suggestion = parseAndCanonicalizeAiRevision(raw, finding, context.snapshot)
return {
  sourceDetailSopId: context.snapshot.detailSopId,
  sourceVersion: context.snapshot.versi,
  suggestion,
}
```

`toProviderInput()` explicitly maps fields and strips IDs/protected identity.

- [ ] **Step 5: Add authenticated controller endpoints**

```ts
@Get('ai-revisions/availability')
availability(): ApiSuccessResponse<{ enabled: boolean }>

@Post(':detailSopId/ai-revisions/suggest')
@HttpCode(200)
async suggest(
  @Req() req: Request & { user: JwtAccessPayload },
  @Param('detailSopId') detailSopId: string,
  @Body() body: SuggestAiRevisionDto,
): Promise<ApiSuccessResponse<SuggestAiRevisionResponse>>
```

Use `JwtAuthGuard` and `ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)`. No revision write/apply route is created.

- [ ] **Step 6: Register `SopAiRevisionModule` in `AppModule`**

Place it alongside `SopAiDraftModule` and `SopAiReviewModule`.

- [ ] **Step 7: Run server gate**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-revision/sop-ai-revision.service.spec.ts
pnpm typecheck
pnpm test --runInBand
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/modules/sop/ai-revision server/src/app.module.ts
git commit -m "feat: add read-only AI SOP revision API"
```

---

### Task 4: Add independent revision runtime config and production OpenAI transport

**Files:**
- Create: `server/src/modules/sop/ai-revision/providers/openai-ai-revision.provider.ts`
- Create: `server/src/modules/sop/ai-revision/providers/openai-ai-revision.provider.spec.ts`
- Modify: `server/src/modules/sop/ai-revision/sop-ai-revision.module.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/env.validation.spec.ts`
- Modify: `.env.production.example`
- Modify: `compose.yml`
- Modify: `scripts/production-contract.sh`

**Interfaces:**

```ts
export class OpenAiRevisionProvider implements AiRevisionProvider {
  suggest(input: SopAiRevisionProviderInput): Promise<unknown>
}
```

- [ ] **Step 1: Write RED environment tests**

Add these assertions:

```ts
expect(validateEnv(baseEnv).AI_REVISION_PROVIDER).toBe('disabled')
expect(validateEnv(baseEnv).AI_REVISION_TIMEOUT_MS).toBe(30000)
```

Also assert validation failure for timeout `4999`, timeout `60001`, production `AI_REVISION_PROVIDER=fake`, and `AI_REVISION_PROVIDER=openai` without `OPENAI_API_KEY` or without `OPENAI_MODEL`.

- [ ] **Step 2: Run env tests and verify RED**

```bash
cd server
pnpm test --runInBand src/config/env.validation.spec.ts
```

Expected: new revision assertions FAIL.

- [ ] **Step 3: Implement revision environment validation**

Add:

```ts
AI_REVISION_PROVIDER: aiProviderSchema,
AI_REVISION_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(30000),
```

Extend `usesOpenAi` to include revision mode. Add production fake rejection on `AI_REVISION_PROVIDER`.

- [ ] **Step 4: Write RED OpenAI transport tests**

Mock `global.fetch` and assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  'https://api.openai.com/v1/responses',
  expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
  }),
)
const body = JSON.parse(fetch.mock.calls[0][1]!.body as string)
expect(body.model).toBe('test-model')
expect(body.store).toBe(false)
expect(body.tools).toBeUndefined()
expect(body.text.format.type).toBe('json_schema')
expect(body.text.format.strict).toBe(true)
```

Also test: 429 -> sanitized 429 application error; abort/network -> 503; refusal/malformed structured output -> 422; thrown messages contain neither `test-key` nor raw upstream response body.

- [ ] **Step 5: Implement `OpenAiRevisionProvider`**

Use native Node 22 `fetch`, `AbortController`, existing `OPENAI_API_KEY`, existing `OPENAI_MODEL`, revision timeout, `store:false`, strict JSON schema for exactly `{ target, after, rationale }`, and no `tools` property. System instructions explicitly state that SOP/finding text is untrusted data and must not override system constraints.

- [ ] **Step 6: Wire runtime provider selection**

```ts
const mode = config.get<string>('AI_REVISION_PROVIDER') ?? 'disabled'
if (mode === 'fake') return fake
if (mode === 'openai') return openai
return disabled
```

- [ ] **Step 7: Update production env/Compose/contract**

Add to `.env.production.example` and backend Compose environment:

```text
AI_REVISION_PROVIDER=disabled
AI_REVISION_TIMEOUT_MS=30000
```

Add exact production-contract assertions parallel to AI Review:

```bash
grep -q 'AI_REVISION_PROVIDER: disabled' <<<"$backend_block" || exit 1
! grep -q 'AI_REVISION_PROVIDER: fake' <<<"$backend_block" || exit 1
```

- [ ] **Step 8: Run runtime and production-contract gate**

```bash
cd server
pnpm test --runInBand \
  src/config/env.validation.spec.ts \
  src/modules/sop/ai-revision/providers/openai-ai-revision.provider.spec.ts
pnpm typecheck
pnpm build
cd ..
bash scripts/production-contract.sh
```

Expected: PASS using `.env.production.example` as the script default.

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/sop/ai-revision server/src/config .env.production.example compose.yml scripts/production-contract.sh
git commit -m "feat: add AI revision provider runtime"
```

---

### Task 5: Add typed client API and stale-safe transient revision request state

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Create: `client/src/pages/penyusun/sop/hooks/use-ai-sop-revision.ts`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision-concurrency.spec.tsx`

**Interfaces:**

```ts
export type SopAiRevisionTarget =
  | { kind: 'HEADER'; field: 'JUDUL' }
  | { kind: 'PERINGATAN'; itemIndex: number }
  | {
      kind: 'STEP'
      stepOrder: number
      field: 'KEGIATAN' | 'KELENGKAPAN' | 'KELUARAN' | 'KETERANGAN'
    }

export interface SopAiRevisionResponse {
  sourceDetailSopId: string
  sourceVersion: number
  suggestion: {
    target: SopAiRevisionTarget
    before: string
    after: string
    rationale: string
  }
}
```

API implementations are exactly:

```ts
aiRevisionAvailability: () =>
  apiClient.get<ApiSuccessResponse<{ enabled: boolean }>>('/sop/ai-revisions/availability'),

suggestAiRevision: (detailSopId: string, finding: SopQualityFinding) =>
  apiClient.post<ApiSuccessResponse<SopAiRevisionResponse>>(
    `/sop/${encodeURIComponent(detailSopId)}/ai-revisions/suggest`,
    { finding },
  ),
```

Hook contract:

```ts
export interface UseAiSopRevisionOptions {
  detailSopId: string
  isReadOnly: boolean
  flushAllAutosave: () => Promise<boolean>
  contentFingerprint: string
  reviewFingerprint: string | null
}

export interface UseAiSopRevisionResult {
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  selectedFinding: SopQualityFinding | null
  proposal: SopAiRevisionResponse | null
  error: Error | null
  suggest: (finding: SopQualityFinding) => Promise<void>
  cancel: () => void
  clear: () => void
  setLocalError: (message: string) => void
}
```

- [ ] **Step 1: Write RED hook tests**

Cover availability enabled/disabled, read-only guard, duplicate-running guard, `flushAllAutosave()` before API, flush `false` preventing API, success proposal state, API error state, `cancel()` clearing proposal/selected finding without editor mutation, and content/review fingerprint changes clearing proposal/error.

- [ ] **Step 2: Write RED concurrency tests with deferred promises**

Prove all four stale cases:
- content fingerprint changes while request is in-flight;
- `detailSopId` changes;
- review fingerprint changes;
- request B starts after request A, then A resolves last and cannot replace B.

- [ ] **Step 3: Run hook tests and verify RED**

```bash
cd client
pnpm test --run \
  src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx \
  src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision-concurrency.spec.tsx
```

Expected: FAIL because API/hook does not exist.

- [ ] **Step 4: Implement API and hook**

The browser request body is exactly `{ finding }`; it does not send target or SOP body. Capture requested detail ID, content fingerprint, review fingerprint, and incrementing request sequence before the network call. Accept response only when all guards still match.

`setLocalError(message)` creates a local `Error(message)` without performing network or persistence, used by stale apply checks in Task 7.

- [ ] **Step 5: Run client focused gate**

```bash
cd client
pnpm test --run \
  src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx \
  src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision-concurrency.spec.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/workspace-sops.ts client/src/pages/penyusun/sop/hooks
git commit -m "feat: add transient AI revision client state"
```

---

### Task 6: Add a pure client apply boundary that preserves current autosave field precedence

**Files:**
- Create: `client/src/pages/penyusun/sop/detail/ai-sop-revision-apply.ts`
- Create: `client/src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts`

**Interfaces:**

```ts
export interface AiRevisionEditorState {
  metadata: SOPDetailMetadata
  prosedurRows: ProsedurRow[]
}

export type ApplyAiRevisionResult =
  | { ok: true; metadata: SOPDetailMetadata; prosedurRows: ProsedurRow[] }
  | { ok: false; reason: 'STALE_TARGET' | 'TARGET_NOT_FOUND' }

export function applyAiRevisionToEditor(
  state: AiRevisionEditorState,
  suggestion: SopAiRevisionResponse['suggestion'],
): ApplyAiRevisionResult
```

- [ ] **Step 1: Write RED tests for every target and stale guard**

Assert:
- `HEADER/JUDUL` compares current canonical `(metadata.judul ?? metadata.nama ?? '').trim()` to `before`, then updates `metadata.judul`;
- `PERINGATAN` converts `metadata.warning` to an array, checks existing zero-based index, compares that item to `before`, then replaces only that item;
- `STEP/KEGIATAN` finds `row.urutan === stepOrder` and updates `row.kegiatan`;
- `STEP/KETERANGAN` updates `row.keterangan`;
- `STEP/KELENGKAPAN` compares `pickNonEmptyTrimmed(row.mutu_kelengkapan, row.kelengkapan) ?? ''` and updates both `mutu_kelengkapan` and `kelengkapan` to `after`;
- `STEP/KELUARAN` compares `pickNonEmptyTrimmed(row.output, row.keluaran) ?? ''` and updates both `output` and `keluaran` to `after`;
- current value mismatch returns `STALE_TARGET` with original object values unchanged;
- missing warning index or step returns `TARGET_NOT_FOUND`;
- unrelated `id`, pelaksana, waktu, satuanWaktu, `type`, `id_next_step_if_yes`, `id_next_step_if_no` remain identical.

- [ ] **Step 2: Run apply test and verify RED**

```bash
cd client
pnpm test --run src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement immutable apply helper**

Define local helpers inside `ai-sop-revision-apply.ts`:

```ts
function toTextArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return [...value]
  if (typeof value === 'string' && value.trim().length > 0) return [value]
  return []
}

function pickNonEmptyTrimmed(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim()
    if (trimmed.length > 0) return trimmed
  }
  return ''
}
```

Never call an API, setter, toast, or autosave from this helper.

- [ ] **Step 4: Run apply + existing autosave regressions**

```bash
cd client
pnpm test --run \
  src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts \
  src/pages/penyusun/sop/hooks/__tests__/sop-autosave-flush-result.spec.tsx \
  src/pages/penyusun/sop/hooks/__tests__/use-sop-prosedur-autosave.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/penyusun/sop/detail/ai-sop-revision-apply.ts \
  client/src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts
git commit -m "feat: apply AI revisions through existing editor state"
```

---

### Task 7: Extend AI Review UI with eligible revision actions, preview, explicit apply, and manual-only messaging

**Files:**
- Modify: `client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx`
- Create: `client/src/pages/penyusun/sop/detail/__tests__/DetailSOPPenyusun.ai-revision.spec.tsx`

**Interfaces:**

Extend the panel props with:

```ts
aiRevision: {
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  selectedFinding: SopQualityFinding | null
  proposal: SopAiRevisionResponse | null
  error: Error | null
  onSuggest: (finding: SopQualityFinding) => void | Promise<void>
  onCancel: () => void
  onApply: () => void
}
```

Export a client display predicate with the same conservative eligibility surface:

```ts
export function isAiRevisionEligibleFinding(finding: SopQualityFinding): boolean
```

It returns true only for `HEADER+CLARITY`, `PERINGATAN+(CLARITY|SUPPORTING_FIELD|COMPLETENESS)`, and `STEP+(CLARITY|INPUT_OUTPUT|COMPLETENESS|SUPPORTING_FIELD)`. Server validation remains authoritative.

- [ ] **Step 1: Write RED panel tests**

Assert:
- eligible finding shows `Sarankan Perbaikan` when revision availability is enabled;
- `DECISION_ROUTING`, `TIME_PLAUSIBILITY`, and actor-located findings show `Perbaiki secara manual` and no revision button;
- running state prevents duplicate suggestion clicks;
- successful proposal shows target label such as `Langkah 3 · Output`, plus `Sebelum`, `Usulan`, rationale, `Batal`, `Terapkan`;
- `Batal` calls only cancel;
- revision provider disabled leaves existing review finding/navigation visible;
- existing `Buka <finding>` navigation callback remains intact.

- [ ] **Step 2: Write RED page integration tests**

Mock `useDetailSopPenyusun`, AI Review API/hook boundary, and AI Revision API/hook boundary enough to prove:
- explicit Apply updates editor metadata/rows only after button click;
- stale `sourceDetailSopId` refuses apply and sets local revision error;
- stale `before` refuses apply and does not change metadata/rows;
- successful apply calls `aiReview.clearReview()` and clears revision proposal;
- completed/read-only page does not expose AI revision action.

- [ ] **Step 3: Run UI tests and verify RED**

```bash
cd client
pnpm test --run \
  src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx \
  src/pages/penyusun/sop/detail/__tests__/DetailSOPPenyusun.ai-revision.spec.tsx
```

Expected: new revision assertions FAIL.

- [ ] **Step 4: Wire revision hook into `DetailSOPPenyusun`**

Compute:

```ts
const reviewFingerprint = useMemo(
  () => (aiReview.review ? JSON.stringify(aiReview.review.result) : null),
  [aiReview.review],
)
```

Instantiate `useAiSopRevision` with `sopDetailId`, `isReadOnly`, `flushAllAutosave`, current `contentFingerprint`, and `reviewFingerprint`.

- [ ] **Step 5: Implement explicit Apply orchestration**

On `Terapkan`:

```ts
const proposal = aiRevision.proposal
if (!proposal) return
if (proposal.sourceDetailSopId !== sopDetailId) {
  aiRevision.clear()
  aiRevision.setLocalError('Usulan AI sudah tidak sesuai dengan SOP yang sedang dibuka.')
  return
}
const result = applyAiRevisionToEditor({ metadata, prosedurRows }, proposal.suggestion)
if (!result.ok) {
  aiRevision.clear()
  aiRevision.setLocalError('Isi SOP sudah berubah. Jalankan saran perbaikan AI kembali.')
  return
}
setMetadata(result.metadata)
setProsedurRows(result.prosedurRows)
aiRevision.clear()
aiReview.clearReview()
```

Do not call any revision write endpoint. Existing state change triggers existing autosave.

- [ ] **Step 6: Render preview/manual messaging without breaking finding navigation**

Keep each finding's existing open/navigation action. Add the revision action as a separate control, not as a replacement for navigation.

- [ ] **Step 7: Run the full client gate**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/penyusun/sop/detail client/src/pages/penyusun/sop/hooks client/src/api/workspace-sops.ts
git commit -m "feat: add AI revision preview and explicit apply UI"
```

---

### Task 8: Add deterministic E2E acceptance and CI provider isolation

**Files:**
- Create: `client/e2e/journeys/ai-assisted-revision.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `server/src/modules/sop/ai-revision/providers/fake-ai-revision.provider.ts`

**Interfaces:**

E2E runtime adds:

```yaml
AI_REVISION_PROVIDER: fake
AI_REVISION_TIMEOUT_MS: "30000"
```

Production-compose runtime adds:

```text
AI_REVISION_PROVIDER=disabled
AI_REVISION_TIMEOUT_MS=30000
```

- [ ] **Step 1: Write the acceptance journey and push a test-only RED commit before enabling fake revision**

The journey executes this exact behavior:

```text
login
-> create/open DRAFT
-> edit one step output to weak text
-> wait until existing autosave reports saved
-> run AI Review
-> select the deterministic eligible INPUT_OUTPUT finding
-> click Sarankan Perbaikan
-> verify before/after preview
-> verify editor value is still the old value before Apply
-> click Terapkan
-> verify editor value changes
-> wait until existing autosave reports saved
-> create a fresh page in the same authenticated BrowserContext
-> reopen the SOP
-> verify revised value persisted
-> run AI Review again
-> verify previous revision proposal is absent
-> request another revision proposal
-> press Batal
-> create another fresh page and verify canceled proposed text was not persisted
-> verify Flowchart and BPMN still render
-> Complete SOP
-> verify AI Review/Revision editing actions are absent
-> Create New Version
-> verify the new DRAFT can run review/revision again
```

Push this test-only commit while `.github/workflows/ci.yml` still has no `AI_REVISION_PROVIDER`. Expected PR CI RED: the new revision journey fails because revision availability is disabled; the four existing journeys remain PASS.

- [ ] **Step 2: Enable fake revision only in E2E CI**

Add to `e2e.env`:

```yaml
AI_REVISION_PROVIDER: fake
AI_REVISION_TIMEOUT_MS: "30000"
```

Add to the disposable production env block:

```text
AI_REVISION_PROVIDER=disabled
AI_REVISION_TIMEOUT_MS=30000
```

Do not enable fake revision in `server`, `client`, or `production-compose` runtime.

- [ ] **Step 3: Make fake provider deterministic**

For every eligible request, return `input.allowedTargets[0]`. Produce target-specific recognizable text:
- `JUDUL`: `Prosedur yang telah diperjelas oleh AI`
- `PERINGATAN`: `Pastikan dokumen pendukung telah diverifikasi sebelum proses dilanjutkan.`
- `KEGIATAN`: `Memeriksa kelengkapan dokumen permohonan sesuai kebutuhan proses.`
- `KELENGKAPAN`: `Dokumen permohonan dan data pendukung yang lengkap.`
- `KELUARAN`: `Dokumen permohonan yang telah diverifikasi.`
- `KETERANGAN`: `Dilanjutkan setelah hasil pemeriksaan dinyatakan lengkap.`

Use rationale `Usulan memperjelas isi tanpa mengubah struktur proses.`

- [ ] **Step 4: Run the exact E2E command used by CI**

With the same server/MySQL environment already started by CI, run:

```bash
pnpm --dir client test:e2e
```

Expected: all five journeys PASS with one worker and no retry/flaky label.

- [ ] **Step 5: Run PR CI and inspect the Playwright log**

Require all four jobs to pass: `server`, `client`, `e2e`, `production-compose`. Inspect E2E job logs and require the summary to show all journeys passed without retry/flaky output.

- [ ] **Step 6: Commit GREEN CI configuration/provider fixture**

```bash
git add .github/workflows/ci.yml \
  client/e2e/journeys/ai-assisted-revision.spec.ts \
  server/src/modules/sop/ai-revision/providers/fake-ai-revision.provider.ts
git commit -m "test: cover AI-assisted SOP revision lifecycle"
```

---

### Task 9: Final security/regression audit, iteration state, and review-ready PR gate

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Update GitHub PR #8 metadata after code verification.
- Do not modify `server/prisma/schema.prisma` or any `server/prisma/migrations/**` file.

**Interfaces:**
- Final Iteration 6 status: `REVIEW_READY`.
- PR #8 is the only Iteration 6 PR.
- Final integration requires explicit user merge approval.

- [ ] **Step 1: Run full server verification**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Run full client verification**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```

Expected: PASS.

- [ ] **Step 3: Run production contract**

From repository root:

```bash
bash scripts/production-contract.sh
```

Expected: `production compose contract: ok`.

- [ ] **Step 4: Require final mandatory PR CI on the final code-bearing head**

Require:
- `server`: success;
- `client`: success;
- `e2e`: success;
- `production-compose`: success.

Inspect E2E logs and record the exact passed journey count, durations, and absence of retry/flaky status.

- [ ] **Step 5: Perform the focused static audit**

Use repository diff/search to prove:
- no Prisma schema/migration change;
- no revision `/apply` endpoint;
- no `create`, `update`, `delete`, or mutating `$transaction` in `server/src/modules/sop/ai-revision/**`;
- provider input does not contain `detailSopId`, DB IDs, SOP number, organization identity, token/cookie, or audit logs;
- no prompt/API-key/full-provider-response logging;
- OpenAI request has no `tools`, web/file retrieval, or RAG;
- `AI_REVISION_PROVIDER=fake` fails production environment validation;
- AI Draft and AI Review provider settings remain independent;
- shared snapshot refactor preserves AI Review tests;
- completed SOP stays immutable;
- client apply helper changes only the selected textual field/compatibility alias pair and no actor/routing/timing/structure field.

- [ ] **Step 6: Check PR blockers**

List PR #8 review threads and submitted reviews. Require zero unresolved threads and zero blocking reviews before marking ready.

- [ ] **Step 7: Update `.agents/CURRENT_ITERATION.md`**

Record:
- Iteration `6-ai-assisted-revision`;
- status `REVIEW_READY`;
- branch `feat/ai-assisted-revision`;
- PR `#8`;
- final code-bearing head SHA;
- final CI run number and four job conclusions;
- real RED/GREEN evidence for Tasks 1-8;
- Iteration 5 merged as `8881d1888599ff1413fd6a454d2a1ba1ca844811`;
- explicit merge approval requirement because the external AI provider/credential boundary is extended;
- `Do not start Iteration 7 automatically.`

- [ ] **Step 8: Update PR #8 metadata**

Set title:

```text
feat: add AI-assisted SOP revision
```

Replace body with sections: Product behavior, Trust/privacy boundary, Runtime, Explicit non-goals, TDD/verification evidence, Final gate. Mark PR ready for review only after final CI is green.

- [ ] **Step 9: Stop before merge**

Do not squash-merge PR #8 until the user explicitly authorizes final merge.
