# Workspace Production Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah workspace menjadi compact multi-SOP workbench dengan resource navigation, metrics, searchable/filterable catalog, dan episodic AI/template/blank creation tanpa mengubah core SOP editor.

**Architecture:** `WorkspaceDetailPage` tetap menjadi route-level orchestration boundary. Workspace-only UI dipecah menjadi shell/navigation, metric/catalog surface, dan create dialog; data tetap memakai `workspaceApi` dan `workspaceSopApi` yang sudah ada. Tidak ada schema/backend change untuk cosmetic dashboard.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind CSS, Radix Dialog, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-workspace-production-workbench-design.md`

## Global Constraints

- `client/src/pages/penyusun/sop/detail/**` tidak diubah.
- Workspace navigation merepresentasikan resource/location, bukan wizard state.
- `Review & Complete` tidak boleh menjadi workspace navigation.
- AI/template/blank creation tetap memakai existing APIs dan berakhir di existing SOP detail route.
- Search/filter dilakukan client-side setelah list workspace tersedia.
- Tidak menambah database schema atau endpoint agregasi hanya untuk metrics.

---

### Task 1: Workbench information architecture

**Files:**
- Modify: `client/src/pages/workspaces/WorkspaceDetailPage.tsx`
- Create: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.workbench.spec.ts`

**Interfaces:**
- Consumes: `workspaceApi.get(workspaceId)`, `workspaceSopApi.list(workspaceId)`, existing `WorkspaceSopRow`.
- Produces: workspace shell dengan breadcrumb/context, `aria-label="Navigasi workspace"`, resource item `Dokumen SOP`, metrics Total/Draft/Selesai, catalog/search/filter.

- [ ] **Step 1: Write the failing workbench contract test**

Assert source contains stable workbench marker/navigation semantics and does not expose `Review & Complete` as sidebar navigation.

- [ ] **Step 2: Run CI and verify RED**

Expected: client Vitest fails because current workspace page has no workbench shell/navigation marker.

- [ ] **Step 3: Implement minimal shell/navigation**

Use responsive two-column desktop layout with compact sidebar and a single content surface. Preserve existing query and create state.

- [ ] **Step 4: Verify GREEN**

Expected: client typecheck/tests/build pass and existing E2E selectors remain valid or are updated only for changed workspace UI.

### Task 2: Catalog hierarchy and states

**Files:**
- Modify: `client/src/pages/workspaces/WorkspaceDetailPage.tsx`
- Test: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.workbench.spec.ts`

**Interfaces:**
- Consumes: `WorkspaceSopRow[]`.
- Produces: deterministic counts and filtered catalog preserving detail route links.

- [ ] **Step 1: Add RED assertions for visible metric labels, search/filter controls, version/update metadata, and compact document rows.**
- [ ] **Step 2: Verify expected failures.**
- [ ] **Step 3: Implement smallest catalog markup needed for GREEN, retaining loading/error/empty states.**
- [ ] **Step 4: Verify focused client tests.**

### Task 3: Episodic create flow regression

**Files:**
- Modify only if necessary: `client/src/pages/workspaces/WorkspaceDetailPage.tsx`
- Test: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.ai-create.spec.ts`
- Test: `client/src/pages/workspaces/__tests__/WorkspaceDetailPage.template-create.spec.ts`
- E2E: `client/e2e/journeys/*.spec.ts`

**Interfaces:**
- Consumes: current AI/template/blank API methods.
- Produces: dismissible `Buat SOP` dialog and navigation to `/workspaces/:workspaceId/sops/:detailSopId` after successful creation.

- [ ] **Step 1: Run existing AI/template tests as regression gate.**
- [ ] **Step 2: Keep `Buat SOP`, `Buat dengan AI`, `Gunakan template`, `Mulai kosong`, `Generate draft`, `Preview AI`, and `Buat dan lanjutkan` contracts intact.**
- [ ] **Step 3: Run all client tests/build.**
- [ ] **Step 4: Run lifecycle E2E in mandatory CI.**

### Task 4: Final workspace verification

**Files:**
- Update: `.agents/CURRENT_ITERATION.md`

- [ ] **Step 1: Confirm no diff under `client/src/pages/penyusun/sop/detail/**`.**
- [ ] **Step 2: Confirm client, E2E, and production-compose jobs are green on current PR head.**
- [ ] **Step 3: Record verification state without marking Iteration 8 complete until deployment slice is also green.**
