# Iteration 4 — AI-Assisted Drafting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use TDD for every production behavior change. This branch is already isolated as `feat/ai-assisted-drafting`; execute tasks inline on the same branch/PR #6.

**Goal:** Add server-authoritative AI-assisted SOP drafting that generates a validated read-only preview and only persists a normal editable `DRAFT` after explicit confirmation.

**Architecture:** Add a provider-neutral AI drafting module under `server/src/modules/sop/ai-draft`, with a production OpenAI Responses API adapter and deterministic fake provider for tests/E2E. Extract the transactional template instantiation logic into one internal `SopDraftInstantiationService` shared by template and AI creation. Extend the existing workspace creation surface with a third `Dengan AI` source; after confirmation, navigate to the existing editor.

**Tech Stack:** NestJS 11, TypeScript, Prisma/MySQL, Zod 3, official `openai` Node SDK, React/Vite, TanStack Query, Vitest, Jest, Playwright, Docker Compose.

**Spec:** `.agents/plans/2026-08-20-ai-assisted-drafting-design.md`

## Global Constraints

- Generation performs zero application database writes.
- Create revalidates the complete proposal and current workspace actor state.
- Exactly 2..25 steps; `waktu` is integer `1..525600`; step/actor text limits follow the design spec.
- Decision routing follows the existing `JenisLangkahProsedur` and `SatuanWaktu` enums.
- No automatic `Peraturan` attachment.
- No Prisma migration or persisted AI conversation/job/history.
- `AI_DRAFT_PROVIDER` defaults to `disabled`; application boot and blank/template flows remain functional with AI disabled.
- OpenAI credentials stay server-side; production request uses Responses API strict JSON Schema, `store: false`, no tools/retrieval, and server-configured `OPENAI_MODEL`.
- Mandatory CI never calls a paid/live provider; fake provider output is deterministic.
- Existing editor remains the sole editor after draft creation.

---

### Task 1: Extract the shared transactional draft-instantiation boundary

**Files:**
- Create: `server/src/modules/sop/draft/sop-draft.types.ts`
- Create: `server/src/modules/sop/draft/sop-draft-instantiation.service.ts`
- Create: `server/src/modules/sop/draft/sop-draft-instantiation.service.spec.ts`
- Modify: `server/src/modules/sop/template/sop-template.repository.ts`
- Modify: `server/src/modules/sop/template/sop-template.service.ts`
- Modify: `server/src/modules/sop/catalog/sop-catalog.module.ts`

**Interfaces:**
- `SopDraftDefinition`: canonical identity-independent lampiran/actor/step definition.
- `SopDraftInstantiationService.instantiate(params)` returns `{ sopId, detailSopId, workspaceId, status }`.
- Template service maps `ValidatedTemplate` to `SopDraftDefinition` and calls the shared instantiator.

- [ ] RED: add a service spec proving actor normalization/reuse, missing-actor creation once, ordered `DetailSOPPelaksana`, lampiran persistence, two-pass decision target remapping, initial edit log, and transaction result identity.
- [ ] RED verification: run server Jest for `sop-draft-instantiation.service.spec.ts`; expected failure because the service/types do not exist.
- [ ] GREEN: move the existing transaction from `SopTemplateRepository.instantiateTemplate` into `SopDraftInstantiationService.instantiate` without changing template behavior.
- [ ] GREEN: make `SopTemplateRepository` read-only for templates/workspace actors; inject the shared instantiator into `SopTemplateService.create`.
- [ ] GREEN verification: run draft-instantiation + template service tests, then server typecheck/build.
- [ ] Commit: `refactor: share SOP draft instantiation`.

### Task 2: Add canonical AI proposal validation and provider contracts

**Files:**
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.types.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.schema.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.schema.spec.ts`
- Create: `server/src/modules/sop/ai-draft/providers/ai-draft-provider.ts`
- Create: `server/src/modules/sop/ai-draft/providers/fake-ai-draft.provider.ts`

**Interfaces:**
- `AiDraftProvider.generate(input): Promise<AiDraftProviderOutput>`.
- `parseAndCanonicalizeAiDraft(output)` returns a canonical proposal with trimmed fields, contiguous orders, de-duplicated first-use actors, and validated routing.
- Provider output contains step `actorName` values only; workspace IDs/classification are application-derived.

- [ ] RED: tests reject <2 or >25 steps, blank/oversized text, `waktu` outside `1..525600`, duplicate/invalid orders, invalid enum values, invalid decision targets, equal yes/no targets, and branches on non-decision steps.
- [ ] RED: tests prove trimming, lampiran empty-item removal, actor de-duplication by normalized Indonesian case-insensitive name, and normalized step order `1..N` with target remapping.
- [ ] RED verification: run the schema spec; expected failure because parser/contracts do not exist.
- [ ] GREEN: implement Zod structural schema plus explicit domain/routing canonicalization.
- [ ] GREEN: implement deterministic fake provider with a small valid multi-actor procedure and no database access.
- [ ] GREEN verification: schema/provider tests and server typecheck pass.
- [ ] Commit: `feat: validate AI SOP draft proposals`.

### Task 3: Add OpenAI adapter, configuration, AI service/controller, and create orchestration

**Files:**
- Create: `server/src/modules/sop/ai-draft/providers/openai-draft.provider.ts`
- Create: `server/src/modules/sop/ai-draft/providers/openai-draft.provider.spec.ts`
- Create: `server/src/modules/sop/ai-draft/dto/generate-ai-draft.dto.ts`
- Create: `server/src/modules/sop/ai-draft/dto/create-ai-draft.dto.ts`
- Create: `server/src/modules/sop/ai-draft/dto/ai-draft.dto.spec.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.repository.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.service.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.service.spec.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.controller.ts`
- Create: `server/src/modules/sop/ai-draft/sop-ai-draft.module.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/env.validation.spec.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/package.json`
- Modify: `server/pnpm-lock.yaml`
- Modify: `.env.production.example`
- Modify: `compose.yml`

**Interfaces:**
- `GET /sop/ai-drafts/availability -> { enabled: boolean }`.
- `POST /sop/ai-drafts/generate` accepts `{ workspaceId, deskripsiProses, tujuanProses?, catatanTambahan? }` and returns `{ proposal }`.
- `POST /sop/ai-drafts/create` accepts workspace identity plus proposal and returns normal draft identity.
- `AI_DRAFT_PROVIDER=disabled|openai|fake`; `fake` is allowed for test/E2E only and production validation rejects it.

- [ ] RED: DTO tests prove trimming and exact max lengths; env tests prove disabled default, conditional OpenAI key/model requirements, timeout default/range, and rejection of `fake` in production.
- [ ] RED: service tests prove owner assertion, availability, provider-disabled `503`, generation actor-context cap `50`, no DB IDs sent to provider, current actor reuse/create classification, create-time proposal revalidation, actor-state re-resolution, and duplicate-number `409` mapping.
- [ ] RED: adapter tests use a mocked SDK client and assert Responses request shape: configured model, strict `json_schema`, `store:false`, no tools, bounded timeout, prompt rules, successful output parsing, and safe mapping for timeout/rate-limit/refusal/incomplete/invalid output.
- [ ] RED verification: targeted Jest fails for missing AI module/provider.
- [ ] GREEN: add official `openai` SDK dependency and frozen-lockfile entry.
- [ ] GREEN: implement config, provider factory/module, repository read for workspace actor context, service/controller endpoints, error classes/mapping, and shared instantiator call on confirmation.
- [ ] GREEN verification: targeted AI specs, full server Jest, typecheck, and build pass.
- [ ] Commit: `feat: add AI-assisted SOP draft API`.

### Task 4: Add workspace `Dengan AI` client flow

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Modify: `client/src/pages/workspaces/WorkspaceDetailPage.tsx`
- Create: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.ai-create.spec.ts`

**Interfaces:**
- `workspaceSopApi.aiDraftAvailability()`.
- `workspaceSopApi.generateAiDraft(input)`.
- `workspaceSopApi.createFromAiDraft(input)`.
- `CreateSource = 'blank' | 'template' | 'ai'`.

- [ ] RED: client contract test asserts exact availability/generate/create endpoints and payloads.
- [ ] RED: creation-surface test asserts `Dengan AI`, natural-language/context fields, explicit generate action, AI warning, read-only preview, user-owned `nomorSop`/`namaLembaga`, and create action only after proposal exists.
- [ ] RED verification: targeted Vitest fails because AI client flow is absent.
- [ ] GREEN: add transient AI state/query/mutations; availability is loaded only when AI source is selected.
- [ ] GREEN: show actors reuse/create, ordered steps, lampiran summary, visible AI-review warning, regenerate behavior, and safe disabled/error copy.
- [ ] GREEN: clear transient proposal when source changes or generation input changes; on confirmation invalidate SOP/pelaksana queries and navigate to existing editor.
- [ ] GREEN verification: targeted client spec, full client tests, typecheck, and production build pass.
- [ ] Commit: `feat: add AI draft creation UI`.

### Task 5: Add deterministic end-to-end lifecycle and production regression coverage

**Files:**
- Modify: `client/e2e/journeys/mvp-vertical-slice.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/production-contract.sh`
- Modify: `.agents/CURRENT_ITERATION.md`

**Acceptance journey:**
`create workspace -> create one reusable actor -> Dengan AI -> generate fake deterministic proposal -> verify reused/new actors -> confirm identity -> existing editor -> edit/autosave -> reload -> Selesai edit -> Flowchart/BPMN -> Complete -> immutable -> Create New Version -> DRAFT v2`.

- [ ] RED: add Playwright AI journey and CI test environment with `AI_DRAFT_PROVIDER=fake`; first run must fail because integration is incomplete or missing E2E configuration.
- [ ] GREEN: make E2E server use fake provider without network/provider credentials; preserve existing blank and template journeys.
- [ ] GREEN: production contract asserts application boots with `AI_DRAFT_PROVIDER=disabled` and no OpenAI credential; production Compose must not require OpenAI env values.
- [ ] GREEN verification: mandatory CI jobs all green: server, client, E2E (blank + template + AI), and production-compose.
- [ ] Update `.agents/CURRENT_ITERATION.md` to `REVIEW_READY` with exact final head and CI evidence; do not mark merged.
- [ ] Commit: `test: verify AI-assisted drafting lifecycle`.

### Task 6: Review gate

- [ ] Compare branch against `master` and review every changed production boundary for secret leakage, DB writes during generation, bypassable proposal validation, transaction atomicity, stale actor IDs, provider error leakage, and blank/template regressions.
- [ ] Inspect PR #6 review threads and mandatory CI status; resolve blockers before declaring review-ready.
- [ ] Do not squash-merge automatically if a new high-risk/security concern is found. Otherwise follow repository merge rules after review gate.
