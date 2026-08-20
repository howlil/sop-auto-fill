# AI-Assisted SOP Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, transient AI revision flow that turns one eligible AI Review finding into one user-approved textual change in the existing SOP editor, with no direct AI database write path.

**Architecture:** Extract Iteration 5's authoritative read-only SOP snapshot loader into an internal `ai-common` boundary shared by AI Review and AI Revision. The new `ai-revision` server module validates finding eligibility, strips database identifiers before provider invocation, accepts one strict provider proposal, derives `before` from the persisted snapshot, and returns a transient suggestion. The client requests suggestions only after autosave succeeds, displays before/after, rejects stale responses/applies, and writes accepted text only into existing React editor state so existing autosave remains the sole persistence path.

**Tech Stack:** NestJS, TypeScript, Prisma/MySQL, Zod, Node 22 native `fetch`, OpenAI Responses API Structured Outputs, React, TanStack client stack, Vitest/Testing Library, Jest, Playwright, GitHub Actions.

**Spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`

## Global Constraints

- Work only on branch `feat/ai-assisted-revision` and existing PR #8; never write feature commits directly to `master`.
- Status/lifecycle remains `DRAFT | COMPLETED | ARCHIVED`; AI Revision is available only for editable `DRAFT` owned by the authenticated user.
- Exactly one textual target may be proposed per request.
- Allowed targets are only SOP title, one existing `peringatan` item, or one existing step's `kegiatan`, `kelengkapan`, `keluaran`, or `keterangan`.
- Never add/delete/reorder steps or warning items, change actors/swimlanes, decision routing, step type, timing, SOP number, organization identity, regulations, related SOPs, lifecycle state, or versioning behavior.
- There is no revision `/apply` endpoint. Apply modifies existing client editor state; existing header/procedure autosave performs persistence.
- Browser-supplied finding and provider output are untrusted. Server-authoritative persisted snapshot determines ownership/status, allowed targets, canonical target, and `before`.
- Provider-safe input contains no `detailSopId`, user/workspace/SOP DB IDs, actor IDs, internal step IDs, email, token/cookie, audit log, API key, official SOP number, or organization identity.
- `peringatan.itemIndex` is zero-based. `STEP.stepOrder` is one-based human-visible order.
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
- Produces:
  ```ts
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
- AI Review keeps its public/provider types, but aliases or imports the shared snapshot type rather than owning a second DB snapshot shape.

- [ ] **Step 1: Write the failing shared-repository test before moving production code**

Create `sop-ai-snapshot.repository.spec.ts` using the same Prisma fixture shape as the existing review repository test. Assert the exact read-only query and mapping:

```ts
expect(prisma.detailSOP.findUnique).toHaveBeenCalledWith({
  where: { detailSopId: 'detail-1' },
  include: expect.objectContaining({
    sop: { include: { workspace: true } },
    lampiranPeringatan: { orderBy: { createdAt: 'asc' } },
    swimlanes: expect.objectContaining({ orderBy: { urutan: 'asc' } }),
    langkahSOP: expect.objectContaining({ orderBy: { urutan: 'asc' } }),
  }),
})
expect(result?.ownerId).toBe('owner-1')
expect(result?.snapshot.steps[0].targetYaUrutan).toBe(3)
expect(result?.snapshot.steps[0].targetTidakUrutan).toBe(2)
```

Also assert `null` when Prisma returns `null`.

- [ ] **Step 2: Run the new test and verify RED**

Run:
```bash
cd server
pnpm test --runInBand src/modules/sop/ai-common/sop-ai-snapshot.repository.spec.ts
```
Expected: FAIL because `SopAiSnapshotRepository` and shared types do not exist.

- [ ] **Step 3: Move the existing read-only query/mapping into `ai-common`**

Implement `SopAiSnapshotRepository.findContext()` by moving the current `SopAiReviewRepository.findReviewContext()` query and mapping unchanged except names. Do not add write methods or `$transaction` mutation.

- [ ] **Step 4: Rewire AI Review to the shared repository**

Update `SopAiReviewService` constructor and call site:

```ts
constructor(
  private readonly repository: SopAiSnapshotRepository,
  @Inject(AI_REVIEW_PROVIDER) private readonly provider: AiReviewProvider,
  private readonly config: ConfigService,
) {}

const context = await this.repository.findContext(detailSopId)
```

Update `SopAiReviewModule` provider list to register `SopAiSnapshotRepository`. Keep the same owner/status/provider-safe stripping behavior and same HTTP contract.

- [ ] **Step 5: Run focused shared-repository + AI Review regressions**

Run:
```bash
cd server
pnpm test --runInBand \
  src/modules/sop/ai-common/sop-ai-snapshot.repository.spec.ts \
  src/modules/sop/ai-review/sop-ai-review.service.spec.ts \
  src/modules/sop/ai-review/sop-ai-review.schema.spec.ts
```
Expected: PASS.

- [ ] **Step 6: Delete the old review-specific repository only after tests are GREEN**

Remove `sop-ai-review.repository.ts` and its repository spec. Search for `SopAiReviewRepository`; expected result: zero production references.

- [ ] **Step 7: Run server typecheck/test/build**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```
Expected: all PASS.

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
- Consumes `SopAiSnapshot` from Task 1 and `SopQualityFinding` from AI Review types.
- Produces:
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

- [ ] **Step 1: Write table-driven RED tests for eligibility**

Include at least these exact cases:

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

Cover all mappings from the design spec, including `PERINGATAN` with empty warnings returning no target.

- [ ] **Step 2: Write RED tests for raw provider validation and canonicalization**

Assert:
- invalid target discriminator/field is rejected;
- non-existing `itemIndex` or `stepOrder` is rejected;
- a structurally valid target outside the finding-derived allowlist is rejected;
- `before` is read from snapshot, never accepted from provider;
- trimmed empty `after` is rejected;
- normalized no-op (`after.trim() === before.trim()`) is rejected;
- `after` and `rationale` respect bounded lengths;
- `revisionTargetKey()` is deterministic, e.g. `STEP:2:KELUARAN` and `PERINGATAN:0`.

- [ ] **Step 3: Run schema tests and verify RED**

```bash
cd server
pnpm test --runInBand src/modules/sop/ai-revision/sop-ai-revision.schema.spec.ts
```
Expected: FAIL because revision schema/types do not exist.

- [ ] **Step 4: Implement the minimal domain functions**

Use explicit allowlist logic, not generic property access. `readRevisionTargetValue()` must switch exhaustively:

```ts
if (target.kind === 'HEADER') return snapshot.judul
if (target.kind === 'PERINGATAN') return snapshot.peringatan[target.itemIndex]
const step = snapshot.steps.find((item) => item.urutan === target.stepOrder)
if (!step) throw new Error('invalid target')
switch (target.field) {
  case 'KEGIATAN': return step.kegiatan
  case 'KELENGKAPAN': return step.kelengkapan
  case 'KELUARAN': return step.keluaran
  case 'KETERANGAN': return step.keterangan
}
```

Do not expose internal IDs in target types.

- [ ] **Step 5: Add DTO validation for browser-supplied finding**

`SuggestAiRevisionDto` must validate the same severity/category/location enums and bounded title/explanation/recommendation strings used by AI Review. Do not accept a client `target` property.

- [ ] **Step 6: Run focused tests + typecheck**

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

### Task 3: Add the authenticated read-only revision service, controller, and deterministic providers

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
- Provider:
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
  ```
- Service response:
  ```ts
  export interface SuggestAiRevisionResponse {
    sourceDetailSopId: string
    sourceVersion: number
    suggestion: SopAiRevisionSuggestion
  }
  ```

- [ ] **Step 1: Write service RED tests for trust-boundary order**

Tests must prove:
1. disabled provider -> 503 before repository read;
2. missing detail -> 404 and provider not called;
3. owner mismatch -> 403 and provider not called;
4. `COMPLETED`/`ARCHIVED` -> 409 and provider not called;
5. non-eligible finding -> 422 and provider not called;
6. eligible finding -> provider called once;
7. provider input omits `detailSopId`, `ownerId`, `nomorSop`, `namaLembaga`, actor IDs, internal step IDs;
8. provider receives only derived `allowedTargets`;
9. invalid provider output -> safe 422;
10. success returns `sourceDetailSopId`, version, canonical `before`, `after`, rationale.

Example no-ID assertion:

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
Expected: FAIL because service/provider module does not exist.

- [ ] **Step 3: Implement provider interface, disabled provider, and deterministic fake provider**

Fake provider must choose one of `input.allowedTargets` deterministically and return a non-no-op text suggestion. It must never inspect or manufacture DB IDs.

- [ ] **Step 4: Implement service in the exact trust sequence from the spec**

Pseudo-code:

```ts
if (this.providerMode() === 'disabled') throw new ServiceUnavailableException(...)
const context = await this.repository.findContext(detailSopId)
if (!context) throw new NotFoundException(...)
if (context.ownerId !== user.sub) throw new ForbiddenException(...)
if (context.status !== StatusSOP.DRAFT) throw new ConflictException(...)
const allowedTargets = deriveAllowedRevisionTargets(finding, context.snapshot)
if (allowedTargets.length === 0) throw new UnprocessableEntityException(...)
const raw = await this.provider.suggest(this.toProviderInput(context.snapshot, finding, allowedTargets))
const suggestion = parseAndCanonicalizeAiRevision(raw, finding, context.snapshot)
return { sourceDetailSopId: context.snapshot.detailSopId, sourceVersion: context.snapshot.versi, suggestion }
```

`toProviderInput()` must explicitly map fields and strip IDs/protected identity.

- [ ] **Step 5: Add authenticated endpoints**

Controller routes:

```ts
@Get('ai-revisions/availability')
availability(): ApiSuccessResponse<{ enabled: boolean }>

@Post(':detailSopId/ai-revisions/suggest')
@HttpCode(200)
suggest(
  @Req() req: Request & { user: JwtAccessPayload },
  @Param('detailSopId') detailSopId: string,
  @Body() body: SuggestAiRevisionDto,
): Promise<ApiSuccessResponse<SuggestAiRevisionResponse>>
```

Apply `JwtAuthGuard` and existing cookie auth convention. There must be no revision write/apply endpoint.

- [ ] **Step 6: Register module in `AppModule`**

Add `SopAiRevisionModule` alongside AI Draft/AI Review without altering existing module order semantics.

- [ ] **Step 7: Run server focused + full gate**

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

### Task 4: Add independent revision runtime config and the production OpenAI adapter

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
- `AI_REVISION_PROVIDER` selection mirrors review but remains independent.
- `OpenAiRevisionProvider.suggest(input: SopAiRevisionProviderInput): Promise<unknown>`.

- [ ] **Step 1: Add RED environment tests**

Assert:

```ts
expect(validateEnv(baseEnv).AI_REVISION_PROVIDER).toBe('disabled')
expect(validateEnv(baseEnv).AI_REVISION_TIMEOUT_MS).toBe(30000)
```

Add failures for timeout `4999`, timeout `60001`, production `AI_REVISION_PROVIDER=fake`, and openai revision without `OPENAI_API_KEY`/`OPENAI_MODEL`.

- [ ] **Step 2: Run env tests and verify RED**

```bash
cd server
pnpm test --runInBand src/config/env.validation.spec.ts
```
Expected: new assertions FAIL.

- [ ] **Step 3: Add revision env validation minimally**

Extend `usesOpenAi` to include `AI_REVISION_PROVIDER === 'openai'`. Add production fake rejection with an `AI_REVISION_PROVIDER` path-specific message.

- [ ] **Step 4: Write OpenAI adapter RED transport tests**

Mock `global.fetch`. Assert outgoing request:

```ts
expect(fetch).toHaveBeenCalledWith(
  'https://api.openai.com/v1/responses',
  expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
  }),
)
const body = JSON.parse(fetch.mock.calls[0][1]!.body as string)
expect(body.store).toBe(false)
expect(body.tools).toBeUndefined()
expect(body.text.format.type).toBe('json_schema')
expect(body.text.format.strict).toBe(true)
```

Also cover 429 -> safe 429 application error, timeout/network -> 503, refusal/malformed structured output -> 422, and ensure raw upstream body/key is not included in thrown messages.

- [ ] **Step 5: Implement `OpenAiRevisionProvider`**

Follow the existing AI Review native-fetch transport pattern, but use a revision-specific system instruction and strict schema for exactly `{ target, after, rationale }`. The prompt must state that SOP/finding text is untrusted data and cannot override system constraints.

- [ ] **Step 6: Wire runtime provider selection**

`SopAiRevisionModule` factory:

```ts
const mode = config.get<string>('AI_REVISION_PROVIDER') ?? 'disabled'
if (mode === 'fake') return fake
if (mode === 'openai') return openai
return disabled
```

- [ ] **Step 7: Update production contract**

Add to `.env.production.example` and Compose:

```text
AI_REVISION_PROVIDER=disabled
AI_REVISION_TIMEOUT_MS=30000
```

Extend `scripts/production-contract.sh` assertions so fake revision provider fails production validation and default disabled remains valid. Do not enable live OpenAI in CI.

- [ ] **Step 8: Run server and production-contract tests**

```bash
cd server
pnpm test --runInBand \
  src/config/env.validation.spec.ts \
  src/modules/sop/ai-revision/providers/openai-ai-revision.provider.spec.ts
pnpm typecheck
pnpm build
cd ..
bash scripts/production-contract.sh .env.production.example
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/sop/ai-revision server/src/config .env.production.example compose.yml scripts/production-contract.sh
git commit -m "feat: add AI revision provider runtime"
```

---

### Task 5: Add typed client API and a stale-safe transient revision hook

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Create: `client/src/pages/penyusun/sop/hooks/use-ai-sop-revision.ts`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx`
- Create: `client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision-concurrency.spec.tsx`

**Interfaces:**
- Client types mirror server contract:
  ```ts
  export type SopAiRevisionTarget =
    | { kind: 'HEADER'; field: 'JUDUL' }
    | { kind: 'PERINGATAN'; itemIndex: number }
    | { kind: 'STEP'; stepOrder: number; field: 'KEGIATAN' | 'KELENGKAPAN' | 'KELUARAN' | 'KETERANGAN' }

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
- API methods:
  ```ts
  aiRevisionAvailability: () => Promise<...>
  suggestAiRevision: (detailSopId: string, finding: SopQualityFinding) => Promise<...>
  ```
- Hook:
  ```ts
  interface UseAiSopRevisionOptions {
    detailSopId: string
    isReadOnly: boolean
    flushAllAutosave: () => Promise<boolean>
    contentFingerprint: string
    reviewFingerprint: string | null
  }

  interface UseAiSopRevisionResult {
    isAvailable: boolean
    isAvailabilityLoading: boolean
    isRunning: boolean
    selectedFinding: SopQualityFinding | null
    proposal: SopAiRevisionResponse | null
    error: Error | null
    suggest: (finding: SopQualityFinding) => Promise<void>
    cancel: () => void
    clear: () => void
  }
  ```

- [ ] **Step 1: Write RED hook tests**

Cover:
- availability enabled/disabled;
- no request for read-only/disabled/running state;
- `flushAllAutosave()` is called before API;
- flush `false` prevents suggestion API;
- successful suggestion becomes transient proposal;
- API failure leaves editor untouched and exposes sanitized error;
- `cancel()` clears proposal only;
- content fingerprint change clears proposal/error;
- review fingerprint change clears proposal/error.

- [ ] **Step 2: Write RED concurrency tests**

Use deferred promises to prove:
- content changes while request in-flight -> response discarded;
- `detailSopId` changes -> response discarded;
- review fingerprint changes -> response discarded;
- second request cannot let an older first response replace the newer state.

- [ ] **Step 3: Run tests and verify RED**

```bash
cd client
pnpm test --run src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx \
  src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision-concurrency.spec.tsx
```
Expected: FAIL because API/hook does not exist.

- [ ] **Step 4: Add API methods and minimal hook implementation**

The browser request body must be exactly:

```ts
{ finding }
```

Do not include target, SOP body, metadata, actor IDs, or procedure DB IDs.

Capture `detailSopId`, `contentFingerprint`, `reviewFingerprint`, and monotonically increasing request sequence before the network call; accept the response only if all still match.

- [ ] **Step 5: Run client focused tests + typecheck**

```bash
cd client
pnpm test --run src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-revision.spec.tsx \
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

### Task 6: Add a pure client apply boundary that preserves existing autosave semantics

**Files:**
- Create: `client/src/pages/penyusun/sop/detail/ai-sop-revision-apply.ts`
- Create: `client/src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts`
- Modify only if needed for exported helper types: `client/src/types/ui/sop.ts`

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

- [ ] **Step 1: Write RED tests for exact apply mapping and stale checks**

Required cases:
- HEADER/JUDUL updates `metadata.judul` only when current canonical title equals `before`;
- PERINGATAN index 0 updates only existing item 0 and refuses out-of-range index;
- STEP/KEGIATAN matches `row.urutan` and changes `row.kegiatan`;
- STEP/KETERANGAN changes `row.keterangan`;
- STEP/KELENGKAPAN changes **both** `row.kelengkapan` and `row.mutu_kelengkapan`;
- STEP/KELUARAN changes **both** `row.keluaran` and `row.output`;
- mismatch between current value and `before` returns `STALE_TARGET` without mutation;
- target step not found returns `TARGET_NOT_FOUND`;
- unrelated row fields (`id`, actor, type, timing, routing) remain identical.

The alias-pair assertions are mandatory because current procedure autosave resolves `mutu_kelengkapan` before `kelengkapan` and `output` before `keluaran`.

- [ ] **Step 2: Run test and verify RED**

```bash
cd client
pnpm test --run src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts
```
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement pure immutable apply helper**

Do not call API, setters, toast, or autosave from this helper. Normalize current value using the same precedence as existing autosave before comparing to `before`:

```ts
const currentKelengkapan = pickFirst(row.mutu_kelengkapan, row.kelengkapan)
const currentKeluaran = pickFirst(row.output, row.keluaran)
```

On apply, set both aliases for compatibility:

```ts
{ ...row, mutu_kelengkapan: after, kelengkapan: after }
{ ...row, output: after, keluaran: after }
```

- [ ] **Step 4: Run focused test + autosave regression tests**

```bash
cd client
pnpm test --run \
  src/pages/penyusun/sop/detail/__tests__/ai-sop-revision-apply.spec.ts \
  src/pages/penyusun/sop/hooks/__tests__/use-sop-header-autosave.spec.tsx \
  src/pages/penyusun/sop/hooks/__tests__/use-sop-prosedur-autosave.spec.tsx
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/penyusun/sop/detail client/src/types/ui/sop.ts
git commit -m "feat: apply AI revisions through existing editor state"
```

---

### Task 7: Extend AI Review UI with eligible revision actions, preview, explicit apply, and manual-only messaging

**Files:**
- Modify: `client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx`
- Modify: `client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx`
- Add focused integration test if current page test harness supports it: `client/src/pages/penyusun/sop/detail/__tests__/DetailSOPPenyusun.ai-revision.spec.tsx`

**Interfaces:**
- Extend panel props with:
  ```ts
  aiRevision: {
    isAvailable: boolean
    isAvailabilityLoading: boolean
    isRunning: boolean
    proposal: SopAiRevisionResponse | null
    error: Error | null
    onSuggest: (finding: SopQualityFinding) => void | Promise<void>
    onCancel: () => void
    onApply: () => void
  }
  ```
- Add a pure client helper or shared exported predicate matching server conservative UI eligibility; server remains authoritative even if UI predicate is wrong.

- [ ] **Step 1: Write panel RED tests**

Required assertions:
- revision-eligible finding shows `Sarankan Perbaikan` when revision provider available;
- manual-only finding (`DECISION_ROUTING`, actor finding, time plausibility) shows concise `Perbaiki secara manual` copy and no revision action;
- running state disables duplicate suggestion action;
- successful proposal shows exact target label, `Sebelum`, `Usulan`, rationale, `Batal`, `Terapkan`;
- cancel callback fires without apply callback;
- revision provider disabled does not hide the existing AI Review finding itself;
- existing `Buka <finding>` navigation remains functional.

- [ ] **Step 2: Run panel tests and verify RED**

```bash
cd client
pnpm test --run src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx
```
Expected: new revision assertions FAIL.

- [ ] **Step 3: Wire revision hook into `DetailSOPPenyusun`**

Compute a deterministic review fingerprint from the current review response, for example:

```ts
const reviewFingerprint = useMemo(
  () => aiReview.review ? JSON.stringify(aiReview.review.result) : null,
  [aiReview.review],
)
```

Instantiate `useAiSopRevision` with the same `sopDetailId`, `isReadOnly`, `flushAllAutosave`, and content fingerprint.

- [ ] **Step 4: Implement explicit Apply orchestration**

On `Terapkan`:
1. require a current proposal;
2. require `proposal.sourceDetailSopId === sopDetailId`;
3. call `applyAiRevisionToEditor({ metadata, prosedurRows }, proposal.suggestion)`;
4. if stale/not found, clear revision and show a compact stale error instead of overwriting;
5. on success call `setMetadata(next.metadata)` and `setProsedurRows(next.prosedurRows)`;
6. call `aiRevision.clear()`;
7. call `aiReview.clearReview()` immediately;
8. do **not** call a revision write API;
9. existing autosave detects the changed state and persists it.

- [ ] **Step 5: Preserve existing review navigation and completed immutability**

AI Revision action exists only where the AI Review tab already exists for editable DRAFT. Completed/archived SOPs keep the review/revision editing actions hidden.

- [ ] **Step 6: Run client full gate**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/penyusun/sop/detail client/src/pages/penyusun/sop/hooks client/src/api/workspace-sops.ts
git commit -m "feat: add AI revision preview and explicit apply UI"
```

---

### Task 8: Add deterministic end-to-end acceptance and prove no direct revision mutation

**Files:**
- Create: `client/e2e/journeys/ai-assisted-revision.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify fake provider only if deterministic fixture needs tightening: `server/src/modules/sop/ai-revision/providers/fake-ai-revision.provider.ts`

**Interfaces:**
- E2E job sets `AI_REVISION_PROVIDER=fake` only for E2E runtime.
- Normal server/client/production-compose jobs keep revision provider disabled unless explicitly testing config.

- [ ] **Step 1: Add acceptance journey while provider remains disabled and prove RED**

Journey outline:

```text
login
-> create/open DRAFT
-> edit a revision-eligible textual field into deliberately weak wording
-> wait/flush autosave
-> run AI Review
-> choose eligible finding
-> click Sarankan Perbaikan
-> preview before/after
-> assert editor has NOT changed before Apply
-> click Terapkan
-> assert editor state changes
-> wait for existing autosave
-> open a fresh page in same authenticated context
-> assert revised value persisted
-> run AI Review again
-> confirm prior proposal is gone
-> Flowchart/BPMN still render
-> Complete
-> confirm AI review/revision actions unavailable on completed version
-> Create New Version
-> confirm new DRAFT can review/revise again
```

Before enabling fake revision provider, run E2E and record RED at the disabled revision CTA while the four previous journeys stay green.

- [ ] **Step 2: Configure fake revision provider only in E2E job**

Add:

```yaml
env:
  AI_REVIEW_PROVIDER: fake
  AI_REVISION_PROVIDER: fake
```

Do not set fake revision provider in production-compose.

- [ ] **Step 3: Make fake response deterministic for acceptance**

For an eligible step `INPUT_OUTPUT` finding, fake provider should select a fixed allowed target, e.g. first allowed target, and produce a recognizable non-no-op `after` value. Do not special-case DB IDs.

- [ ] **Step 4: Add cancel/no-write assertion**

The E2E must request a second suggestion, press `Batal`, then reload/fresh-page and prove the canceled proposed text was never persisted.

- [ ] **Step 5: Run E2E GREEN**

Run repository-supported Playwright journey command used by CI, targeting all journeys with one worker. Expected final summary: all existing journeys plus `ai-assisted-revision.spec.ts` pass with no retry/flaky label.

- [ ] **Step 6: Commit**

```bash
git add client/e2e/journeys/ai-assisted-revision.spec.ts .github/workflows/ci.yml server/src/modules/sop/ai-revision/providers/fake-ai-revision.provider.ts
git commit -m "test: cover AI-assisted SOP revision lifecycle"
```

---

### Task 9: Final security/regression audit, documentation state, and PR review gate

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Modify: PR #8 title/body through GitHub metadata, not repository file
- No Prisma files should change.

**Interfaces:**
- Final state is `REVIEW_READY`, not merged.
- PR #8 remains the sole Iteration 6 PR.

- [ ] **Step 1: Run full server gate from a fresh dependency state available to CI**

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```
Expected: PASS.

- [ ] **Step 2: Run full client gate**

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```
Expected: PASS.

- [ ] **Step 3: Run/confirm production contract and E2E mandatory CI**

Push final code-bearing head and require all four CI jobs:
- `server`: success;
- `client`: success;
- `e2e`: success;
- `production-compose`: success.

Inspect E2E log and require all journeys pass without retry/flaky status.

- [ ] **Step 4: Perform focused static audit**

Search/diff and record evidence for all of these:
- no `server/prisma/schema.prisma` or migration changes;
- no `POST .../apply` revision route;
- no `create`, `update`, `delete`, or mutating `$transaction` in `ai-revision` path;
- provider-safe input has no `detailSopId`, DB IDs, number, institution identity, tokens, audit logs;
- no prompt/API-key/full-provider-response logging;
- no `tools`, web/file retrieval, or RAG;
- fake provider rejected in production;
- AI Draft/Review runtime config still independent and unchanged except shared snapshot refactor;
- completed SOP remains immutable;
- apply helper cannot alter actor/routing/timing/structure fields.

- [ ] **Step 5: Check PR review state**

Require no unresolved review threads and no submitted blocking review before marking review-ready.

- [ ] **Step 6: Update `.agents/CURRENT_ITERATION.md`**

Record:
- Iteration `6-ai-assisted-revision`;
- status `REVIEW_READY`;
- branch `feat/ai-assisted-revision`;
- PR `#8`;
- final code-bearing head and CI run number;
- TDD RED/GREEN evidence;
- Iteration 5 merged as `8881d1888599ff1413fd6a454d2a1ba1ca844811`;
- explicit merge gate because external AI provider/credential boundary is extended;
- do not start Iteration 7 automatically.

- [ ] **Step 7: Update PR #8 metadata**

Title:
```text
feat: add AI-assisted SOP revision
```

Body must summarize product behavior, trust/privacy boundary, runtime, explicit non-goals, TDD/CI evidence, and final explicit user merge gate. Mark PR ready for review only after final CI passes.

- [ ] **Step 8: Stop before merge**

Do not squash-merge PR #8 until the user explicitly authorizes final merge.
