# Product Workflow & Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the feature-oriented SOP workflow with a task-oriented workspace, creation flow, guided editor, preview, review, and completion experience while preserving Iteration 1-6 backend/domain behavior.

**Architecture:** Keep server contracts and editor state hooks intact. Refactor frontend composition around guided sections and explicit Edit/Preview modes. Reuse existing metadata/procedure/diagram/AI/version components so domain logic is not duplicated.

**Tech Stack:** React, TypeScript, TanStack Query/Router, Tailwind CSS, existing UI primitives, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-21-product-workflow-redesign-design.md`

## Global Constraints

- No Prisma schema or migration.
- No auth/ownership/lifecycle semantic changes.
- Completed SOP remains immutable; edits continue through Create New Version.
- Existing autosave remains persistence boundary.
- AI Draft/Review/Revision backend contracts remain compatible; AI has no direct DB write path.
- Flowchart, BPMN, PDF/export stay functional.
- No new design-system dependency.

---

### Task 1: Workspace document hub and creation decision

**Files:** `client/src/pages/workspaces/WorkspaceDetailPage.tsx` plus a focused create-dialog component if useful.

- [ ] Replace always-visible actor/create forms with SOP hub + one `Buat SOP` CTA.
- [ ] Add client-side search/status filtering to existing loaded SOP list.
- [ ] Move existing blank/template/AI creation logic into explicit creation surface with three large choices.
- [ ] Preserve template preview, AI preview, confirmation, and redirect to detail editor.
- [ ] Keep actor API available but remove mandatory pre-authoring setup from primary workspace hierarchy.

### Task 2: Guided editor shell

**Files:** `DetailSOPPenyusun.tsx`, `DetailSopPenyusunHeader.tsx`, new `SopEditorSectionNav.tsx`.

- [ ] Introduce `EditorSection = basic|actors|procedure|supporting|review`.
- [ ] Introduce `mode = edit|preview`; default to edit for DRAFT.
- [ ] Replace permanent right-side feature tabs with left task navigation and secondary version/activity access.
- [ ] Keep `SopEditorProvider`, autosave status, lifecycle actions, AI hooks, and stale guards intact.

### Task 3: Basic, actors, procedure, and supporting sections

**Files:** reuse `SOPHeaderSection.tsx`, `DetailSopMetadataPanel.tsx`, `PelaksanaDialog.tsx`, `DetailSopProsedurEditor.tsx`, existing supporting-info dialogs/components; add focused section wrappers as needed.

- [ ] Basic Info: primary identity/metadata with progressive disclosure.
- [ ] Actors: ordered current actors + reuse/add inside SOP context.
- [ ] Procedure: make existing procedure editor the primary center work surface, preserving decision routing and step anchors.
- [ ] Supporting: group law basis, related SOP, warning, qualification, equipment, recordkeeping coherently.
- [ ] Verify all edits continue through existing autosave.

### Task 4: Preview mode

**Files:** refactor `DetailSopPenyusunMain.tsx`, reuse `SOPPreviewTemplate` and `usePenyusunDiagramConfig`.

- [ ] Explicit Preview surface with `Dokumen | Flowchart | BPMN`.
- [ ] Keep lazy diagram hydration and workbench source.
- [ ] Demote manual path editing/reset to advanced diagram controls.
- [ ] Preserve print/PDF behavior.

### Task 5: Review stage and contextual AI

**Files:** `AiSopQualityReviewPanel.tsx`, `DetailSOPPenyusun.tsx`.

- [ ] Place AI Review/Revision inside Review section.
- [ ] Preserve availability/error/advisory behavior.
- [ ] Group findings clearly by severity/location.
- [ ] `Buka lokasi` switches to relevant editor section; step findings activate Procedure then focus `data-sop-step-order`.
- [ ] Keep explicit before/after Apply/Cancel and existing autosave/stale guards.

### Task 6: Completion readiness

**Files:** `DetailSopPenyusunHeader.tsx`, new completion dialog/helper if useful.

- [ ] Replace generic `Selesai` CTA with `Review & Complete`.
- [ ] Show deterministic readiness and immutable-version explanation before transition.
- [ ] Autosave error/pending state blocks completion until resolved/flush succeeds.
- [ ] Preserve `transitionToDone` and completed read-only state.
- [ ] Make `Buat versi baru` the primary editing continuation on completed versions.

### Task 7: Visual hierarchy and responsive polish

- [ ] Reduce nested cards/borders and tiny core copy.
- [ ] Establish clear app background, work surface, section hierarchy, and one dominant CTA.
- [ ] Keep existing tokens/components and keyboard/focus behavior.
- [ ] Ensure section navigation and creation surface remain usable on narrower screens.

### Task 8: E2E migration and verification

**Files:** existing Playwright journeys for blank/template/AI/review/revision/versioning.

- [ ] Update locators to new user-facing workflow without weakening domain assertions.
- [ ] Assert `Buat SOP` -> creation choice -> guided editor.
- [ ] Assert section navigation and procedure editing.
- [ ] Assert Preview contains document/Flowchart/BPMN.
- [ ] Assert AI review -> finding -> revision -> apply.
- [ ] Assert Review & Complete -> immutable completed -> Create New Version.
- [ ] Run client typecheck, unit tests, build, and mandatory Playwright CI.

### Task 9: Final audit

- [ ] Confirm no Prisma/schema/server-security scope expansion.
- [ ] Confirm no direct AI write path and existing autosave boundary remains.
- [ ] Confirm CI green with no flaky/retry label.
- [ ] Update `.agents/CURRENT_ITERATION.md` to `REVIEW_READY` with final evidence.
- [ ] Mark PR #9 ready for review; merge only after repository workflow gates are satisfied.
