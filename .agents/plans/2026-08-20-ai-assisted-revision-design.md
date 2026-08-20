# Iteration 6 Design — AI-Assisted SOP Revision

**Date:** 2026-08-20  
**Iteration:** `6-ai-assisted-revision`  
**Branch:** `feat/ai-assisted-revision`  
**Status:** DESIGN SPEC REVIEW  
**Base:** Iteration 5 merge commit `8881d1888599ff1413fd6a454d2a1ba1ca844811`

## 1. Context and Goal

Iteration 3 introduced templates, Iteration 4 added AI-assisted draft generation, and Iteration 5 added server-authoritative AI quality review for persisted SOP `DRAFT` snapshots. Iteration 6 adds the next bounded authoring capability: turn a selected review finding into one textual revision proposal that the user can inspect and explicitly apply.

The feature remains inside the existing SOP-authoring scope. It does not restore approval/evaluation/TTE/public archive workflows and does not introduce collaboration, regulation retrieval, or compliance certification.

Primary flow:

```text
SOP DRAFT
  -> AI Review
  -> select revision-eligible finding
  -> Sarankan Perbaikan
  -> autosave must succeed
  -> server loads authoritative persisted snapshot
  -> AI returns one constrained proposal
  -> server validates target and proposed text
  -> before/after preview
  -> Batal or Terapkan
  -> Terapkan updates existing client editor state only
  -> existing autosave persists change
  -> old review/revision state becomes stale and clears
  -> user may run AI Review again
```

## 2. Core Invariants

1. AI never silently mutates a SOP.
2. There is no AI revision application/write endpoint.
3. The suggestion endpoint performs no application create/update/delete.
4. Persistence remains exclusively through existing editor autosave behavior.
5. The server loads the persisted `DRAFT` snapshot after client autosave succeeds.
6. Browser-supplied finding data and provider output are both untrusted.
7. One request produces at most one allowed textual edit.
8. Structural, identity, routing, timing, lifecycle, and actor changes are prohibited.
9. A stale suggestion cannot be applied.
10. A revision is advisory, not approval, compliance certification, or legal guidance.

## 3. Allowed Revision Surface

Iteration 6 can change exactly one of these existing textual values per accepted proposal:

- SOP title;
- one existing `peringatan` item;
- step `kegiatan`;
- step `kelengkapan`;
- step `keluaran`;
- step `keterangan`.

It cannot modify:

- SOP number;
- organization/institution identity;
- version or status;
- actor/pelaksana/swimlane membership or order;
- step count or order;
- step type;
- decision yes/no routing;
- duration or time unit;
- regulation/related-SOP relations;
- qualification, equipment, or recordkeeping list structure;
- completion or version-cloning state.

No list item, actor, or step may be created/deleted by AI revision.

## 4. Findings that Remain Manual

`Sarankan Perbaikan` is not shown for findings whose safe fix requires protected or structural changes.

The following categories remain manual in Iteration 6:

- `PROCESS_STRUCTURE`;
- `ACTOR_RESPONSIBILITY`;
- `DECISION_ROUTING`;
- `TIME_PLAUSIBILITY`.

Actor-located findings and findings outside the allowed textual surface also remain manual. The UI should state that these findings must be edited manually rather than implying AI can repair them safely.

## 5. Browser Trust Refinement

The approved high-level design initially described a request containing `detailSopId + finding + target field`.

The implementation contract is intentionally stricter:

```text
detailSopId + finding
```

The browser does not nominate an arbitrary field. The provider proposes one target from a strict schema and the server validates that target against a deterministic allowlist derived from the finding and authoritative snapshot.

This refinement reduces browser authority and makes protected-field bypass harder.

## 6. Revision Target Contract

```ts
type SopAiRevisionTarget =
  | { kind: 'HEADER'; field: 'JUDUL' }
  | { kind: 'PERINGATAN'; itemIndex: number }
  | {
      kind: 'STEP'
      stepOrder: number
      field: 'KEGIATAN' | 'KELENGKAPAN' | 'KELUARAN' | 'KETERANGAN'
    }
```

Normative index semantics:

- `itemIndex` is a **0-based** index into the authoritative persisted `peringatan` array and must refer to an existing item;
- `stepOrder` is the existing **1-based** human-visible procedure order used by Iteration 5 findings;
- no database ID appears in the provider/client revision contract.

## 7. Finding-to-Target Allowlist

The server derives allowed targets conservatively.

### HEADER

- `HEADER + CLARITY` -> `HEADER/JUDUL` only.
- All other header findings remain manual because they may concern protected identity fields.

### PERINGATAN

For location `PERINGATAN`:

- `CLARITY`, `SUPPORTING_FIELD`, or `COMPLETENESS` may revise one already-existing warning item;
- if the warning list is empty, or the correct fix requires adding/removing items, the finding remains manual.

### STEP

For a `STEP` location:

- `CLARITY` -> `KEGIATAN` or `KETERANGAN`;
- `INPUT_OUTPUT` -> `KELENGKAPAN` or `KELUARAN`;
- `COMPLETENESS` -> one of `KEGIATAN`, `KELENGKAPAN`, `KELUARAN`, `KETERANGAN`;
- `SUPPORTING_FIELD` -> `KETERANGAN`;
- all other categories remain manual.

The provider can choose only among candidates derived by this allowlist. Application validation is authoritative.

## 8. API

### 8.1 Availability

```http
GET /sop/ai-revisions/availability
```

```json
{ "enabled": true }
```

AI Draft, AI Review, and AI Revision remain independently configurable.

### 8.2 Suggest

```http
POST /sop/:detailSopId/ai-revisions/suggest
```

Request:

```ts
interface SuggestAiRevisionRequest {
  finding: SopQualityFinding
}
```

Response:

```ts
interface SuggestAiRevisionResponse {
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

`before` is always read by application code from the authoritative snapshot after target canonicalization. The provider never gets authority to assert the source value.

There is intentionally no `/apply` endpoint.

## 9. Shared Authoritative Snapshot Boundary

Iteration 5 already has a read-only repository dedicated to loading the authoritative SOP snapshot for AI Review. Iteration 6 needs the same ownership/status/content snapshot.

To avoid two near-identical database queries drifting, Iteration 6 should perform a targeted internal extraction, for example:

```text
server/src/modules/sop/ai-common/
  sop-ai-snapshot.repository.ts
  sop-ai-snapshot.types.ts
```

AI Review and AI Revision then consume the shared read-only snapshot boundary. The refactor must preserve Iteration 5 API/provider behavior and must not change Prisma schema or persistence semantics.

## 10. Server Revision Module

Planned subsystem:

```text
server/src/modules/sop/ai-revision/
  sop-ai-revision.module.ts
  sop-ai-revision.controller.ts
  sop-ai-revision.service.ts
  sop-ai-revision.schema.ts
  sop-ai-revision.types.ts
  dto/
  providers/
    ai-revision-provider.ts
    disabled-ai-revision.provider.ts
    fake-ai-revision.provider.ts
    openai-ai-revision.provider.ts
```

Service sequence is fixed:

1. provider mode must be enabled;
2. request finding schema is validated;
3. authoritative SOP context is loaded by `detailSopId`;
4. missing SOP -> not found;
5. JWT owner mismatch -> forbidden;
6. non-`DRAFT` -> conflict;
7. safe target candidates are derived from finding + snapshot;
8. zero candidates -> reject without provider call;
9. provider-safe context is built;
10. provider is invoked;
11. raw output is parsed as untrusted data;
12. target is canonicalized against snapshot;
13. target must belong to the server-derived candidate set;
14. `before` is read from snapshot;
15. `after` is validated against the same limits expected by existing editor/API fields;
16. normalized no-op (`after == before`) is rejected;
17. one transient proposal is returned.

No application persistence mutation occurs in this sequence.

## 11. Provider-Safe Input

Revision provider context may include only what is useful for wording consistency:

- version number;
- title;
- warning values;
- actor names/order without IDs;
- steps using human-visible order, textual fields, type, actor name, and human-visible decision target order;
- validated finding.

It must omit:

- `detailSopId`;
- user/workspace/SOP database IDs;
- actor/internal step IDs;
- email;
- JWT/cookies/tokens;
- audit logs;
- unrelated SOPs;
- API keys/provider secrets;
- official SOP number;
- organization identity.

The provider instructions treat SOP and finding text as untrusted data, not executable instructions.

## 12. Provider Output and Validation

Conceptual provider output:

```ts
interface AiRevisionProviderResult {
  target: SopAiRevisionTarget
  after: string
  rationale: string
}
```

Validation requires:

- exactly one target;
- only documented discriminator/field enums;
- bounded `after` and `rationale`;
- non-empty trimmed `after`;
- existing `itemIndex` or `stepOrder`;
- target allowed for the current finding;
- output compatible with existing field constraints;
- no protected/structural change;
- no no-op rewrite.

Invalid provider output becomes a sanitized 422-style application error and never reaches editor state.

## 13. OpenAI Runtime Contract

New configuration:

```text
AI_REVISION_PROVIDER=disabled|openai|fake
AI_REVISION_TIMEOUT_MS=30000
```

Rules:

- default provider: `disabled`;
- timeout range: `5000..60000` ms, default `30000`;
- `openai` requires existing server-side `OPENAI_API_KEY` and `OPENAI_MODEL`;
- `fake` is rejected in `NODE_ENV=production`;
- production example/Compose documents revision variables;
- production remains disabled by default.

OpenAI adapter follows the established backend-only Responses API pattern:

- Node 22 native `fetch`;
- server-only Bearer key;
- `store: false`;
- strict JSON Schema Structured Outputs;
- no tools;
- no web/file retrieval;
- abort timeout;
- sanitized 429/network/refusal/invalid-output errors;
- no prompt, API key, or full provider-response logging.

Provider instructions explicitly forbid inventing regulations/citations/official identity and forbid changing actors, routing, timing, structure, or lifecycle state.

## 14. Client Revision State

Add a transient revision hook colocated with the existing review hook, for example:

```text
client/src/pages/penyusun/sop/hooks/use-ai-sop-revision.ts
```

It owns:

- revision availability;
- selected eligible finding;
- running state;
- proposal preview;
- sanitized error;
- request/staleness guards.

No proposal is stored in browser persistence or database.

Before a suggestion request:

1. SOP is editable `DRAFT`;
2. revision provider is available;
3. selected finding belongs to the currently displayed review and is client-eligible;
4. `flushAllAutosave()` returns `true`;
5. the hook captures current `detailSopId`, editor `contentFingerprint`, and deterministic finding identity;
6. a response is accepted only if those identities still match.

Server validation remains authoritative even if client eligibility logic is bypassed.

## 15. Deterministic Finding and Review Identity

Iteration 5 findings do not currently contain persisted IDs. Iteration 6 must not invent database IDs just to track transient UI state.

The client computes a deterministic `findingFingerprint` from the canonical finding fields:

```text
severity + category + canonical location + title + explanation + recommendation
```

using stable serialization.

A revision request also captures the editor `contentFingerprint` associated with the currently accepted review. Together:

```text
(detailSopId, reviewContentFingerprint, findingFingerprint)
```

form the transient request identity.

If editor content changes, the existing review clears. Any in-flight revision response whose captured identity no longer matches is discarded. No finding/review ID is persisted.

## 16. Before/After Preview

A revision-eligible finding shows `Sarankan Perbaikan`.

Successful response renders:

```text
Target: Langkah 3 · Output

Sebelum
<server-authoritative value>

Usulan
<AI proposed value>

<short rationale>

[Batal] [Terapkan]
```

Manual-only findings retain their existing navigation behavior and indicate that they require manual correction.

No `Fix all` action exists.

## 17. Apply Semantics

`Terapkan` never calls a revision write endpoint.

The client must:

1. verify current `detailSopId == sourceDetailSopId`;
2. resolve target from the current editor state;
3. verify current target value still equals response `before`;
4. if not equal, mark proposal stale and refuse apply;
5. update exactly that existing React editor field using existing metadata/procedure setters;
6. clear the revision proposal;
7. clear the previous AI Review because content changed;
8. let existing autosave persist the change;
9. rely on existing autosave conflict/error handling as the final persistence guard.

This makes accepted AI revision equivalent to a user manually replacing one existing text value.

`Batal` discards the transient proposal and performs zero editor mutation.

## 18. Concurrency and Staleness

A proposal becomes stale when any of these no longer match the request:

- `detailSopId`;
- editor `contentFingerprint`;
- `findingFingerprint` / current review identity;
- target's exact current value versus server-returned `before`.

The client discards stale network responses and blocks stale apply.

If another writer changes the database after suggestion generation, existing autosave/optimistic-locking behavior remains the final persistence concurrency boundary.

## 19. Error Contract

Expected sanitized behavior:

- provider disabled -> revision unavailable;
- SOP missing -> not found;
- owner mismatch -> forbidden;
- non-DRAFT -> conflict;
- ineligible finding -> safe validation error without provider call;
- autosave failure -> request not sent;
- timeout/rate-limit/network -> retryable generic message;
- provider refusal/invalid output -> regenerate suggestion message;
- invalid target/index/order/no-op -> safe 422-style message;
- content changed during request -> stale response discarded;
- target changed before apply -> apply blocked and regenerate required.

Raw upstream provider errors/bodies are never exposed to the browser.

## 20. Security and Privacy

Security invariants:

- authenticated endpoint;
- server-side owner check before provider invocation;
- only `DRAFT` can request revision;
- finding is schema-validated untrusted browser data;
- browser cannot choose arbitrary target;
- provider has no application write capability;
- provider input has no DB IDs or credentials;
- provider has no tools/retrieval;
- provider output cannot escape the allowlist;
- `before` is derived from application state;
- no revision history/prompt/job persistence;
- fake provider cannot run in production.

## 21. No Database Migration

Iteration 6 adds no Prisma model/table/column/index.

There is no persisted:

- revision request;
- revision result;
- AI conversation;
- review-to-revision link;
- provider response history;
- background job.

Normal SOP edit/audit behavior caused by existing autosave remains unchanged.

## 22. UI Integration

The current `AI Review` side panel is extended instead of adding a new top-level editor mode.

Finding states:

- manual-only -> normal navigation + manual-edit explanation;
- eligible -> normal navigation + `Sarankan Perbaikan`;
- requesting -> finding-local loading state, duplicate request blocked;
- proposal ready -> target + before/after + rationale + `Batal`/`Terapkan`;
- after apply -> proposal/review clear and editor focuses affected field when practical.

Completed/read-only SOP never exposes revision action. A newly cloned DRAFT version may use review/revision again.

## 23. Testing Strategy

TDD is required.

Server tests cover:

- shared authoritative snapshot extraction without AI Review regression;
- request finding schema;
- target/output schema;
- disabled/not-found/owner/DRAFT gate order;
- ineligible finding rejects before provider invocation;
- provider-safe input strips IDs/secrets/protected identity;
- allowlist mapping;
- authoritative `before`;
- invalid warning index/step order/field;
- no-op rejection;
- OpenAI timeout/rate-limit/refusal/invalid-output sanitization;
- env validation and production fake rejection.

Client tests cover:

- availability;
- CTA only for eligible findings;
- autosave gate;
- deterministic finding identity;
- before/after preview;
- cancel leaves editor unchanged;
- apply changes exactly one allowed field;
- apply clears review/revision;
- apply uses no revision persistence endpoint;
- stale network response discard;
- stale `before` apply block;
- read-only/completed state;
- protected targets impossible through client contract.

## 24. E2E Acceptance

New fake-provider journey:

```text
create/open DRAFT
  -> edit + autosave
  -> AI Review
  -> receive eligible finding
  -> Sarankan Perbaikan
  -> verify target + before/after
  -> Batal and verify unchanged
  -> request again
  -> Terapkan
  -> wait existing autosave success
  -> verify old review cleared
  -> reload and verify revised text persisted
  -> AI Review again
  -> Flowchart/BPMN still render
  -> complete SOP
  -> review/revision actions hidden
  -> create version 2
  -> new DRAFT remains editable/reviewable
```

Acceptance also proves a decision-routing finding remains manual and protected fields cannot be revised.

Existing blank/template/AI-draft/AI-review lifecycle journeys must remain green.

## 25. CI and Production Contract

Mandatory CI remains:

1. server typecheck/tests/build;
2. client typecheck/tests/build;
3. Playwright against disposable MySQL;
4. production Compose/deploy/backup/restore contract.

E2E may enable:

```text
AI_DRAFT_PROVIDER=fake
AI_REVIEW_PROVIDER=fake
AI_REVISION_PROVIDER=fake
```

Production must prove:

- revision provider defaults disabled;
- fake is rejected in production;
- no new public service/port;
- deployment/persistence/backup/restore contracts remain intact.

## 26. Explicit Non-Goals

Iteration 6 excludes:

- automatic or silent fixes;
- bulk `Fix all`;
- add/delete/reorder steps;
- actor/swimlane mutation;
- decision-routing mutation;
- timing mutation;
- SOP-number/organization-identity mutation;
- automatic completion;
- persisted AI revision/history/chat;
- background queue;
- agents/tool calling;
- RAG/regulation lookup/web/file search;
- compliance scoring/certification;
- approval/evaluation/TTE/public archive;
- collaboration/multi-owner;
- model selector;
- Prisma migration.

## 27. Completion Criteria

Iteration 6 is implementation-complete only when:

1. only safe findings offer revision;
2. autosave succeeds before suggestion request;
3. server uses authoritative persisted DRAFT snapshot;
4. authentication/ownership/DRAFT gates precede provider invocation;
5. provider input contains no DB IDs, credentials, audit logs, unrelated SOPs, SOP number, or organization identity;
6. provider can target only the server allowlist;
7. response `before` is application-derived;
8. user must inspect preview and explicitly apply;
9. cancel causes zero mutation;
10. apply changes exactly one allowed existing client field;
11. persistence uses existing autosave only;
12. no revision apply endpoint/table exists;
13. stale response and stale apply are blocked;
14. completed SOP remains immutable;
15. AI Review remains regression-green after shared snapshot extraction;
16. blank/template/AI-draft/AI-review/AI-revision E2E all pass;
17. Flowchart/BPMN/completion/versioning remain intact;
18. production defaults revision disabled and rejects fake;
19. no Prisma migration exists.

## 28. Merge Gate

Iteration 6 extends the external AI provider surface and introduces explicit user-approved application of AI text into editor state. Final squash merge therefore requires:

- mandatory CI green on final code-bearing head;
- no unresolved review blocker;
- focused audit of provider-safe input;
- focused audit of protected-target allowlist;
- focused audit confirming no direct AI persistence path;
- explicit user final merge approval.

Do not start Iteration 7 automatically after merge.
