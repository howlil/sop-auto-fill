# Smart Template & Auto-Fill Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD. Do not add production behavior before the corresponding RED contract exists.

**Goal:** Implement deterministic system-template SOP creation that produces an ordinary editable `DRAFT` in the existing editor.

**Architecture:** Persist read-only system templates in two Prisma models. A focused SOP template service builds a read-only preview and delegates one transactional instantiation to its repository. The client adds a creation source selector around the existing workspace catalog and navigates the generated draft into the unchanged editor.

**Tech Stack:** NestJS 11, TypeScript, Prisma 7/MySQL, React 19, TanStack Query, Vitest, Jest, Playwright, Docker Compose.

**Spec:** `.agents/plans/2026-08-18-smart-template-auto-fill-design.md`

## Global Constraints

- Preserve existing blank SOP creation through `POST /sop`.
- Add exactly `SopTemplate` and `SopTemplateStep`; do not add template ownership or mutation APIs.
- Never auto-attach `Peraturan`.
- Preview must not write data and must use the same actor-resolution rules as creation.
- Template creation must be one Prisma transaction and must leave no partial SOP/actor on failure.
- Generated SOP must continue through the existing editor/autosave/diagram/completion/versioning/print/PDF path.
- Migration is additive only. Final merge remains explicit-review/high-risk.

---

### Task 1: Persistence contract, migration, and seed

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260819000000_sop_templates/migration.sql`
- Create: `server/prisma/seed.ts`
- Test: `server/src/modules/sop/template/sop-template-schema.contract.spec.ts`

**Produces:** Prisma delegates `sopTemplate` / `sopTemplateStep` and three stable system template keys.

- [ ] Write the failing schema/seed contract test and observe CI RED.
- [ ] Add the two Prisma models exactly as specified by the design.
- [ ] Add an additive MySQL migration with only template tables/index/FK.
- [ ] Add idempotent `upsert` seed definitions for `administrasi-umum`, `pengelolaan-dokumen`, and `pelayanan`; replace each template's steps deterministically inside a transaction.
- [ ] Generate Prisma in CI and verify schema contract becomes GREEN.

### Task 2: Server preview and transactional instantiation

**Files:**
- Create: `server/src/modules/sop/template/dto/create-sop-from-template.dto.ts`
- Create: `server/src/modules/sop/template/dto/template-preview-query.dto.ts`
- Create: `server/src/modules/sop/template/sop-template.types.ts`
- Create: `server/src/modules/sop/template/sop-template.mapper.ts`
- Create: `server/src/modules/sop/template/sop-template.repository.ts`
- Create: `server/src/modules/sop/template/sop-template.service.ts`
- Create: `server/src/modules/sop/template/sop-template.controller.ts`
- Create: `server/src/modules/sop/template/sop-template.service.spec.ts`
- Modify: `server/src/modules/sop/catalog/sop-catalog.module.ts`

**Produces:** `GET /sop/templates`, `GET /sop/templates/:templateId/preview`, and `POST /sop/templates/:templateId/create`.

- [ ] Write service tests for active listing, ownership, reuse/create classification, missing template, JSON validation, decision target validation, and duplicate-number mapping.
- [ ] Observe RED before creating service behavior.
- [ ] Implement a shared pure actor-name normalizer and template integrity mapper.
- [ ] Implement read-only list/fetch repository methods.
- [ ] Implement preview from the owned workspace without mutation.
- [ ] Implement one `$transaction` that creates SOP/detail, resolves actors, attaches swimlanes/lampiran, creates steps, remaps decision references, and writes the initial edit log.
- [ ] Wire controller and module with existing `JwtAuthGuard`/`WorkspaceService` patterns.
- [ ] Run server unit/type/build CI to GREEN.

### Task 3: Client template creation layer

**Files:**
- Modify: `client/src/api/workspace-sops.ts`
- Modify: `client/src/pages/workspaces/WorkspaceDetailPage.tsx`
- Create: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.template-create.spec.tsx`

**Produces:** `Buat SOP` source choice between blank and system template, preview, identity input, and existing-editor navigation.

- [ ] Write failing component/API tests for source selection, template loading/preview, actor reuse/create labels, confirmation payload, failure recovery, and blank regression.
- [ ] Observe client RED.
- [ ] Add typed template list/preview/create API calls.
- [ ] Add creation state around the existing workspace catalog without modifying the editor.
- [ ] Keep blank submit behavior unchanged and navigate only after confirmed create success.
- [ ] Run client typecheck/test/build to GREEN.

### Task 4: Acceptance and production regression

**Files:**
- Modify: `client/e2e/journeys/mvp-vertical-slice.spec.ts` or add a colocated template journey if the audit accepts it.
- Modify: `server/prisma/seed-e2e.ts` only if deterministic template fixture setup is needed.
- Modify: `.github/workflows/ci.yml` only if production seed verification needs an explicit step.

**Produces:** Executable proof that template-created drafts continue through the existing lifecycle.

- [ ] Add a failing Playwright template journey before changing acceptance setup.
- [ ] Prove template list/preview/create and visible prefilled actor/step/lampiran content.
- [ ] Edit generated content, autosave, reload, render Flowchart/BPMN, Complete, and Create New Version.
- [ ] Keep the existing blank MVP journey mandatory.
- [ ] Verify migration deploy twice and seed twice without duplicate templates/steps.
- [ ] Verify full server, client, E2E, and production-compose CI is GREEN.
- [ ] Update iteration evidence and PR description; do not merge until explicit high-risk review approval.
