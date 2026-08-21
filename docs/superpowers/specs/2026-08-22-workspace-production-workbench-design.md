# Workspace Production Workbench Design

**Iteration:** 8 `workspace-production-workbench`  
**Status:** Design review  
**Branch:** `feat/workspace-production-workbench`

## Goal

Redesign halaman workspace menjadi workbench untuk mengelola banyak SOP dalam satu workspace tanpa membuat navigation terasa seperti wizard, sambil mempertahankan core SOP editor dan workflow editing yang sudah ada.

## Product Mental Model

```text
ACCOUNT
└── WORKSPACES
    └── WORKSPACE
        ├── SOP A
        ├── SOP B
        ├── SOP C
        └── ...
```

Workspace adalah container banyak SOP. `Review & Complete` adalah state/action milik satu SOP, bukan lokasi global di workspace navigation.

## Approved Information Architecture

```text
SOP Auto Fill
├── Workspaces
└── Workspace: <name>
    ├── Workspace identity / switch context
    ├── Summary metrics
    ├── SOP catalog
    │   ├── search
    │   ├── status filter
    │   └── open SOP
    ├── + Buat SOP
    │   ├── AI
    │   ├── Template
    │   └── Blank
    └── Workspace settings (only if an existing useful settings surface exists)
```

The workspace shell must not expose wizard-step navigation such as `Workspace -> Dokumen SOP -> Review & Complete`.

## Workspace Surface

Desktop target:

```text
┌───────────────────────────────────────────────────────────────┐
│ SOP Auto Fill             Workspace > <name>              AR │
├────────────────┬──────────────────────────────────────────────┤
│ WORKSPACE      │ <Workspace name>                 [+ Buat SOP]│
│ ● <name>       │ <count> SOP                                  │
│                │                                              │
│ NAVIGASI       │ [Total] [Draft] [Selesai]                    │
│ ▣ Dokumen SOP  │                                              │
│                │ Dokumen SOP                                  │
│                │ [ Search............... ] [ Semua status ▾ ] │
│                │                                              │
│                │ SOP A    Draft      v2.1     updated     →    │
│                │ SOP B    Selesai    v1.0     updated     →    │
│                │ SOP C    Arsip      v3.0     updated     →    │
└────────────────┴──────────────────────────────────────────────┘
```

### Visual direction

Retain the supplied reference's useful qualities:

- compact productivity-dashboard density;
- restrained green accent;
- white/light neutral surfaces;
- small-radius cards and borders;
- compact metric cards;
- clear breadcrumb and top-level identity;
- list/table-first document browsing;
- responsive collapse for narrow screens.

Do not reproduce the reference's permanent right creation sidebar or wizard semantics.

## Navigation Rules

1. Sidebar represents resources/locations, not process state.
2. `Review & Complete` must not appear as workspace navigation.
3. `Dokumen SOP` is the primary workspace content surface.
4. Do not create empty navigation items only to visually fill the sidebar.
5. If workspace settings are not useful in the existing product, omit that item rather than creating a placeholder page.

## SOP Catalog

The existing workspace SOP list remains the source of truth. The UI must support:

- total SOP count;
- draft count;
- completed count;
- archived state where returned by the existing API;
- search by title / SOP number / status label;
- status filtering;
- version display;
- last-updated display;
- opening the existing SOP detail/editor route.

No new backend endpoint is required merely to reproduce metrics that can be deterministically derived from the current list response. A backend aggregation endpoint is justified only if profiling shows the list payload becomes materially expensive.

## Create SOP Entry Point

`+ Buat SOP` is an episodic action, not a persistent dashboard panel.

Approved flow:

```text
Workspace
  -> + Buat SOP
       -> choose source
            -> AI
            -> Template
            -> Blank
       -> collect minimum creation input
       -> create draft
       -> navigate to existing core SOP editor
```

The current source capabilities remain:

- AI draft generation;
- system template preview/create;
- blank SOP create.

The exact interaction may be a dialog or drawer. It must be dismissible and consume no permanent workspace width when closed.

## Core Editor Boundary

The following area is protected from redesign scope:

`client/src/pages/penyusun/sop/detail/**`

The iteration must not change:

- SOP editing semantics;
- editor steps/content model;
- actor/procedure editing behavior;
- preview behavior;
- AI review/revision behavior inside the editor;
- completion semantics;
- versioning semantics.

Existing navigation into the editor may change only at the outer route/workspace layer. If implementation discovers that modifying editor internals is required, stop and re-review scope before making the change.

## Frontend Structure

`WorkspaceDetailPage.tsx` is currently large and combines data loading, catalog rendering, create-flow state, and modal rendering. This iteration may split workspace-only responsibilities into focused components without unrelated refactoring.

Recommended boundary:

```text
WorkspaceDetailPage
├── WorkspaceShell / WorkspaceSidebar
├── WorkspaceHeader
├── WorkspaceMetrics
├── SopCatalog
└── CreateSopDialog
    ├── CreateSourceSelector
    ├── AiCreatePanel
    ├── TemplateCreatePanel
    └── BlankCreatePanel
```

The page remains the orchestration boundary for workspace ID and query data unless extraction clearly improves testability.

## Backend Contract

Prefer reuse of current APIs:

- `GET /sop?workspaceId=...`
- `POST /sop`
- `GET /sop/templates`
- `GET /sop/templates/:id/preview`
- `POST /sop/templates/:id/create`
- `GET /sop/ai-drafts/availability`
- `POST /sop/ai-drafts/generate`
- `POST /sop/ai-drafts/create`

Backend changes are allowed only when required to support the approved workspace experience or deployment readiness. Do not redesign SOP domain services for visual reasons.

## Error and Loading Behavior

- Workspace and SOP list retain explicit loading/error states.
- Search/filter must remain client-responsive once list data is loaded.
- Create flows show source-specific validation and mutation errors.
- AI disabled/unavailable state must degrade to template/blank creation.
- A failed create must not navigate away or discard recoverable user input.

## Testing

At minimum:

1. workspace renders name, metrics, catalog, and `+ Buat SOP`;
2. sidebar does not contain `Review & Complete`;
3. search and status filtering behave correctly;
4. create source selector supports AI/template/blank;
5. successful creation navigates to existing SOP detail route;
6. no regression in existing editor tests;
7. existing E2E journeys remain green, with workspace selectors updated only where the approved UI changed.

## Non-Goals

- redesigning the core SOP editor;
- building a review inbox;
- introducing approval workflow across users;
- adding new SOP domain states only for the new UI;
- changing database schema for dashboard cosmetics;
- introducing a permanent create wizard sidebar.

## Acceptance Criteria

The design is complete when a user can enter a workspace, immediately understand that it contains many SOPs, browse/search/filter those SOPs, start creation from AI/template/blank, and continue into the unchanged core editor without the workspace navigation resembling a wizard.
