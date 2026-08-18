# Iteration 3 — Smart Template & Auto-Fill Design

Date: 2026-08-18
Status: DESIGN REVIEW
Branch: `feat/smart-template-auto-fill`

## 1. Context

Iteration 1 established the executable SOP authoring vertical slice: authenticated user, private workspace, SOP catalog, editable draft, autosave, Flowchart/BPMN rendering, completion, version cloning, print, and PDF. Iteration 2 hardened the same product for pragmatic MyPaaS deployment with Docker Compose, persistent MySQL/PDF storage, Prisma migrations, backup/restore, and production verification.

The next product gap is the reason this repository is named `sop-auto-fill`: creating a new SOP still begins from a mostly empty authoring state. The user must repeatedly enter similar structure, actors, supporting metadata, and procedure scaffolding even when the workspace already contains reusable information.

Iteration 3 therefore introduces a template-driven creation path that creates an ordinary editable SOP draft. It must not replace, fork, or redesign the existing editor. After draft creation, all existing authoring, autosave, diagram, completion, versioning, print, and PDF behavior remains the source of truth.

## 2. Goal

Reduce repetitive SOP setup by allowing a user to create a valid editable SOP draft from a system template and reusable workspace data.

Success means a user can:

1. open a private workspace;
2. choose `Buat SOP`;
3. choose either `Kosong` or a system template;
4. provide the minimum identity fields required for the new SOP;
5. preview/confirm reusable workspace data that will be applied;
6. create the draft transactionally;
7. land in the existing SOP editor with template content already populated;
8. edit, autosave, reload, render Flowchart/BPMN, complete, create a new version, print, and export PDF using the existing product behavior.

## 3. Non-Goals

Iteration 3 does not add:

- AI/LLM-generated procedure text;
- natural-language prompting;
- user-built template designer;
- template marketplace/sharing;
- organization collaboration or multi-user workspaces;
- approval, evaluation, TTE, public archive, OPD roles, or WhatsApp workflow;
- automatic modification of an existing SOP without explicit user action;
- automatic insertion of regulations merely because they exist in the user library.

Those are intentionally deferred so the iteration proves deterministic auto-fill first.

## 4. Considered Approaches

### Approach A — Hard-coded templates in frontend

The client owns template definitions and sends a fully expanded SOP payload to the existing API.

Advantages:
- fastest UI prototype;
- no new persistent template model.

Problems:
- business/template rules become client-owned;
- large nested payload crosses the trust boundary;
- server cannot independently validate a canonical template;
- changes to template structure require coordinating client behavior with server persistence;
- difficult to make template creation atomic with actor resolution and procedure references.

Rejected.

### Approach B — Code-defined templates in backend only

The backend stores immutable TypeScript template definitions and exposes them through an API.

Advantages:
- deterministic and server-owned;
- no template migration tables;
- low operational risk for a small fixed template set.

Problems:
- template content is coupled to application releases;
- future template administration requires a migration from code definitions to persistence;
- template identity/version history is less explicit.

Viable fallback, but not selected.

### Approach C — Persisted read-only system templates, instantiated by server transaction

The database stores system templates and their ordered steps. The API exposes templates as read-only catalog data. Creating from a template invokes one backend transaction that creates the SOP project, initial DetailSOP, resolves/reuses workspace actors, attaches swimlanes, writes ordered procedure steps, and applies deterministic template metadata.

Advantages:
- server remains authoritative;
- template data has stable IDs and explicit versioning;
- clean path to future user-defined templates without changing the draft creation contract;
- transactional instantiation protects partial drafts;
- no duplicate editor implementation.

Trade-off:
- requires a forward-only Prisma migration and seed/update strategy.

Selected.

## 5. Product Flow

The workspace SOP catalog keeps one primary `Buat SOP` action. Activating it opens a creation flow with two explicit sources:

- `SOP Kosong` — preserves current creation behavior;
- `Dari Template` — lists active system templates.

For a template draft, the user sees:

- template name and short purpose;
- number of initial steps;
- actors/swimlanes that will be reused or created in the workspace;
- prefilled lampiran categories, if any;
- required identity fields: title, SOP number, and institution name.

The user confirms creation. The server returns the newly created SOP/detail identifier. The client navigates to the existing editor route.

There is no separate "template editor mode" after creation. The result is a normal `DRAFT`.

## 6. Domain Model

Add two persisted models.

### `SopTemplate`

Represents a stable system template definition.

Fields:

- `templateId` UUID primary key;
- `key` unique stable machine identifier, for example `administrasi-umum`;
- `name` display name;
- `description` short user-facing purpose;
- `version` integer;
- `isActive` boolean;
- optional deterministic lampiran defaults stored as text fields or a normalized child structure only if existing repository conventions make normalization materially simpler;
- timestamps.

Iteration 3 templates are system-owned and read-only through product APIs. No `ownerId` is added yet.

### `SopTemplateStep`

Represents one ordered procedure step in a template.

Fields:

- `templateStepId` UUID primary key;
- `templateId` foreign key;
- `order` integer;
- `activity`;
- `type` compatible with `JenisLangkahProsedur`;
- `requirements`;
- `output`;
- `duration`;
- `durationUnit` compatible with `SatuanWaktu`;
- `notes`;
- `actorKey` string identifying a logical actor role within the template;
- optional yes/no target order references for decision steps.

The template does not store workspace `pelaksanaId` values. Template actor keys/names are resolved at instantiation time against the target workspace.

## 7. Workspace Reuse Rules

Auto-fill must be deterministic and conservative.

For template actors:

1. normalize the template actor display name for lookup using the same case/whitespace rules adopted by the workspace pelaksana service;
2. reuse an existing `Pelaksana` in the target workspace when the name matches;
3. otherwise create the missing workspace `Pelaksana`;
4. attach resolved actors as `DetailSOPPelaksana` in template order;
5. create each `LangkahSOP` using the resolved `pelaksanaId`.

This behavior is explicitly shown before confirmation so the user knows which actors will be reused or added.

Regulations (`Peraturan`) are not auto-attached in Iteration 3. The existing user regulation library remains available in the editor. This prevents a deterministic template from making legal assumptions that may be incorrect for a specific SOP.

## 8. Server Architecture

Add a focused template module rather than expanding unrelated catalog responsibilities.

Suggested boundary:

- `sop/template/sop-template.controller.ts`
- `sop/template/sop-template.service.ts`
- `sop/template/sop-template.repository.ts`
- DTOs/mappers colocated under the template module.

Responsibilities:

### Template repository

- list active system templates;
- fetch one active template with ordered steps;
- expose the minimum data required by the service;
- persist no user mutation API.

### Template service

- assert workspace ownership through the existing `WorkspaceService`;
- validate template availability;
- build a creation plan/preview describing actors to reuse/create;
- instantiate a draft through one transaction;
- translate template decision targets from template step order/IDs to newly created `LangkahSOP` IDs.

### SOP catalog integration

The existing blank creation path remains owned by `SopCatalogService.createForPenyusun`.

Template creation may share a small internal draft-creation primitive with the catalog repository/service if duplication appears, but the iteration must not refactor the entire catalog merely to introduce templates.

## 9. API Contract

Minimum API surface:

### `GET /api/sop/templates`

Returns active template summaries.

Each item includes:

- `templateId`;
- `key`;
- `name`;
- `description`;
- `version`;
- `stepCount`;
- actor names.

### `GET /api/sop/templates/:templateId/preview?workspaceId=...`

Returns the deterministic instantiation preview for the owned workspace:

- template summary;
- actors to reuse;
- actors to create;
- step count;
- lampiran defaults that will be copied.

No mutation occurs.

### `POST /api/sop/templates/:templateId/create`

Body:

- `workspaceId`;
- `judul`;
- `nomorSop`;
- `namaLembaga`.

Behavior:

- verify authenticated workspace ownership;
- verify template active;
- instantiate atomically;
- return the same catalog/workbench-friendly identity shape used by current creation/navigation.

Blank creation continues to use the existing endpoint/contract.

## 10. Transactional Instantiation

Template instantiation must be all-or-nothing.

Within a single Prisma transaction:

1. create `SOP` with `DRAFT` status;
2. create initial `DetailSOP` version 1;
3. resolve/reuse/create required workspace `Pelaksana` records;
4. create `DetailSOPPelaksana` rows in deterministic order;
5. copy template lampiran defaults;
6. create procedure steps without decision references first;
7. build a map from template step identity/order to new `langkahSopId`;
8. update decision yes/no references using that map;
9. leave Flowchart/BPMN configuration to existing default rendering behavior unless the template explicitly requires a supported deterministic configuration later.

On any failure the transaction rolls back, including newly created actors. The user must never receive a partially populated SOP.

## 11. Template Seed Strategy

The migration creates the template tables. Template content is inserted through an idempotent production-safe seed/bootstrap mechanism, not by destructive database reset.

Initial template set is deliberately small:

1. `Administrasi Umum`;
2. `Pengelolaan Dokumen`;
3. `Pelayanan`.

A blank SOP is not stored as a template because the existing blank creation path is already the canonical implementation.

Seed identifiers/keys must be stable so future releases can update system templates without duplicating them. Existing user SOP drafts are never rewritten when a template definition changes.

## 12. Client Architecture

The client adds a creation modal/page layer around the current workspace catalog. It does not alter the editor architecture.

Suggested components:

- source selection (`Kosong` / `Dari Template`);
- template catalog cards/list;
- template preview summary;
- shared identity form fields used by both blank and template creation;
- creation mutation hook.

The UI must clearly distinguish "template suggestion" from actual saved SOP data. Nothing is written until the user confirms creation.

After success, navigation enters the existing detail/workbench route and all existing components take over.

## 13. Error Handling

Expected product errors:

- template not found/inactive -> 404-like user message;
- workspace not owned -> same non-disclosing ownership behavior as current workspace/SOP APIs;
- duplicate SOP number -> current conflict semantics reused;
- actor/template integrity problem -> creation fails and transaction rolls back;
- network/server failure -> creation dialog remains recoverable and does not claim a draft was created.

The client should invalidate workspace SOP/template queries only after confirmed success.

## 14. Testing Strategy

Implementation uses TDD.

### Server unit tests

Cover:

- active template listing;
- ownership enforcement;
- preview actor reuse/create classification;
- inactive/missing template;
- duplicate SOP number mapping;
- decision-target remapping;
- no regulation auto-attachment;
- rollback/error propagation contract.

### Database integration tests

Use real MySQL + Prisma migration history to prove:

- migration applies from current production baseline;
- seed is idempotent;
- existing workspace actor is reused;
- missing actor is created once;
- full template graph is persisted correctly;
- decision references point only to newly created steps;
- failure leaves no partial SOP/DetailSOP/actor rows;
- blank creation behavior remains unchanged.

### Client tests

Cover:

- source selection;
- template loading/empty/error states;
- preview of reuse/create actors;
- confirmation payload;
- navigation to existing editor after success;
- blank creation regression.

### Playwright acceptance journey

Add one focused journey:

`Login -> Workspace -> Buat SOP -> Dari Template -> preview -> create -> existing editor -> verify prefilled metadata/steps -> edit -> autosave -> reload -> verify Flowchart/BPMN -> Complete -> Create New Version`.

The existing MVP blank-SOP journey remains mandatory and must stay green.

## 15. Migration and Release Safety

This iteration adds schema but must be additive only:

- create new template tables/indexes/foreign keys;
- do not alter or delete existing authoring tables;
- do not rewrite existing SOP data;
- migration must pass the existing production Compose migration/idempotence checks;
- backup/restore behavior from Iteration 2 remains mandatory.

Because this introduces a production migration, final merge requires explicit review under repository high-risk rules even when CI is green.

## 16. Acceptance Criteria

Iteration 3 is complete only when:

1. the three initial system templates are available after a fresh and existing-database deployment;
2. a user can create a blank SOP exactly as before;
3. a user can inspect a template before mutation;
4. template creation reuses matching workspace actors and creates only missing actors;
5. generated SOP content is a normal editable `DRAFT`;
6. no regulations are silently attached;
7. template creation is transactional and cannot leave a partial SOP;
8. existing editor, autosave, Flowchart, BPMN, completion, version cloning, print, and PDF continue to work;
9. server/client tests, database integration, existing MVP E2E, new template E2E, and production Compose checks are green;
10. implementation documentation explains the deterministic auto-fill boundary and explicitly defers AI assistance.

## 17. Deferred Iteration 4

After deterministic Smart Template & Auto-Fill is proven, a separate iteration may add AI-assisted drafting. AI output should be treated as suggestions that require user confirmation and should build on the exact same normal `DRAFT` model rather than introducing a parallel editor or lifecycle.