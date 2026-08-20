# Iteration 6 Design — AI-Assisted SOP Revision

**Date:** 2026-08-20  
**Iteration:** `6-ai-assisted-revision`  
**Branch:** `feat/ai-assisted-revision`  
**Status:** DESIGN SPEC REVIEW  
**Base:** Iteration 5 merge commit `8881d1888599ff1413fd6a454d2a1ba1ca844811`

## 1. Context

Iteration 3 introduced system templates, Iteration 4 added AI-assisted draft generation, and Iteration 5 added server-authoritative AI quality review for persisted SOP `DRAFT` snapshots. The product now helps a user start a SOP and identify quality findings, but remediation is still entirely manual.

Iteration 6 adds a narrow assistance layer between a quality finding and the existing editor: the user may request one bounded textual revision suggestion, inspect a before/after preview, and explicitly apply it into the existing client editor state. The AI provider never receives a direct application write path and never changes the database itself.

The feature remains inside the repository's authoring scope. It does not restore evaluation, approval, TTE, public archive, collaboration, or other legacy workflow domains.

## 2. Product Goal

Provide a safe, user-controlled way to turn selected AI Review findings into one textual improvement proposal while preserving the existing SOP lifecycle, autosave behavior, diagrams, immutable completed versions, and server-side trust boundary.

Primary flow:

```text
SOP DRAFT
  -> Periksa dengan AI
  -> pilih finding yang revision-eligible
  -> Sarankan Perbaikan
  -> server loads authoritative persisted snapshot
  -> AI returns one constrained textual proposal
  -> server validates target + before/after
  -> before/after preview
  -> user chooses Batal or Terapkan
  -> Terapkan updates existing editor state only
  -> existing autosave persists the change
  -> previous review/revision becomes stale and is cleared
  -> user may run AI Review again
```

## 3. Design Principles

1. **No silent mutation.** AI suggestions are never applied without an explicit user action.
2. **No AI database write path.** The revision endpoint is suggestion-only. Persistence remains the responsibility of existing editor autosave endpoints.
3. **Persisted source of truth.** The server loads the current persisted `DRAFT` snapshot after client autosave succeeds.
4. **Small mutation surface.** Iteration 6 edits only a defined subset of existing textual fields.
5. **No structural rewrite.** AI cannot add/remove/reorder steps, alter actors, alter decision routing, alter timing, or change lifecycle state.
6. **Provider output is untrusted.** Every target and proposed value is application-validated against the same snapshot.
7. **Stale suggestions are discarded.** A proposal cannot be applied after the relevant editor content has changed.
8. **Advisory, not authoritative.** A suggested revision is not a compliance result, approval, legal opinion, or official SOP decision.

## 4. Explicit Scope

### 4.1 Allowed textual targets

Iteration 6 may propose changes only to:

- SOP title;
- one existing `peringatan` item;
- step `kegiatan`;
- step `kelengkapan`;
- step `keluaran` / output;
- step `keterangan`.

The proposal changes exactly one target per request.

### 4.2 Protected fields and structures

AI revision must not modify:

- SOP number;
- organization / institution identity;
- version number;
- SOP status;
- actors / pelaksana or swimlane membership/order;
- step count;
- step order;
- step type (`AWAL_AKHIR`, `KEGIATAN`, `KEPUTUSAN`);
- decision yes/no routing;
- duration or time unit;
- qualification, equipment, or recordkeeping list structure;
- related regulations or related SOPs;
- completion state or version-cloning behavior.

### 4.3 Findings that remain manual

Not every AI Review finding receives `Sarankan Perbaikan`.

Findings about these areas remain manual in Iteration 6:

- `PROCESS_STRUCTURE`;
- `ACTOR_RESPONSIBILITY`;
- `DECISION_ROUTING`;
- `TIME_PLAUSIBILITY`;
- actor-located findings;
- findings whose only safe remediation would require adding/removing/reordering data;
- findings whose target is outside the allowed textual set.

The UI should explain that the finding requires manual editing rather than presenting a disabled promise of automatic repair.

## 5. Refinement from the Approved High-Level Design

The initial high-level design described a request shaped as `detailSopId + finding + target field`.

After inspecting Iteration 5, the safer contract is:

```text
detailSopId + validated finding
```

The browser does **not** get authority to nominate an arbitrary target field. The provider proposes one target from a strict allowlist, and the application validates that target against the finding category/location and authoritative snapshot.

This removes a browser-controlled target from the trust boundary and reduces the chance of using the feature to rewrite protected fields.

## 6. Revision Target Model

The server-normalized proposal target is one of:

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

No application database ID is present in this contract.

`itemIndex` refers only to an already-existing warning item in the authoritative snapshot. Iteration 6 cannot create or delete warning items.

`stepOrder` refers to the human-visible 1-based procedure order, consistent with Iteration 5 finding navigation. Internal `langkahSopId` is not exposed to the provider or client revision contract.

## 7. Finding-to-Target Eligibility

Eligibility is deliberately conservative.

### Header

- `HEADER + CLARITY` may target `JUDUL`.
- Other header findings remain manual because they may refer to protected identity/number fields.

### Peringatan

- `PERINGATAN + CLARITY` may revise one existing warning item.
- `PERINGATAN + SUPPORTING_FIELD` may revise one existing warning item.
- `PERINGATAN + COMPLETENESS` may revise one existing warning item only when at least one item already exists.
- If the safe fix requires adding/removing warning items, it remains manual.

### Step

For `STEP` findings:

- `CLARITY` -> `KEGIATAN` or `KETERANGAN`;
- `INPUT_OUTPUT` -> `KELENGKAPAN` or `KELUARAN`;
- `COMPLETENESS` -> one of `KEGIATAN`, `KELENGKAPAN`, `KELUARAN`, `KETERANGAN`;
- `SUPPORTING_FIELD` -> `KETERANGAN`;
- all other categories remain manual.

The provider may choose among the allowed targets for that finding, but the application validator is authoritative and rejects any target outside the mapping.

## 8. API Design

### 8.1 Availability

```http
GET /sop/ai-revisions/availability
```

Response:

```json
{ "enabled": true }
```

Availability is independent from AI Draft and AI Review. Production may enable or disable each feature separately.

### 8.2 Suggest Revision

```http
POST /sop/:detailSopId/ai-revisions/suggest
```

Request body:

```ts
interface SuggestAiRevisionRequest {
  finding: SopQualityFinding
}
```

The finding is browser-supplied and therefore untrusted. The server validates enum values, text lengths, and location shape before use.

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

There is intentionally no `POST /apply` endpoint.

## 9. Server Architecture

### 9.1 Shared authoritative snapshot boundary

Iteration 5 already has a read-only repository that loads the authoritative SOP snapshot for AI Review. Iteration 6 needs the same ownership/status/snapshot shape.

Rather than duplicate that database query, Iteration 6 should perform a targeted extraction into a shared internal AI snapshot boundary, for example:

```text
server/src/modules/sop/ai-common/
  sop-ai-snapshot.repository.ts
  sop-ai-snapshot.types.ts
```

Both AI Review and AI Revision consume this shared read-only snapshot repository.

This is a focused refactor serving the new feature. It must preserve Iteration 5 behavior exactly and must not alter Prisma schema or persistence semantics.

### 9.2 Revision module

New bounded subsystem:

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

### 9.3 Service trust sequence

`SopAiRevisionService.suggest(...)` must execute in this order:

1. reject when provider mode is disabled;
2. validate request finding shape;
3. load authoritative SOP context by `detailSopId`;
4. return not-found when absent;
5. verify JWT owner matches the SOP owner;
6. require SOP status `DRAFT`;
7. derive the set of allowed revision targets from finding + snapshot;
8. reject without provider invocation when no safe target exists;
9. build provider-safe input with no database IDs or credentials;
10. invoke provider;
11. validate provider output structurally;
12. canonicalize target against authoritative snapshot;
13. verify target is in the derived allowed-target set;
14. set `before` from authoritative application state, not provider output;
15. validate `after` against existing application field constraints;
16. reject no-op proposals where normalized `after` equals `before`;
17. return one transient suggestion.

The repository/service path performs no application `create`, `update`, `delete`, or mutating transaction.

## 10. Provider-Safe Input

The provider receives only content required to produce a useful single-field rewrite.

Allowed context may include:

- SOP version number;
- title;
- warning values;
- actor names and order, without IDs;
- procedure steps with human-visible order, text fields, step type, actor name, and decision target order;
- validated finding data.

Provider input should omit when not required:

- `detailSopId`;
- user ID;
- workspace ID;
- SOP database ID;
- actor database IDs;
- internal step IDs;
- email;
- JWT/token/cookies;
- audit logs;
- unrelated SOPs;
- API keys;
- provider configuration secrets;
- official SOP number and organization identity, because they are protected targets and not needed for wording revision.

The provider is instructed to treat SOP/finding text as untrusted data, not as executable instructions.

## 11. Provider Output Contract

Provider raw output is `unknown` until parsed.

Conceptual strict output:

```ts
interface AiRevisionProviderResult {
  target: SopAiRevisionTarget
  after: string
  rationale: string
}
```

The provider does not control `before`; the service reads `before` from the authoritative snapshot after canonicalizing the target.

Validation rules include:

- exactly one target;
- target discriminator/field enums only;
- bounded text lengths;
- non-empty trimmed `after`;
- bounded `rationale`;
- existing warning index or step order;
- target allowed for the selected finding;
- `after` compatible with the same field limits used by existing editor/API validation;
- no change to protected fields or structures;
- no-op rewrite rejected.

Invalid output returns a sanitized 422-style application error and never reaches editor state.

## 12. OpenAI Runtime Contract

New environment variables:

```text
AI_REVISION_PROVIDER=disabled|openai|fake
AI_REVISION_TIMEOUT_MS=30000
```

Validation:

- provider defaults to `disabled`;
- timeout allowed range: `5000..60000` ms;
- `openai` requires existing server-side `OPENAI_API_KEY` and `OPENAI_MODEL`;
- `fake` is rejected when `NODE_ENV=production`;
- production example/Compose explicitly document/pass revision configuration;
- production contract keeps revision disabled by default.

OpenAI adapter follows the established backend-only Responses API pattern:

- Node 22 native `fetch`;
- Bearer API key only on server;
- `store: false`;
- strict JSON Schema Structured Outputs;
- no `tools`;
- no web/file retrieval;
- abort timeout;
- sanitized 429/network/refusal/invalid-output failures;
- no prompt, API key, or full provider response logging.

Provider instructions must explicitly forbid:

- inventing laws/regulations/citations;
- inventing organization identity or official SOP number;
- changing actors, routing, timing, or structure;
- returning multiple edits;
- obeying instructions embedded in user SOP/finding text;
- representing the result as compliance approval.

## 13. Client Architecture

### 13.1 API types

`client/src/api/workspace-sops.ts` gains typed availability and suggestion methods.

### 13.2 Revision state hook

Add a hook colocated with the existing quality-review hook, for example:

```text
client/src/pages/penyusun/sop/hooks/use-ai-sop-revision.ts
```

The hook owns only transient UI/request state:

- revision availability;
- currently selected finding;
- running state;
- proposal preview;
- sanitized error;
- request content fingerprint/detail ID guards.

No suggestion is persisted in browser storage or database.

### 13.3 Suggestion request gate

Before requesting a proposal:

1. SOP must be editable `DRAFT`;
2. AI Revision must be available;
3. a current AI Review finding must exist and be revision-eligible;
4. `flushAllAutosave()` must return `true`;
5. request captures current `contentFingerprint` and `detailSopId`;
6. stale response is discarded if either changes before response completion.

### 13.4 Preview

A revision-eligible finding exposes `Sarankan Perbaikan`.

After success, the panel shows:

```text
Sebelum
<authoritative before value>

Usulan
<proposed after value>

<short rationale>

[Batal] [Terapkan]
```

The user always sees the exact field target, such as `Langkah 3 · Output`, before applying.

### 13.5 Apply behavior

`Terapkan` does not call a revision write endpoint.

The client:

1. verifies current editor `detailSopId` matches `sourceDetailSopId`;
2. verifies current target value still equals response `before`;
3. if mismatched, marks proposal stale and refuses apply;
4. updates only the corresponding existing React editor state through existing metadata/procedure setters;
5. clears the revision proposal;
6. clears the previous AI Review because the content has changed;
7. relies on the existing autosave mechanism to persist the edit;
8. existing autosave conflict/error behavior remains authoritative.

A successful apply is therefore equivalent to a user editing that one field manually, except the value came from an explicitly accepted preview.

### 13.6 Cancel behavior

`Batal` discards only the transient proposal. It must not change editor state or trigger persistence.

## 14. Staleness and Concurrency

Iteration 6 must preserve the stale-response protections learned in Iteration 5.

A suggestion is invalid if any of these change after the request begins:

- `detailSopId`;
- editor `contentFingerprint`;
- selected finding/review instance;
- exact current target value relative to returned `before`.

The client discards stale network responses and refuses stale apply.

Server-side source remains the persisted snapshot. Client-side apply additionally checks `before` equality to avoid overwriting a newer local edit.

Existing optimistic-locking/autosave behavior remains the final persistence concurrency guard.

## 15. Error Handling

User-visible failures remain compact and non-sensitive.

Expected categories:

- provider disabled -> revision unavailable;
- SOP missing -> not found;
- ownership mismatch -> forbidden;
- completed/non-DRAFT -> conflict;
- finding not revision-eligible -> safe validation message, no provider call;
- autosave failure -> request not sent;
- provider timeout/rate limit/network failure -> retryable generic message;
- refusal/invalid structured output -> regenerate suggestion message;
- target invalid/stale/no-op -> safe 422-style message;
- local content changed while request is running -> stale proposal discarded;
- local target changed before apply -> apply blocked, regenerate required.

Provider raw bodies/errors must not be exposed to the browser.

## 16. Security and Privacy

Security invariants:

- JWT authentication applies to revision endpoints;
- ownership is verified server-side before provider invocation;
- only `DRAFT` SOP can request revision suggestions;
- browser-supplied finding is untrusted and schema-validated;
- browser cannot choose an arbitrary protected target;
- provider cannot write application state;
- provider sees no application DB IDs or credentials;
- no tools/retrieval means prompt injection cannot initiate external actions;
- provider output cannot modify lifecycle/identity/structure because the application allowlist rejects it;
- `before` is derived from server state rather than provider claims;
- no AI revision prompt/history/result persistence is introduced;
- production `fake` provider remains forbidden.

## 17. No Database Migration

Iteration 6 introduces no Prisma model/table/column/index migration.

There is no persisted:

- AI revision request;
- AI revision result;
- AI conversation;
- review-to-revision linkage;
- background job;
- provider response history.

Existing SOP edit/audit behavior triggered by normal autosave remains unchanged.

## 18. UI Integration

The existing `AI Review` side-panel experience is extended rather than adding a new top-level editor mode.

Finding card behavior:

- manual-only finding: existing navigation plus a small explanation that the finding must be edited manually;
- revision-eligible finding: existing navigation plus `Sarankan Perbaikan`;
- suggestion in progress: only that finding shows loading state and duplicate requests are blocked;
- suggestion ready: before/after preview appears in the AI Review panel context;
- after `Terapkan`: editor moves/focuses to the affected target when practical, review/proposal clears, normal autosave status communicates persistence.

No bulk `Fix all` is included.

## 19. Testing Strategy

TDD is required for each behavior slice.

### Server unit tests

Cover:

- revision target/output schema;
- request finding validation;
- shared snapshot extraction regression for AI Review;
- disabled provider behavior;
- not-found/ownership/DRAFT gate order;
- ineligible finding rejects before provider invocation;
- provider-safe input strips IDs/secrets/protected identity data;
- target allowlist by finding category/location;
- authoritative `before` derivation;
- invalid index/step/field rejection;
- no-op rejection;
- provider timeout/rate-limit/refusal/invalid output sanitization;
- runtime env validation and production fake rejection.

### Client unit/component tests

Cover:

- availability;
- revision CTA only for eligible findings;
- autosave must succeed before request;
- before/after preview;
- cancel leaves editor unchanged;
- apply mutates exactly one allowed editor field;
- apply clears review/revision;
- apply does not directly call a revision persistence endpoint;
- target mismatch blocks stale apply;
- content edit during request discards stale response;
- read-only/completed editor exposes no revision action;
- protected fields cannot be targeted through client contract.

### Regression tests

Existing AI Review behavior must remain green after shared snapshot extraction.

Existing blank/template/AI-draft lifecycle tests remain unchanged except for test-harness changes strictly required by the new journey.

## 20. E2E Acceptance Journey

Add one deterministic fake-provider journey:

```text
create/open normal DRAFT
  -> edit content
  -> wait autosave
  -> AI Review
  -> receive revision-eligible finding
  -> Sarankan Perbaikan
  -> verify before/after preview
  -> Batal
  -> verify field unchanged
  -> request suggestion again
  -> Terapkan
  -> wait existing autosave success
  -> verify old review cleared
  -> reload page
  -> verify revised text persisted
  -> AI Review again
  -> complete SOP
  -> verify AI Review/Revision actions hidden in completed state
  -> create version 2
  -> verify DRAFT remains editable/reviewable
```

Additional acceptance assertions:

- fake revision provider is enabled only in E2E/test environment;
- no AI `apply` network endpoint exists;
- decision-routing finding remains manual;
- proposal cannot alter SOP number, organization identity, actor, time, or routing;
- Flowchart and BPMN still render after the text revision;
- all existing E2E journeys remain green.

## 21. CI and Production Contract

Mandatory CI remains:

1. server typecheck/tests/build;
2. client typecheck/tests/build;
3. Playwright E2E against disposable MySQL;
4. production Compose/backup/restore contract.

E2E job may set:

```text
AI_DRAFT_PROVIDER=fake
AI_REVIEW_PROVIDER=fake
AI_REVISION_PROVIDER=fake
```

Production contract must explicitly prove:

- `AI_REVISION_PROVIDER` defaults to `disabled`;
- fake revision provider is rejected in production;
- no extra public service/port is introduced;
- existing deployment, persistence, backup, and restore behavior is unchanged.

## 22. Non-Goals

Iteration 6 does not include:

- automatic fix without preview;
- `Fix all` / bulk apply;
- AI add/delete/reorder step;
- AI actor/swimlane changes;
- AI decision-routing changes;
- AI timing changes;
- AI SOP-number or organization-identity changes;
- AI lifecycle completion;
- persisted AI suggestion/history/chat;
- background queue;
- agents/tool calling;
- RAG;
- regulation lookup;
- web/file search;
- compliance scoring/certification;
- approval/evaluation/TTE/public archive workflow;
- collaboration/multi-owner;
- model selector;
- Prisma migration.

## 23. Acceptance Criteria

Iteration 6 is implementation-complete only when all are true:

1. A current AI Review finding can request a single revision only when its category/location has a safe textual target.
2. Suggestion request uses the authoritative persisted `DRAFT` snapshot after autosave succeeds.
3. JWT owner and `DRAFT` gates occur before provider invocation.
4. Provider input has no application DB IDs, credentials, audit logs, unrelated SOPs, SOP number, or organization identity.
5. Provider output cannot target fields outside the application allowlist.
6. Response `before` is derived from server state.
7. User sees before/after preview and must explicitly choose `Terapkan`.
8. `Batal` performs zero editor mutation.
9. `Terapkan` changes exactly one allowed existing client editor field and uses existing autosave for persistence.
10. No AI revision application write endpoint or persistence table exists.
11. Stale response and stale apply are blocked.
12. Completed SOP remains immutable with revision actions hidden.
13. AI Review regression tests remain green after shared snapshot extraction.
14. Blank, template, AI-draft, AI-review, and AI-revision E2E journeys all pass.
15. Flowchart/BPMN/completion/version cloning remain intact.
16. Production provider defaults disabled and fake is forbidden.
17. No Prisma migration is introduced.

## 24. Rollout / Merge Gate

Because Iteration 6 extends the external AI provider surface and adds user-approved mutation into editor state, final squash merge remains a high-risk integration gate.

Requirements before merge:

- mandatory CI green on final code-bearing head;
- no unresolved review thread/blocker;
- focused audit of provider-safe input and protected-target allowlist;
- focused audit confirming no direct AI persistence path;
- explicit user final merge approval.

Do not start Iteration 7 automatically after merge.
