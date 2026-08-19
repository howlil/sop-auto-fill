# Iteration 5 — AI SOP Quality Review Design

## Status

- **Iteration:** `5-ai-sop-quality-review`
- **Working branch:** `feat/ai-sop-quality-review`
- **Design status:** `DESIGN_SPEC_REVIEW`
- **Base:** `master` at `c662c2ca5cdb007f773ef9766e8bb65d3dc5f200`
- **Implementation:** blocked until this written design is reviewed and approved by the user.

## 1. Context

Iteration 3 added deterministic system templates as a safe starting point for SOP authoring. Iteration 4 added AI-assisted drafting as a transient generate-preview-confirm flow that creates an ordinary editable SOP `DRAFT` only after explicit user confirmation. The existing editor remains the single editing surface for blank, template, and AI-created SOPs.

The next product gap is quality inspection before a draft is completed. Users can already start a draft in three ways, but the application does not yet help them detect ambiguous activities, weak responsibility boundaries, inconsistent input/output continuity, questionable decision routing, incomplete supporting fields, or suspicious time entries.

Iteration 5 therefore adds AI-assisted **quality review** inside the existing SOP editor. The AI acts as a transient reviewer. It does not edit the SOP, approve it, certify compliance, or persist a review record.

## 2. Product Goal

Allow the owner of an editable SOP `DRAFT` to request a structured AI review of the latest persisted SOP snapshot, receive actionable findings tied to specific locations, manually correct the draft through the existing editor, and run the review again.

Primary flow:

```text
Open editable SOP DRAFT
  -> wait until autosave is settled
  -> Periksa dengan AI
  -> server loads authoritative persisted SOP snapshot
  -> server maps snapshot to provider-safe context
  -> AI provider reviews structured context
  -> application validates/canonicalizes output
  -> transient review panel appears
  -> user manually edits existing SOP editor
  -> autosave
  -> optional review again
```

The capability must work for SOPs originating from `SOP Kosong`, `Dari Template`, or `Dengan AI`.

## 3. Design Principles

1. **Review, not mutation.** AI review never writes SOP data.
2. **Server-authoritative source.** Browser sends only the target identifier; backend loads the SOP from the database.
3. **Persisted snapshot only.** Review operates on the latest successfully autosaved state.
4. **Existing editor remains authoritative.** Corrections use existing controls and autosave.
5. **Provider output is untrusted.** Structured output is validated by application rules before reaching the UI.
6. **No compliance certification.** Findings concern internal quality and clarity, not authoritative legal/regulatory compliance.
7. **Dedicated provider contract.** Quality review does not overload `AiDraftProvider.generate()`.
8. **No new persistence.** No AI review table, prompt history, token ledger, background job, or migration.
9. **AI remains optional.** Disabled/unavailable AI cannot break normal authoring or lifecycle features.
10. **Mandatory CI never calls a live/paid provider.** Tests use deterministic fake review output.

## 4. Non-Goals

Iteration 5 does **not** add:

- automatic edits, patch application, or one-click AI fixes;
- regulation lookup, web search, file search, RAG, legal retrieval, or compliance certification;
- approval, evaluation, TTE, public archive, OPD roles, or workflow restoration;
- workspace collaboration, invitations, multi-owner access, or new authorization roles;
- persisted AI review/history/chat/job state;
- automatic completion based on AI findings;
- browser model selection or user-editable system prompts;
- background/queued review jobs;
- review of arbitrary client-provided SOP JSON;
- review of `COMPLETED` or `ARCHIVED` SOPs as an editing workflow;
- Prisma schema changes or migrations.

## 5. Approaches Considered

### Approach A — Client sends editor state

The browser serializes the current editor and sends it to the review endpoint.

**Advantage:** can include unsaved state.

**Rejected:** browser state becomes authoritative, review can bypass normal persistence validation, and editor-domain serialization is duplicated.

### Approach B — Server loads the persisted SOP snapshot

The client sends only `detailSopId`. Server validates ownership/editability, loads persisted data, maps it to a provider-safe context, invokes a provider, validates the result, and returns transient findings.

**Selected.** This preserves the trust boundary established in Iteration 4 and keeps review aligned with actual stored product state.

### Approach C — Persist review runs and findings

Each review becomes a database entity with history and model metadata.

**Rejected for Iteration 5.** It adds migration, retention/privacy questions, stale-history semantics, and UX that are unnecessary to prove the review capability.

## 6. Eligibility and Autosave Boundary

### 6.1 Eligible SOP

Review is available only to the authenticated owner of an ordinary editable SOP with current status `DRAFT`.

Backend re-checks ownership and status. Client eligibility is only presentation logic and is never authoritative.

Completed or archived SOPs are rejected using the existing state-conflict convention. Existing immutable completion/version behavior is unchanged.

### 6.2 Latest persisted snapshot

Backend always reads from the database and never accepts the SOP document body from the browser.

To avoid knowingly reviewing stale data:

- while autosave is pending/in flight, review is disabled or waits for that save to settle;
- review begins only after successful save confirmation;
- if the latest save is known to have failed, review does not run and the user is told to resolve/save the draft first.

Implementation must integrate with the existing autosave state. It must not add a second save path solely for AI review.

If current autosave architecture cannot expose a safe settled-save boundary without major restructuring, implementation stops and the design is revisited.

## 7. Application Snapshot and Provider-Safe Context

### 7.1 Internal application snapshot

Server constructs a bounded internal `SopQualityReviewSnapshot` from persisted data:

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
    pelaksanaId: string;
    name: string;
    order: number;
  }>;
  steps: Array<{
    langkahSopId: string;
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

Internal IDs may exist in this application snapshot because they are useful for ownership/loading/mapping, but they are not provider input.

### 7.2 Provider-safe context

Before invocation, service maps the snapshot into `SopQualityReviewProviderInput` containing only human-readable SOP content and order references.

Provider input contains **no application database IDs**, including:

- no `detailSopId`;
- no `pelaksanaId`;
- no internal step IDs;
- no user/workspace IDs.

Actors are represented by names and ordering. Decision targets are represented by step order numbers.

The provider-safe context must remain bounded by existing SOP domain constraints; Iteration 5 does not invent a second editable SOP model.

## 8. Quality Dimensions

Review covers only internal quality and clarity:

1. **Process structure** — understandable and operationally coherent sequence.
2. **Actor responsibility** — clear responsible actor and understandable responsibility shifts.
3. **Input/output continuity** — coherent required input and produced output between surrounding activities.
4. **Decision routing** — understandable decision wording and non-contradictory yes/no routing from supplied structure.
5. **Instruction clarity** — ambiguous, overly broad, or difficult-to-execute wording.
6. **Supporting fields** — obvious gaps/weaknesses in warning, qualification, equipment/supplies, or recordkeeping.
7. **Time plausibility** — suspicious/inconsistent time entries, without presenting model estimates as authoritative facts.
8. **Completeness signals** — missing context a human reviewer should verify before completion.

The model must not state that a draft is legally compliant, officially approved, or compliant with a named regulation.

## 9. Review Result Contract

### 9.1 Severity

```ts
type SopQualityFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION';
```

- `ERROR`: strong internal structural/consistency issue that should be checked before completion.
- `WARNING`: ambiguous, weak, or suspicious content requiring human review.
- `SUGGESTION`: optional improvement for clarity or maintainability.

`ERROR` is advisory AI output, not an application validation error and not an automatic completion blocker.

### 9.2 Location

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

Application validates that `stepOrder` exists in the reviewed snapshot and that `actorName` resolves to a normalized actor in that snapshot. Invalid references reject provider output instead of producing dangling UI findings.

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
- no empty strings after trimming;
- duplicate normalized severity/category/location/title findings collapse deterministically.

### 9.4 Summary

```ts
interface SopQualityReviewResult {
  status: 'PERLU_PERBAIKAN' | 'CUKUP_BAIK' | 'SIAP_DIREVIEW';
  summary: string;
  findings: SopQualityFinding[];
}
```

`summary`: 10–1500 trimmed characters.

Status is an **advisory quality summary**, not approval. UI always communicates that findings require human judgment.

Iteration 5 intentionally has no numeric 0–100 score to avoid false precision or an implied compliance grade.

## 10. Canonicalization and Application Validation

Provider output enters the application as `unknown` and must pass an application schema.

Validation includes:

- exact status enum;
- exact severity/category/location enums;
- length/count/trim rules;
- valid step references against the exact reviewed snapshot;
- valid normalized actor references against the exact reviewed snapshot;
- deterministic duplicate collapse;
- no provider-supplied database IDs;
- no unknown location shapes reaching the client.

Invalid structured output returns safe `422` retry-oriented behavior and never changes SOP data.

Only explicitly safe normalization such as whitespace trimming and duplicate collapse may be repaired automatically. Invalid structural references are rejected, not silently dropped.

## 11. Server Architecture

Add a focused module under SOP domain, conceptually:

```text
server/src/modules/sop/ai-review/
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

Exact filenames may follow repository conventions during planning, but responsibilities remain isolated.

### 11.1 Provider interface

Draft generation and quality review have different contracts and remain separate:

```ts
interface AiReviewProvider {
  review(input: SopQualityReviewProviderInput): Promise<unknown>;
}
```

A small low-level OpenAI transport helper may be shared later if code inspection proves it clearly reduces duplication, but `AiDraftProvider` and `AiReviewProvider` remain separate domain interfaces.

### 11.2 Repository

`SopAiReviewRepository` is read-only. It loads the current SOP detail plus actors, steps, and supporting arrays needed for review.

No review repository/service method may create, update, or delete application rows.

### 11.3 Service

`SopAiReviewService` owns:

1. provider availability;
2. ownership and DRAFT eligibility;
3. loading authoritative persisted snapshot;
4. mapping it to provider-safe context;
5. provider invocation;
6. canonicalization/validation against the exact snapshot;
7. safe error mapping.

### 11.4 Authorization

All review endpoints require the existing authenticated owner boundary. Ownership is checked before SOP content can be sent to a provider.

## 12. API Design

### 12.1 Availability

```http
GET /sop/ai-reviews/availability
```

Response data:

```ts
{ enabled: boolean }
```

It reveals no provider, model, key, or credential detail.

### 12.2 Review current draft

```http
POST /sop/:detailSopId/ai-review
```

Request has no SOP document body.

Server sequence:

1. authenticate user;
2. resolve target detail and owning SOP/workspace;
3. assert ownership;
4. assert current status `DRAFT`;
5. load latest persisted snapshot;
6. map to provider-safe context without DB IDs;
7. invoke provider;
8. validate output against the same snapshot;
9. return transient result.

Response data:

```ts
{
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: SopQualityReviewResult;
}
```

`reviewedDetailSopId` is returned by the application for client correlation; it is not sent to the model.

No review ID exists because review state is not persisted.

## 13. Provider and Runtime Configuration

Keep Iteration 4 draft-generation configuration unchanged.

Iteration 5 adds:

```text
AI_REVIEW_PROVIDER=disabled|openai|fake
AI_REVIEW_TIMEOUT_MS=30000
```

Rules:

- default `AI_REVIEW_PROVIDER=disabled`;
- `fake` allowed only in test/development and rejected in production;
- `openai` requires existing server-side `OPENAI_API_KEY` and `OPENAI_MODEL`;
- `AI_REVIEW_TIMEOUT_MS` is integer range `5000..60000`, default `30000`;
- do not rename or repurpose `AI_DRAFT_TIMEOUT_MS` in this iteration.

This keeps review rollout independent and avoids breaking existing Iteration 4 production configuration.

### 13.1 OpenAI review adapter

Production review adapter follows the same security posture as Iteration 4:

- backend-only OpenAI Responses API;
- runtime model from `OPENAI_MODEL`;
- `store: false`;
- strict JSON Schema Structured Outputs;
- no web search, file search, function calling, or external tools;
- bounded timeout from `AI_REVIEW_TIMEOUT_MS`;
- no API key, full prompt, or full response in ordinary logs;
- sanitized upstream failures;
- explicit instruction not to invent regulations or legal/compliance claims.

## 14. Prompt Construction and Privacy

Provider input contains only SOP content required for quality review.

Do not include:

- access tokens/cookies;
- user email/profile data;
- `detailSopId`;
- workspace/user IDs;
- actor IDs;
- internal step IDs;
- audit logs;
- unrelated SOPs;
- hidden application metadata.

Prompt states that:

- input is user-authored administrative procedure content;
- review is advisory;
- model must use only supplied data;
- model must not assert legal compliance or invent regulations;
- output must follow the strict structured schema.

## 15. Error Handling

Lock the external-error behavior as follows:

- review disabled: `503`;
- provider timeout/network/unavailable: `503`;
- upstream provider rate limit: `429`, consistent with existing OpenAI draft transport behavior;
- refusal/incomplete/invalid structured output: `422`;
- malformed identifier/request: existing `400` convention;
- target not found: existing `404` convention;
- ownership violation: existing authorization behavior;
- non-DRAFT/ineligible SOP: `409` state conflict;
- known client autosave failure: client blocks review before request;
- any provider failure: zero SOP mutation.

User-facing errors never expose raw provider response bodies.

## 16. Client UX

### 16.1 Entry point

Add `Periksa dengan AI` to document-level actions in the existing editable SOP editor. Do not create a second editor or separate AI workflow page.

When review is unavailable, action is hidden or visibly disabled according to existing availability patterns. Normal editing remains unaffected.

### 16.2 Transient lifecycle

```text
idle -> waiting-for-save -> reviewing -> success | error
```

Only current review state lives in client memory. Refresh/navigation clears it.

After a successful review, any subsequent SOP edit makes the result potentially stale. The default Iteration 5 behavior is to **clear the current result on the first post-review editor change**. This avoids presenting old findings as current and avoids adding revision hashes/history.

### 16.3 Review panel

Panel displays:

- advisory status badge;
- summary;
- counts by severity;
- findings grouped/filterable by severity;
- location label (`Langkah 4`, `Peringatan`, actor name, etc.);
- title, explanation, recommendation;
- persistent notice that AI findings require human review.

Step findings must clearly expose step order. Clicking a finding may focus an existing editor section only if a stable mapping can be added without a large editor-navigation refactor. Deep-link polish is not allowed to broaden scope.

### 16.4 No auto-fix

No `Terapkan Perbaikan`, patch, or AI write-back action exists in Iteration 5. User changes data manually through existing editor controls.

## 17. Completion and Versioning

AI review is advisory and is **not** a prerequisite for `Complete`.

Reasons:

- provider may be disabled/unavailable;
- findings are probabilistic;
- deterministic application validation remains authoritative;
- making review mandatory would silently turn optional AI into an approval gate.

After completion, existing immutability is unchanged. `Create New Version` creates a new editable draft as today; that new draft can be reviewed independently.

Review result is not copied across versions because it is transient.

## 18. Testing Strategy

### 18.1 Server

Required coverage:

- availability enabled/disabled;
- ownership enforced before provider invocation;
- non-DRAFT rejected;
- authoritative persisted snapshot mapping;
- provider context excludes all DB IDs;
- exact schema parsing;
- trim/length/count limits;
- invalid step location rejected;
- invalid actor location rejected;
- deterministic duplicate collapse;
- refusal/incomplete/invalid output mapping;
- timeout/network/rate-limit mapping;
- disabled provider behavior;
- review orchestration performs no database writes;
- OpenAI request uses strict schema, `store: false`, no tools/retrieval;
- raw provider body not exposed.

### 18.2 Client

Required coverage:

- availability state;
- review waits for/blocks on pending autosave;
- review blocked when latest save is known failed;
- request contains target identifier only, not SOP body;
- loading/error/success states;
- severity counts/findings render correctly;
- advisory warning visible;
- review result clears after post-review edit;
- no auto-fix action;
- normal editor remains usable when AI disabled.

### 18.3 E2E

Deterministic fake-provider journey:

```text
create/open DRAFT
  -> edit SOP
  -> wait for autosave
  -> Periksa dengan AI
  -> structured findings appear
  -> prove review did not mutate SOP data
  -> manually edit one field/step
  -> old review clears
  -> autosave/reload proves manual edit persisted
  -> review again
  -> continue Flowchart/BPMN
  -> Complete
  -> Create New Version
```

Existing blank/template/AI-draft creation sources remain mandatory regression coverage. Implementation plan may extend existing journeys rather than duplicate long end-to-end flows if the same acceptance surface stays covered.

### 18.4 Production contract

Production checks prove:

- application boots with `AI_REVIEW_PROVIDER=disabled` and no new credential requirement;
- production rejects `AI_REVIEW_PROVIDER=fake`;
- `AI_REVIEW_TIMEOUT_MS` validation works;
- no migration is added;
- CI never calls live/paid AI.

## 19. Acceptance Criteria

Iteration 5 is complete only when:

1. authenticated owner of editable SOP `DRAFT` can trigger `Periksa dengan AI` in the existing editor;
2. review respects settled autosave boundary;
3. browser sends only target identifier and server loads authoritative persisted SOP;
4. provider input contains no application DB IDs or unrelated account/workspace data;
5. provider result is strict structured output validated against the exact reviewed snapshot;
6. findings use valid severity/category/location contracts;
7. invalid actor/step references are rejected;
8. review performs zero SOP mutation;
9. user manually corrects data through existing editor/autosave;
10. old result clears after a post-review edit;
11. review remains advisory and never becomes completion/approval gate;
12. no regulation lookup/compliance certification is introduced;
13. no Prisma migration or persisted AI review/history/job is introduced;
14. disabled/failing AI does not break normal authoring, diagrams, PDF, completion, or versioning;
15. mandatory CI uses deterministic fake provider with no paid/live call;
16. server, client, E2E, and production-compose mandatory checks are green before merge.

## 20. Scope Guard

Do not broaden implementation into:

- inline AI rewrite;
- automatic fix application;
- persisted review history;
- approval/evaluation workflow;
- collaboration;
- regulation retrieval;
- generic chat assistant;
- model/settings UI;
- unrelated editor refactor.

## 21. Design Decision Summary

Iteration 5 adds a read-only AI quality-review layer to the existing SOP authoring lifecycle. It reviews a server-loaded persisted `DRAFT`, strips database IDs before provider invocation, returns transient schema-validated advisory findings, never writes SOP data, and leaves corrections to the existing editor/autosave flow.

Product progression remains deliberately narrow:

```text
Iteration 3: deterministic starting point
Iteration 4: AI-assisted generation
Iteration 5: AI-assisted quality review
```

A future iteration may consider carefully scoped AI-assisted correction, but only under a separate mutation/conflict/confirmation design after this review contract is proven stable.
