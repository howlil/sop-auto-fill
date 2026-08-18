# Iteration 3 — Smart Template & Auto-Fill Design

Date: 2026-08-18
Status: DESIGN REVIEW
Branch: `feat/smart-template-auto-fill`

## 1. Context

Iteration 1 established the executable SOP authoring vertical slice: authenticated user, private workspace, SOP catalog, editable draft, autosave, Flowchart/BPMN rendering, completion, version cloning, print, and PDF. Iteration 2 hardened that product for MyPaaS deployment with Docker Compose, persistent MySQL/PDF storage, Prisma migrations, backup/restore, and production verification.

The remaining product gap is the core promise of `sop-auto-fill`: a new SOP still begins from a mostly empty authoring state. Iteration 3 adds deterministic template-driven creation while preserving the existing editor and lifecycle as the only authoring implementation after creation.

## 2. Goal and Success Flow

Reduce repetitive SOP setup by allowing a user to create a normal editable `DRAFT` from a read-only system template plus reusable workspace actors.

The target flow is:

`Login -> Workspace -> Buat SOP -> SOP Kosong / Dari Template -> Template Preview -> Isi identitas -> Konfirmasi -> Existing SOP Editor`

For template creation, success means the user can preview what will be reused or created, confirm once, receive a complete draft transactionally, and then continue through the existing autosave, reload, Flowchart/BPMN, Complete, Create New Version, print, and PDF behavior.

## 3. Non-Goals

Iteration 3 does not add:

- AI/LLM-generated text or natural-language prompting;
- user-built template designer or template sharing;
- multi-user collaboration;
- approval/evaluation/TTE/public archive/OPD roles/WhatsApp;
- automatic changes to existing SOPs;
- automatic attachment of regulations from the user's regulation library.

AI assistance is deferred until deterministic auto-fill is proven.

## 4. Considered Approaches

### A. Frontend-owned template payloads

Fastest prototype, but rejected because canonical business/template data would cross the trust boundary from client to server and atomic actor/step creation would become harder to validate.

### B. Backend code-defined templates

Deterministic and low-migration, but template content would be coupled to application releases and a later move to manageable templates would require replacing the storage contract.

### C. Persisted read-only system templates + transactional server instantiation

Selected. The database owns template definitions; product APIs expose them read-only; one server transaction creates the ordinary SOP draft. This keeps the server authoritative, gives stable template identity/versioning, and leaves a clean future path to user-defined templates without changing the draft creation contract.

## 5. Product Behavior

The existing workspace SOP catalog keeps a single primary `Buat SOP` action. The creation surface offers two sources:

- `SOP Kosong`: invokes the existing blank creation path unchanged;
- `Dari Template`: loads active system templates.

A template preview shows:

- template name, description, and version;
- initial step count;
- actor names in first-use order;
- actors that already exist in the workspace;
- actors that will be added to the workspace;
- non-empty lampiran defaults.

The identity form contains the existing required creation values: `judul`, `nomorSop`, and `namaLembaga`.

Nothing is persisted until the user confirms. After successful creation the client navigates to the existing SOP editor. There is no separate template editor mode.

## 6. Exact Domain Model

Iteration 3 adds exactly two persisted template models.

### `SopTemplate`

Fields:

- `templateId String @id @default(uuid()) @db.Char(36)`
- `key String @unique @db.VarChar(120)`
- `name String @db.VarChar(255)`
- `description String @db.VarChar(500)`
- `version Int`
- `isActive Boolean @default(true)`
- `peringatan Json`
- `kualifikasiPelaksanaan Json`
- `peralatanPerlengkapan Json`
- `pencatatanPendataan Json`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `steps SopTemplateStep[]`

The four JSON fields are arrays of strings. They are validated at the template mapper/service boundary before use. They avoid four extra template-only attachment tables while matching the existing DetailSOP lampiran collections during instantiation.

System templates have no `ownerId` in Iteration 3 and have no product mutation endpoints.

### `SopTemplateStep`

Fields:

- `templateStepId String @id @default(uuid()) @db.Char(36)`
- `templateId String @db.Char(36)`
- `urutan Int`
- `kegiatan String @db.VarChar(500)`
- `jenis JenisLangkahProsedur @default(KEGIATAN)`
- `kelengkapan String @db.VarChar(500)`
- `keluaran String @db.VarChar(500)`
- `waktu Int`
- `satuanWaktu SatuanWaktu`
- `keterangan String @db.VarChar(500)`
- `actorName String @db.VarChar(255)`
- `targetYaUrutan Int?`
- `targetTidakUrutan Int?`
- timestamps and relation to `SopTemplate`

Constraints/indexes:

- `@@unique([templateId, urutan])`
- `@@index([templateId])`

Template actors are represented by `actorName` on steps. The unique actor list and swimlane order are derived from first occurrence in ascending step order. An actor that has no procedure step is out of scope for system templates in Iteration 3.

Decision targets reference template step order, not database IDs. During instantiation they are remapped to newly created `langkahSopId` values.

## 7. Deterministic Workspace Reuse Rules

For each unique `actorName` derived from the template:

1. trim leading/trailing whitespace;
2. compare against target workspace `Pelaksana.nama` using the same normalization used by the existing pelaksana service/repository; if the current service has no centralized normalization helper, extract one only for the touched path rather than refactoring unrelated code;
3. reuse a matching workspace actor;
4. otherwise create exactly one missing workspace actor;
5. attach resolved actors as `DetailSOPPelaksana` in first-use order;
6. create each `LangkahSOP` with the resolved actor ID.

The preview endpoint uses the same resolver logic in read-only mode so preview and creation cannot disagree by design.

`Peraturan` records are never auto-attached in Iteration 3. They remain available through the existing editor.

## 8. Server Boundaries

Add a focused template submodule under the existing SOP module:

- `server/src/modules/sop/template/sop-template.controller.ts`
- `sop-template.service.ts`
- `sop-template.repository.ts`
- template DTOs/mappers/specs beside them.

The repository lists/fetches active templates and performs the instantiation transaction. The service owns workspace authorization, template availability validation, preview classification, duplicate-number error mapping, and orchestration.

The existing `SopCatalogService.createForPenyusun` remains the canonical blank creation path. A small shared internal helper may be extracted only if needed to avoid duplicating creation invariants; Iteration 3 must not refactor the whole catalog.

## 9. Controller-Relative API Contract

The application already mounts SOP routes under `@Controller('sop')`; therefore the new controller-relative routes are:

### `GET /sop/templates`

Returns active template summaries:

- `templateId`, `key`, `name`, `description`, `version`;
- `stepCount`;
- ordered unique `actorNames`.

### `GET /sop/templates/:templateId/preview?workspaceId=<uuid>`

Requires authentication and owned workspace. Returns:

- template summary;
- `actorsToReuse`;
- `actorsToCreate`;
- step count;
- non-empty lampiran defaults.

No mutation occurs.

### `POST /sop/templates/:templateId/create`

Body:

- `workspaceId`;
- `judul`;
- `nomorSop`;
- `namaLembaga`.

Returns the newly created SOP/catalog identity needed for navigation. It reuses current conflict semantics for duplicate SOP numbers and current non-disclosing ownership behavior for inaccessible workspaces.

Blank creation continues through the existing `POST /sop` contract.

## 10. Transactional Instantiation

One Prisma transaction performs all mutation:

1. validate template integrity before writes;
2. create `SOP` with `DRAFT` status;
3. create initial `DetailSOP` version 1;
4. resolve/reuse/create required workspace `Pelaksana` rows;
5. create ordered `DetailSOPPelaksana` rows;
6. materialize each non-empty template lampiran string into the matching existing lampiran table;
7. create all `LangkahSOP` rows first with decision references unset;
8. build `template urutan -> new langkahSopId` map;
9. update `langkahSelanjutnyaYaId` / `langkahSelanjutnyaTidakId` using that map;
10. return the created draft identity.

Any error rolls the transaction back, including actors created solely by this operation. No partial SOP is allowed.

Flowchart/BPMN config is not stored in templates in Iteration 3. Existing default rendering derives diagrams from the generated steps; users may edit diagram configuration afterward through the current editor.

## 11. Template Seed Contract

The migration is additive and creates only the new template tables/indexes/foreign keys.

System template data is installed through an idempotent production-safe upsert seed/bootstrap path with stable `key` values. Re-running deployment must not duplicate templates or steps. Updating a template definition affects future creations only; existing SOPs are never rewritten.

Initial template keys:

1. `administrasi-umum`
2. `pengelolaan-dokumen`
3. `pelayanan`

`SOP Kosong` is not persisted as a template because the existing blank creation path is already canonical.

## 12. Client Boundaries

Add only a creation layer around the workspace catalog:

- source selector (`SOP Kosong` / `Dari Template`);
- active template list;
- preview panel;
- shared identity fields;
- template-create query/mutation hooks.

The editor itself is not forked or redesigned. After creation, the same existing route/components own all authoring.

The UI must label reuse/create actor information as a preview and must not imply anything has been saved before confirmation.

## 13. Error Handling

Expected behavior:

- missing/inactive template: not-found response;
- inaccessible workspace: same non-disclosing behavior as existing workspace/SOP APIs;
- duplicate SOP number: existing conflict message semantics;
- malformed seeded template or invalid decision target: fail before mutation where possible, otherwise rollback transaction;
- network/server failure: keep the creation surface recoverable and do not navigate or claim success.

Queries are invalidated only after confirmed creation.

## 14. TDD and Verification

### Server unit tests

Prove active listing, ownership, preview reuse/create classification, missing/inactive template handling, duplicate number mapping, template JSON validation, decision-target validation/remapping, and no regulation auto-attachment.

### Database integration tests

Against real MySQL + migration history prove:

- additive migration applies from the current production baseline;
- seed/upsert is idempotent;
- matching actor is reused;
- missing actor is created once;
- template lampiran/steps/swimlanes persist correctly;
- decision references point only to the newly created detail's steps;
- forced failure leaves no partial SOP/detail/new actor;
- blank creation remains unchanged.

### Client tests

Prove source selection, template loading states, preview classification display, confirmation payload, success navigation, error recovery, and blank creation regression.

### Playwright acceptance

Add one template journey:

`Login -> Workspace -> Buat SOP -> Dari Template -> Preview -> Create -> Existing Editor -> verify prefill -> edit -> autosave -> reload -> Flowchart/BPMN -> Complete -> Create New Version`.

The existing blank-SOP MVP journey remains mandatory.

### Production verification

Existing production Compose checks remain mandatory, including migration deploy/idempotence, persistence, readiness, backup, and restore.

## 15. Migration and Merge Safety

This is an additive schema change only. It must not drop/alter current authoring tables or rewrite existing SOP data.

Because the iteration introduces a production migration, final merge is high-risk under `AGENTS.md`: all tests and mandatory CI must be green, but merge still requires explicit review rather than automatic merge.

## 16. Acceptance Criteria

Iteration 3 is complete only when:

1. all three system templates are available after fresh and existing-database deployment;
2. blank SOP creation behaves exactly as before;
3. template preview performs no writes;
4. preview and creation classify actors consistently;
5. matching workspace actors are reused and only missing actors are created;
6. template creation is all-or-nothing;
7. generated content is an ordinary editable `DRAFT`;
8. regulations are never silently attached;
9. existing editor/autosave/Flowchart/BPMN/completion/versioning/print/PDF remain green;
10. server, client, DB integration, blank MVP E2E, template E2E, and production Compose verification are green.

## 17. Deferred Iteration 4

AI-assisted drafting may be designed only after this deterministic creation path is complete. Any future AI output should remain a user-reviewed suggestion that ultimately produces/updates the same normal `DRAFT`, not a parallel lifecycle.