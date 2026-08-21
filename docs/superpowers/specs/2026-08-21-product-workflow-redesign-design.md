# Iteration 7 Design — Product Workflow & Editor Redesign

**Date:** 2026-08-21  
**Iteration:** `7-product-workflow-redesign`  
**Branch:** `feat/product-workflow-redesign`  
**Status:** APPROVED FOR IMPLEMENTATION

## Problem

The current product exposes internal feature boundaries instead of the user's job. Workspace mixes actor setup, SOP creation, AI/template setup, and SOP browsing. The editor makes preview/diagram the dominant canvas while metadata, procedure editing, AI review, versions, and activity are split across toggles and a right-side tab panel.

## Product Goal

```text
Workspace -> Create/Open SOP -> Build content -> Review -> Preview -> Complete
```

The next useful action must be obvious without changing backend/domain behavior.

## Target Workflow

```text
LOGIN
  -> WORKSPACES
  -> WORKSPACE
       -> search / browse SOP
       -> + Buat SOP
            -> Dengan AI | Template | Kosong
            -> GUIDED SOP EDITOR
                 -> 1 Informasi Dasar
                 -> 2 Pelaksana
                 -> 3 Prosedur
                 -> 4 Informasi Pendukung
                 -> 5 Review
            -> PREVIEW
                 -> Dokumen | Flowchart | BPMN
            -> REVIEW & COMPLETE
            -> COMPLETED
                 -> PDF | Buat versi baru
```

Guided sections orient the user but do not behave as a rigid wizard.

## Workspace

Workspace becomes a document hub. Primary content is SOP discovery and creation: workspace title, lightweight stats, search, status filter, SOP list/cards, one dominant `Buat SOP` CTA. Actor management is demoted from primary workspace content; actor reuse/creation is surfaced in the SOP authoring context.

## Create SOP

Creation becomes a deliberate decision surface with three large options:
1. `Dengan AI` — recommended;
2. `Gunakan Template`;
3. `Mulai Kosong`.

Existing AI/template preview and confirmation semantics remain. Only fields required before draft instantiation belong here; remaining metadata belongs in the editor.

## Guided Editor

Desktop mental model:

```text
Header: Back | SOP title | Draft/version | Saved state | Preview | Review & Complete

Left rail                 Main work surface
------------------        --------------------------------
1 Informasi Dasar         Active section editor
2 Pelaksana
3 Prosedur
4 Informasi Pendukung
5 Review
```

There is no permanent generic right sidebar carrying Edit/AI Review/Version/Activity during normal authoring. Version history and activity remain secondary surfaces.

### Informasi Dasar

Primary SOP identity and metadata using existing metadata state/autosave. Frequently used fields first; advanced/rare fields progressively disclosed.

### Pelaksana

Ordered SOP actors, with reuse/add affordance inside the SOP. Users should not need to leave the editor to configure actors required by the procedure.

### Prosedur

The main authoring surface. Prefer human-readable editable step units over the formal output document as the primary editor. Keep existing step/decision data model, validation, actor assignment, input/output, duration, notes, routing, and `data-sop-step-order` anchors.

### Informasi Pendukung

Law basis, related SOP, warnings, qualification, equipment, and recordkeeping grouped into one coherent section.

### Review

Review is a workflow stage, not a generic tab. It contains deterministic readiness, AI quality review when available, grouped findings, location navigation, and AI before/after revision proposals with explicit Apply/Cancel. AI remains advisory.

## Preview

Preview becomes a separate mode:

```text
Preview -> Dokumen | Flowchart | BPMN
```

Flowchart/BPMN remain generated from procedure data. Manual path editing is an advanced secondary action inside diagram preview, not a primary authoring mode.

## Completion

Replace the generic primary `Selesai` emphasis with `Review & Complete`. Before transition, show readiness items using already available client state and clearly explain that completion locks the active version and future edits require `Buat versi baru`. Existing `transitionToDone` semantics remain authoritative.

## Completed SOP

Read-only version emphasizes status/version, Preview/PDF, and `Buat versi baru` as the primary continuation. AI Review/Revision stays hidden for read-only versions.

## Visual System

- one dominant CTA per surface;
- neutral app background with a clear work surface;
- fewer nested cards/borders;
- section headings establish hierarchy;
- core instructions/actions avoid tiny 11px text;
- usable 40–44px form/control heights where practical;
- color communicates state rather than decoration;
- advanced controls behind secondary/overflow actions;
- reuse existing design tokens/components; no new design-system dependency.

## Technical Boundaries

- no Prisma schema/migration;
- no backend domain rewrite;
- no auth/ownership change;
- no DRAFT/COMPLETED/ARCHIVED semantic change;
- no direct AI database write;
- existing autosave remains persistence boundary;
- existing AI Draft/Review/Revision contracts remain compatible;
- Flowchart/BPMN/PDF remain functional;
- existing lifecycle E2E behavior must continue.

## Component Strategy

Refactor frontend composition, reuse existing state/hooks and leaf components. Expected units include workspace document hub, create-SOP dialog/surface, guided editor shell, section navigation, section components, review section wrapping existing AI logic, preview mode wrapping existing preview/diagram logic, and completion readiness dialog.

## Error Handling

- loading/error states remain recoverable;
- autosave error visible globally and blocks completion until resolved;
- AI unavailable remains local and never blocks manual authoring;
- preview/PDF keeps current graceful degradation;
- failed draft creation preserves user input on the creation surface.

## Acceptance

Required: client typecheck, unit tests, production build, and Playwright journeys for blank/template/AI draft/AI review/AI revision/completion/versioning. New assertions cover one primary workspace create CTA, explicit creation choices, guided section navigation, procedure editing as default authoring, Preview with document/Flowchart/BPMN, Review with AI findings, and clear immutable completion/new-version continuation.

## Non-Goals

No RAG/regulation retrieval, structural AI mutation, collaboration roles, billing/quota system, schema migration, or design-system replacement.
