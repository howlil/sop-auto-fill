# Iteration 5 — AI SOP Quality Review Design

## Status

- **Iteration:** `5-ai-sop-quality-review`
- **Working branch:** `feat/ai-sop-quality-review`
- **Design status:** `DESIGN_SPEC_REVIEW`
- **Base:** `master` at `c662c2ca5cdb007f773ef9766e8bb65d3dc5f200`
- **Implementation:** blocked until this written design is reviewed and approved by the user.

## 1. Context

Iteration 3 added deterministic system templates as a safe starting point for SOP authoring. Iteration 4 added AI-assisted drafting as a transient generate-preview-confirm flow that creates an ordinary editable SOP `DRAFT` only after explicit user confirmation. The existing editor remains the single editing surface for blank, template, and AI-created SOPs.

The next product gap is not another creation source. Users can already start a draft in three ways, but the application does not yet help them inspect the quality and internal consistency of a draft before they complete it. Manual review is possible, but users must notice ambiguous steps, inconsistent actor responsibilities, weak input/output continuity, questionable decision routing, or incomplete supporting fields themselves.

Iteration 5 therefore adds an AI-assisted **quality review** capability inside the existing SOP editor. The AI acts as a transient reviewer. It does not edit the SOP, approve it, certify compliance, or persist an AI review record.

## 2. Product Goal

Allow the owner of an editable SOP `DRAFT` to request a structured AI quality review of the latest persisted SOP snapshot, receive actionable findings tied to specific parts of the SOP, manually correct the draft in the existing editor, and run the review again.

Primary flow:

```text
Open editable SOP DRAFT
  -> wait until autosave is settled
  -> Periksa dengan AI
  -> server loads authoritative persisted SOP snapshot
  -> AI provider reviews structured snapshot
  -> application validates/canonicalizes review output
  -> transient review panel appears
  -> user manually edits existing SOP editor
  -> autosave
  -> optional review again
```

The review capability must work regardless of whether the SOP originated from `SOP Kosong`, `Dari Template`, or `Dengan AI`.

## 3. Design Principles

1. **Review, not mutation.** AI output never writes SOP data in Iteration 5.
2. **Server-authoritative input.** Browser sends an identifier, not an arbitrary SOP object for the model to trust.
3. **Persisted snapshot only.** Review operates on the latest successfully autosaved database state.
4. **Existing editor stays authoritative.** Corrections are made manually through the existing editor and existing autosave path.
5. **Structured output is untrusted.** Provider output must pass strict application-domain validation before reaching the client.
6. **No compliance certification.** Findings discuss structural and writing quality, not authoritative legal/regulatory compliance.
7. **Provider-neutral orchestration.** Review logic depends on a dedicated review-provider interface, not directly on OpenAI transport.
8. **No new persistence.** No AI review table, prompt history, token ledger, background job, or Prisma migration in this iteration.
9. **AI remains optional.** When AI is disabled or unavailable, existing editor, autosave, diagrams, PDF, completion, and versioning continue to work.
10. **Mandatory CI never calls a paid/live provider.** Test and E2E use deterministic fake review output.

## 4. Non-Goals

Iteration 5 does **not** add:

- automatic edits, patch application, or one-click AI fixes;
- regulation lookup, web search, file search, RAG, legal retrieval, or compliance certification;
- approval, evaluation, TTE, public archive, OPD roles, or workflow restoration;
- workspace collaboration, invitations, multi-owner access, or new authorization roles;
- persisted AI review/history/chat/job state;
- automatic completion of an SOP based on review score;
- model selection in the browser;
- user-editable system prompts;
- background/queued review jobs;
- review of arbitrary client-provided SOP JSON;
- review of `COMPLETED` or `ARCHIVED` SOPs as an editing workflow;
- Prisma schema changes or migrations.

## 5. Approaches Considered

### Approach A — Client sends the whole editor state to AI review endpoint

The client would serialize its current editor state and send that object to the backend for review.

**Advantages:** simple UI-to-provider plumbing and potentially includes unsaved state.

**Rejected because:** it makes browser state an authoritative review source, complicates ownership/trust boundaries, duplicates editor-domain serialization, and can review a state that has never passed normal autosave validation.

### Approach B — Server loads the SOP snapshot and returns transient structured findings

The client sends only the target `detailSopId`. The server validates ownership/editability, loads the persisted SOP snapshot from the database, constructs a bounded review context, calls a provider through a dedicated interface, validates the response, and returns transient findings.

**Selected.** This preserves the trust model established in Iteration 4 and ensures review input is the same normalized data the product already persists.

### Approach C — Persist AI review runs and findings

Each review would create a database record containing status, findings, model metadata, and timestamps.

**Rejected for Iteration 5.** Persistence introduces schema migration, retention/privacy questions, stale-finding lifecycle, history UX, and additional product semantics that are not required to prove the value of AI quality review.

## 6. Eligibility and Autosave Boundary

### 6.1 Eligible SOP

AI quality review is available only for an authenticated owner viewing an ordinary editable SOP whose current status is `DRAFT`.

The backend must re-check ownership and status. The client must not be trusted to determine eligibility by itself.

If the SOP is completed or archived, the endpoint rejects the review request using a user-safe application error. The immutable completed/version lifecycle remains unchanged.

### 6.2 Latest persisted snapshot

The backend always reads the SOP from the database. It does not accept the SOP body from the browser.

To prevent the user from reviewing stale data while an autosave is still in flight, the client review action must integrate with the existing autosave state:

- if autosave is pending/in flight, the review button is disabled or waits for the active save to settle;
- after successful save confirmation, the client calls the review endpoint;
- if the latest autosave failed, review must not silently run against older data; the user is told to resolve/save the draft first.

The implementation plan must inspect the current autosave hooks and choose the smallest compatible mechanism. It must not introduce a second persistence path solely for AI review.

## 7. Review Snapshot

The server repository/service constructs a bounded `SopQualityReviewSnapshot` from current persisted data.

Conceptual shape:

```ts
interface SopQualityReviewSnapshot {
  detailSopId: string;
  versi: number;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: Array<{
    name: string;
    order: number;
  }>;
  steps: Array<{
    urutan: number;
    kegiatan: string;
    jenis: 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN';
    kelengkapan: string;
    keluaran: string;
    waktu: number;
    satuanWaktu: 'm' | 'h' | 'd' | 'w' | 'mo' | 'y';
    keterangan: string;
    actorName: string;
    targetYaUrutan: number | null;
    targetTidakUrutan: number | null;
  }>;
}
```

Database IDs other than the minimum target identifier required by application routing must not be sent to the AI provider. In particular, actor IDs and internal step IDs are mapped to human-readable names and step order references before provider invocation.

The snapshot must be bounded by the existing domain constraints. Iteration 5 does not invent a second SOP schema.

## 8. Quality Dimensions

The AI review is intentionally scoped to internal quality and clarity. The system prompt and output contract cover these dimensions:

1. **Process structure** — whether the sequence is understandable and operationally coherent.
2. **Actor responsibility** — whether each step has a clear, plausible responsible actor and responsibility shifts are understandable.
3. **Input/output continuity** — whether a step's required input and produced output are internally coherent with surrounding steps.
4. **Decision routing** — whether decision wording and yes/no routing appear understandable and non-contradictory from the supplied structure.
5. **Instruction clarity** — ambiguity, overly broad wording, unclear verbs, or activities that are difficult to execute consistently.
6. **Supporting fields** — obvious gaps or weak content in warning, qualification, equipment/supplies, or recordkeeping sections.
7. **Time plausibility** — clearly suspicious/inconsistent time entries relative to the described activity, without presenting the model's estimate as authoritative fact.
8. **Completeness signals** — missing context that a human reviewer should verify before completing the SOP.

The AI must not claim that a draft is legally compliant, officially approved, or compliant with a named regulation unless authoritative retrieval is implemented in a future iteration.

## 9. Review Result Contract

### 9.1 Severity

Each finding has exactly one severity:

```ts
type SopQualityFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION';
```

Meaning:

- `ERROR`: a strong internal structural/consistency problem in the supplied SOP that should be checked before completion.
- `WARNING`: ambiguous, weak, or suspicious content requiring human review.
- `SUGGESTION`: optional improvement for clarity or maintainability.

`ERROR` is **not** an application validation error and does not automatically block completion in Iteration 5. Existing completion rules remain authoritative.

### 9.2 Location

A finding targets one reviewable location:

```ts
type SopQualityFindingLocation =
  | { kind: 'HEADER' }
  | { kind: 'PERINGATAN' }
  | { kind: 'KUALIFIKASI_PELAKSANAAN' }
  | { kind: 'PERALATAN_PERLENGKAPAN' }
  | { kind: 'PENCATATAN_PENDATAAN' }
  | { kind: 'ACTOR'; actorName: string }
  | { kind: 'STEP'; stepOrder: number };
```

The application validates that referenced `stepOrder` exists in the reviewed snapshot and that `actorName`, when present, maps to a normalized actor in the snapshot. Invalid references reject the provider output rather than exposing dangling findings to the UI.

### 9.3 Finding

```ts
interface SopQualityFinding {
  severity: SopQualityFindingSeverity;
  category:
    | 'PROCESS_STRUCTURE'
    | 'ACTOR_RESPONSIBILITY'
    | 'INPUT_OUTPUT'
    | 'DECISION_ROUTING'
    | 'CLARITY'
    | 'SUPPORTING_FIELD'
    | 'TIME_PLAUSIBILITY'
    | 'COMPLETENESS';
  location: SopQualityFindingLocation;
  title: string;
  explanation: string;
  recommendation: string;
}
```

Limits:

- maximum 30 findings;
- `title`: 3–160 trimmed characters;
- `explanation`: 10–1000 trimmed characters;
- `recommendation`: 3–1000 trimmed characters;
- duplicate findings with the same normalized severity/category/location/title are collapsed deterministically;
- no empty strings after trimming.

### 9.4 Summary

Canonical response:

```ts
interface SopQualityReviewResult {
  status: 'PERLU_PERBAIKAN' | 'CUKUP_BAIK' | 'SIAP_DIREVIEW';
  summary: string;
  findings: SopQualityFinding[];
}
```

`summary` is 10–1500 trimmed characters.

The status is an **advisory quality summary**, not approval. The UI must label it accordingly and show a persistent warning that AI findings require human judgment.

To avoid arbitrary provider scoring semantics, Iteration 5 does not expose a numeric `0–100` score. This keeps the product from implying false precision or formal compliance.

## 10. Canonicalization and Application Validation

Provider output is parsed as `unknown` and then validated by an application schema.

Validation includes:

- exact status enum;
- exact severity/category/location enums;
- field length and trimming rules;
- maximum finding count;
- valid step references against the server snapshot;
- valid normalized actor references against the server snapshot;
- deterministic duplicate collapse;
- no provider-supplied DB IDs;
- no unknown location shape reaching the client.

Invalid structured output results in a safe `422` response suggesting the user retry the review. It does not modify SOP data.

The application must not silently drop structurally invalid references in a way that could mislead the user. Either canonicalize an explicitly safe duplicate/whitespace case or reject the result.

## 11. Server Architecture

### 11.1 Module

Add a focused module under the SOP domain, conceptually:

```text
server/src/modules/sop/ai-review/
  dto/
  providers/
    ai-review-provider.ts
    disabled-ai-review.provider.ts
    fake-ai-review.provider.ts
    openai-ai-review.provider.ts
  sop-ai-review.controller.ts
  sop-ai-review.service.ts
  sop-ai-review.repository.ts
  sop-ai-review.schema.ts
  sop-ai-review.types.ts
```

Exact file names may be adjusted to repository naming conventions during implementation planning, but responsibilities must remain isolated.

### 11.2 Provider interface

Do not overload `AiDraftProvider.generate()` with review behavior. Draft generation and quality review have different input/output contracts and should remain independently testable.

Conceptual interface:

```ts
interface AiReviewProvider {
  review(input: SopQualityReviewProviderInput): Promise<unknown>;
}
```

The production implementation may reuse shared low-level OpenAI transport helpers if extraction is small and clearly beneficial, but the draft and review domain interfaces remain separate.

### 11.3 Repository

`SopAiReviewRepository` is read-only. It loads the complete review snapshot needed by the service from the current SOP detail and related actors/steps/lampiran.

No review path method may create/update/delete application rows.

### 11.4 Service

`SopAiReviewService` owns:

1. provider availability;
2. ownership/eligibility orchestration;
3. loading the authoritative persisted snapshot;
4. mapping database entities to provider-safe review context;
5. calling the configured review provider;
6. validating/canonicalizing provider output against that snapshot;
7. safe application error mapping.

The service does not edit SOP data.

### 11.5 Authorization

All quality-review endpoints require the same authenticated owner boundary used by the existing workspace/SOP authoring flow.

Ownership is checked server-side before snapshot data is returned to or processed by a provider.

## 12. API Design

### 12.1 Availability

```http
GET /sop/ai-reviews/availability
```

Authenticated response data:

```ts
{ enabled: boolean }
```

The endpoint reveals no API key, model name, or provider credential details.

### 12.2 Review current draft

```http
POST /sop/:detailSopId/ai-review
```

No SOP document body is accepted.

The server:

1. authenticates the user;
2. resolves the `detailSopId` and owning workspace/SOP;
3. verifies ownership;
4. verifies current editable `DRAFT` eligibility;
5. loads the latest persisted snapshot;
6. invokes the provider;
7. validates result against the exact snapshot;
8. returns transient review data.

Response data:

```ts
{
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: SopQualityReviewResult;
}
```

The response intentionally does not create a review ID because nothing is persisted.

## 13. Provider and Runtime Configuration

Iteration 5 reuses the existing AI deployment philosophy from Iteration 4.

Preferred configuration:

- keep existing `AI_DRAFT_PROVIDER=disabled|openai|fake` behavior untouched;
- introduce `AI_REVIEW_PROVIDER=disabled|openai|fake`, default `disabled`;
- `fake` remains allowed only outside production;
- production `openai` requires existing server-side `OPENAI_API_KEY` and `OPENAI_MODEL`;
- reuse `AI_DRAFT_TIMEOUT_MS` only if naming remains semantically acceptable after code inspection; otherwise introduce a general `AI_PROVIDER_TIMEOUT_MS` through a deliberately backward-compatible config change. Do not rename working production config casually.

The implementation plan must choose the least disruptive option after inspecting configuration consumers.

### OpenAI behavior

The production review adapter uses backend-only OpenAI Responses API behavior consistent with Iteration 4:

- runtime model from server configuration;
- `store: false`;
- strict JSON Schema Structured Outputs;
- no web search, file search, function calls, or external tools;
- bounded timeout;
- provider errors sanitized before returning to the client;
- no full prompt or full response logged during ordinary application operation;
- model is explicitly told not to invent legal/regulatory compliance claims.

## 14. Prompt Construction and Privacy

The server sends only content needed to review the SOP snapshot.

Do not include:

- access tokens/cookies;
- user email or account profile data;
- workspace/database IDs not needed by the model;
- actor database IDs;
- internal step IDs;
- audit log rows;
- unrelated workspace SOPs;
- hidden application metadata.

The prompt should state that:

- input represents user-authored administrative procedure data;
- review is advisory;
- the model must use only supplied content;
- it must not assert legal compliance or invent regulations;
- it must return findings only through the structured schema.

## 15. Error Handling

Expected mapping:

- AI review disabled: `503` with a safe availability message;
- provider timeout/network/unavailable/rate-limit: safe `503` (or existing provider-rate-limit convention if intentionally shared); no raw upstream body;
- refusal/incomplete/invalid structured output: `422` with retry-oriented message;
- invalid or missing detail identifier: existing application `400/404` convention;
- ownership violation: existing authorization behavior;
- non-DRAFT/ineligible SOP: `409` or existing state-conflict convention;
- autosave failure is handled on client before review call when known; server still reviews only persisted data;
- provider failure never changes SOP persistence.

Exact HTTP exception classes should follow existing NestJS conventions during implementation.

## 16. Client UX

### 16.1 Entry point

Add `Periksa dengan AI` to the existing editable SOP editor, near document-level actions rather than creating a separate AI page.

When AI review is unavailable, the action is hidden or visibly disabled according to existing availability UX conventions. It must not block normal editor use.

### 16.2 Review lifecycle

Client transient state:

```ts
idle -> waiting-for-save -> reviewing -> success | error
```

The client keeps only the current transient review result. Refresh/navigation clears it.

When the user modifies the SOP after a successful review, the previous findings become potentially stale. The UI must visibly mark the review as stale or clear it once editor data changes after the reviewed snapshot. It must not continue presenting old findings as if they apply to the new draft state.

The simplest acceptable implementation is to clear the current result on the first post-review editor change.

### 16.3 Review panel

The panel displays:

- advisory status badge;
- summary;
- counts by severity;
- findings grouped or filterable by severity;
- location label such as `Langkah 4`, `Peringatan`, or actor name;
- title, explanation, and recommendation;
- visible statement that AI findings require human review.

Clicking a finding should focus/navigate to the related existing editor section when a stable mapping already exists or can be added without restructuring the editor. At minimum, step findings must expose their step number clearly. Implementation planning must avoid a large editor-navigation refactor solely to support deep-link polish.

### 16.4 No auto-fix

There is no `Terapkan Perbaikan`, one-click patch, or write-back action in Iteration 5.

Users make corrections manually through existing controls, preserving current validation/autosave/locking semantics.

## 17. Interaction with Completion and Versioning

AI review is advisory and does not become a prerequisite for `Complete` in Iteration 5.

Reasons:

- the provider can be disabled or unavailable;
- AI findings are probabilistic;
- existing product completion rules are deterministic application-domain rules;
- making review mandatory would silently turn an optional AI service into an approval gate.

After a SOP is completed, its existing immutable behavior remains unchanged. `Create New Version` creates an editable draft as today, and that new draft can then be reviewed independently.

No AI review result is copied between versions because review state is transient.

## 18. Testing Strategy

### 18.1 Server unit/contract tests

Required coverage includes:

- availability enabled/disabled;
- ownership enforced before provider invocation;
- non-DRAFT review rejected;
- authoritative repository snapshot mapping;
- actor and step database IDs excluded from provider input;
- exact review schema parsing;
- trim/length/count limits;
- invalid step location rejected;
- invalid actor location rejected;
- deterministic duplicate collapse;
- refusal/incomplete/invalid structured output mapping;
- timeout/network/rate-limit mapping;
- provider disabled behavior;
- no write methods called during review orchestration;
- OpenAI request uses strict JSON Schema, `store: false`, no tools/retrieval;
- provider error bodies are not exposed.

### 18.2 Client tests

Required coverage includes:

- `Periksa dengan AI` availability state;
- review action waits for/blocks on pending autosave;
- review does not run when latest save is known failed;
- request contains target identifier rather than arbitrary SOP body;
- loading/error/success states;
- severity counts and finding rendering;
- visible advisory warning;
- review result cleared/marked stale after subsequent editor change;
- no auto-fix mutation action;
- normal editor actions remain available when AI disabled.

### 18.3 E2E

Mandatory deterministic fake-provider journey:

```text
create/open DRAFT
  -> edit SOP
  -> wait for autosave
  -> Periksa dengan AI
  -> structured findings appear
  -> verify SOP data was not mutated by review
  -> manually change one field/step
  -> autosave/reload proves manual edit persisted
  -> old review becomes stale/cleared
  -> review again
  -> continue Flowchart/BPMN
  -> Complete
  -> Create New Version
```

Existing blank/template/AI-draft journeys remain mandatory regression coverage as appropriate to CI runtime. The implementation plan may extend an existing journey rather than multiply redundant long E2E tests, as long as all creation sources remain covered somewhere in the mandatory suite.

### 18.4 Production contract

Production verification must prove:

- application boots with `AI_REVIEW_PROVIDER=disabled` and no additional credential requirement;
- `AI_REVIEW_PROVIDER=fake` is rejected in production configuration;
- enabling review does not change database migration requirements;
- no live/paid provider is invoked by CI.

## 19. Acceptance Criteria

Iteration 5 is complete when all of the following are true:

1. authenticated owner of an editable SOP `DRAFT` can trigger `Periksa dengan AI` from the existing editor;
2. review waits for the current autosave boundary so it does not intentionally review known-stale client state;
3. browser sends only the target detail identifier, while server loads the authoritative persisted SOP snapshot;
4. provider receives no actor IDs/internal step IDs or unrelated account/workspace data;
5. provider returns strict structured findings that are validated against the exact snapshot;
6. findings use `ERROR`, `WARNING`, or `SUGGESTION` and valid location/category contracts;
7. review never mutates SOP data;
8. user can manually correct the SOP through the existing editor and autosave path;
9. existing review result becomes stale/cleared after post-review edits;
10. AI review remains advisory and does not become a completion/approval gate;
11. no regulation lookup/compliance certification is introduced;
12. no Prisma migration or persisted review history is introduced;
13. AI disabled/provider failure does not break normal authoring, diagrams, PDF, completion, or versioning;
14. mandatory CI uses a deterministic fake provider and no paid/live AI call;
15. server, client, E2E, and production-compose mandatory checks are green before merge.

## 20. Implementation Boundaries to Preserve

During implementation, do not broaden the iteration into:

- inline AI rewrite;
- automatic fix application;
- persisted AI history;
- workflow approval/evaluation;
- collaboration;
- regulation retrieval;
- generic chat assistant;
- model/settings UI;
- unrelated editor refactor.

If implementation discovers that the existing autosave architecture cannot safely expose a settled-save boundary without major restructuring, stop and upgrade/review the design rather than silently creating a second save path.

## 21. Design Decision Summary

Iteration 5 adds a read-only AI quality-review layer to the existing SOP authoring lifecycle. It reviews only a server-loaded persisted `DRAFT` snapshot, returns transient schema-validated advisory findings, never writes SOP data, and leaves all corrections to the existing editor and autosave behavior.

This intentionally creates a clean progression:

```text
Iteration 3: deterministic starting point
Iteration 4: AI-assisted generation
Iteration 5: AI-assisted quality review
```

A future iteration may add carefully scoped AI-assisted corrections, but only after the review contract proves stable and only with a separate design for mutation, conflict handling, and user confirmation.
