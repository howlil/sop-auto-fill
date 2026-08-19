# Iteration 4 — AI-Assisted Drafting Design

Date: 2026-08-20
Status: DESIGN SPEC REVIEW
Branch: `feat/ai-assisted-drafting`

## 1. Context

Iteration 3 proved deterministic SOP auto-fill through persisted system templates. A user can create a normal editable `DRAFT`, reuse workspace actors, receive prefilled procedure steps and lampiran, then continue through the existing autosave, reload, Flowchart/BPMN, completion, versioning, print, and PDF lifecycle.

The next product gap is authoring an SOP when no system template closely matches the intended process. Iteration 4 adds AI-assisted drafting from a natural-language description without creating a second editor or allowing an AI provider to mutate application state directly.

This iteration is explicitly user-approved after Iteration 3 was merged to `master` as `ed5aace37bd12d6b246d81a70ea17931ea1655c4`.

## 2. Goal and Success Flow

Allow an authenticated workspace owner to describe a business procedure in natural language and receive a structurally valid SOP draft proposal that can be reviewed before persistence.

Target flow:

`Login -> Workspace -> Buat SOP -> Dengan AI -> Deskripsikan proses -> Generate -> Preview terstruktur -> Isi/konfirmasi identitas -> Buat DRAFT -> Existing SOP Editor`

Success means:

1. generation itself performs no database mutation;
2. the proposal is validated by the server before it reaches the client;
3. the user explicitly confirms before persistence;
4. confirmation creates a normal SOP `DRAFT` transactionally;
5. actor reuse/create follows the same deterministic workspace rules as template creation;
6. the generated draft continues through the existing editor and lifecycle without a separate AI mode;
7. blank creation and system-template creation remain functional when the AI provider is disabled or unavailable.

## 3. Non-Goals

Iteration 4 does not add:

- autonomous agents or multi-step tool execution;
- web search, file search, or external retrieval inside the model request;
- automatic regulation attachment or regulation selection;
- automatic mutation of an existing SOP;
- chat history or persisted AI conversations;
- persisted generation jobs, generation audit tables, token accounting tables, or prompt history tables;
- user-defined model selection;
- user-defined system prompts;
- template designer/sharing;
- approval/evaluation/TTE/public archive/OPD roles/WhatsApp;
- background generation or asynchronous job infrastructure;
- AI-generated SOP numbers or authoritative organization identity.

The AI feature is a drafting assistant. The existing application remains authoritative for persistence, validation, editing, diagrams, completion, versioning, print, and PDF.

## 4. Considered Approaches

### A. Call the model directly from the browser

Rejected. It would expose provider credentials or require a separate client credential mechanism, move prompt/output validation across the trust boundary, and make provider substitution harder.

### B. Backend provider adapter + structured proposal + explicit confirmation

Selected. The server owns provider credentials, prompt construction, strict output validation, error mapping, and draft instantiation. The browser receives only a validated proposal and does not persist anything until explicit confirmation.

### C. Persist AI generations/jobs before confirmation

Rejected for Iteration 4. It adds database schema, cleanup/retention policy, and job lifecycle complexity without being required for a synchronous drafting flow. Persistence can be revisited if later requirements need history, analytics, asynchronous generation, or human approval of generations.

## 5. Product Behavior

The existing `Buat SOP` surface gains a third source:

- `SOP Kosong`: unchanged;
- `Dari Template`: unchanged;
- `Dengan AI`: new.

The AI path contains:

1. a natural-language textarea named `Deskripsi proses`;
2. optional context fields kept intentionally small:
   - `tujuanProses`;
   - `catatanTambahan`;
3. a `Generate Draft` action;
4. a read-only structured preview;
5. identity fields required before persistence:
   - `judul`, prefilled from `suggestedTitle` but editable;
   - `nomorSop`, always entered by the user;
   - `namaLembaga`, always entered by the user;
6. a final `Buat Draft SOP` confirmation.

The preview shows:

- suggested title;
- ordered actors;
- actors that will reuse existing workspace records;
- actors that would be created;
- ordered procedure steps including decisions and routing;
- non-empty lampiran defaults;
- a visible statement that the content is AI-generated and should be reviewed.

The proposal preview is read-only in Iteration 4. If the proposal is unsuitable, the user can revise the description and regenerate. Fine-grained editing remains the responsibility of the existing SOP editor after confirmation.

No SOP, actor, detail, step, lampiran, or log row is written during generation.

## 6. Canonical AI Draft Proposal

The server converts provider output into one canonical internal structure before returning it to the client.

```ts
type AiDraftProposal = {
  suggestedTitle: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: string[];
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
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
};
```

`actors`, `actorsToReuse`, and `actorsToCreate` are derived by the application after provider output validation. The provider is asked for `actorName` per step, not database IDs or workspace classification.

The provider is never allowed to generate database IDs.

## 7. Structural Validation Rules

Provider structured output is necessary but not sufficient. The application performs domain validation after parsing.

Rules:

1. `suggestedTitle` is trimmed and must contain 2-500 characters;
2. there must be between 2 and 25 steps;
3. step order must be unique, positive, contiguous, and normalized to `1..N` before persistence;
4. every step requires non-empty `kegiatan`, `kelengkapan`, `keluaran`, `keterangan`, and `actorName` after trimming;
5. `waktu` must be a positive integer within a bounded application limit;
6. `satuanWaktu` must use the existing `SatuanWaktu` enum;
7. `jenis` must use the existing `JenisLangkahProsedur` enum;
8. actor names are normalized using the same actor-name normalization used by deterministic template creation;
9. duplicate actors after normalization collapse to one canonical actor in first-use order;
10. decision targets must point to an existing step order;
11. a `KEPUTUSAN` step must have meaningful routing: at least one target, and when both branches exist they may not point to the same step;
12. non-decision steps must not carry `targetYaUrutan` or `targetTidakUrutan`;
13. routing may loop to an earlier step because procedural correction loops are valid;
14. lampiran arrays contain only trimmed non-empty strings and are capped to a small bounded count/length;
15. output that violates the canonical contract is rejected as provider-invalid and is never persisted.

The create endpoint runs the same canonical validation again. A client cannot bypass domain validation by altering a previously generated proposal.

## 8. Provider Abstraction

Add a provider-neutral server interface, for example:

```ts
interface AiDraftProvider {
  generate(input: AiDraftGenerationInput): Promise<AiDraftProviderOutput>;
}
```

Initial implementations:

- `OpenAiDraftProvider`: production implementation;
- `FakeAiDraftProvider`: deterministic test implementation.

Application services depend only on `AiDraftProvider`, not directly on an SDK client.

Provider selection is server configuration. The browser cannot choose a provider or model.

## 9. OpenAI Provider Contract

The initial production adapter uses the OpenAI Responses API from the server. The official OpenAI SDK is preferred over hand-rolled browser/API calls.

Provider behavior:

1. API key is loaded only from server environment configuration;
2. model name is server-configurable through `OPENAI_MODEL` rather than hard-coded into product logic;
3. the request uses Structured Outputs with a strict JSON schema matching the provider-output contract;
4. `store: false` is used because the application does not need provider-side response state for this synchronous one-shot flow;
5. no model tools are enabled in Iteration 4;
6. no web search, file search, function calling, or external retrieval is exposed to the model;
7. provider calls use a bounded timeout;
8. raw provider errors are not forwarded to clients;
9. provider output is parsed and then passed through application domain validation;
10. provider request IDs may be logged for operational diagnosis, but API keys and full prompts must not be written to ordinary application logs.

The prompt instructs the model to draft a procedure from user-provided facts, avoid inventing legal/regulatory references, avoid inventing organization-specific identifiers, and return only the requested structured object.

## 10. Prompt Input Boundary

`POST /sop/ai-drafts/generate` accepts:

```ts
{
  workspaceId: string;
  deskripsiProses: string;
  tujuanProses?: string;
  catatanTambahan?: string;
}
```

Validation:

- authenticated user must own `workspaceId`;
- `deskripsiProses` is required, trimmed, and bounded in length;
- optional fields are trimmed and bounded;
- empty optional values are omitted;
- the server loads existing workspace actor names and includes them as reusable vocabulary/context;
- database IDs are not sent to the provider.

The request does not contain `nomorSop` or authoritative `namaLembaga`; those fields are supplied by the user only during confirmation.

## 11. API Contract

### `GET /sop/ai-drafts/availability`

Authenticated endpoint returning:

```ts
{ enabled: boolean }
```

It does not expose API key status details, provider credentials, or model name.

The UI uses this to disable generation gracefully when AI drafting is not configured while preserving blank/template creation.

### `POST /sop/ai-drafts/generate`

Requires authentication and owned workspace.

Response:

```ts
{
  proposal: AiDraftProposal;
}
```

This endpoint is read-only with respect to application persistence.

### `POST /sop/ai-drafts/create`

Body:

```ts
{
  workspaceId: string;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  proposal: AiDraftProposal;
}
```

Server behavior:

1. assert workspace ownership;
2. trim/validate identity fields;
3. revalidate and canonicalize the proposal;
4. re-resolve workspace actors from current database state, ignoring client-supplied reuse IDs as authoritative input;
5. instantiate the draft in one transaction;
6. return minimal SOP/detail identity for navigation.

The create route does not call the model again.

## 12. Shared Draft Instantiation Boundary

Iteration 3 already implements transactional creation from a template. AI creation needs the same invariants.

Instead of duplicating that transaction, extract a focused internal draft-instantiation boundary used by template creation and AI creation.

Suggested location:

- `server/src/modules/sop/draft/sop-draft-instantiation.service.ts` or equivalent internal helper;
- no public controller for this helper.

Input is a canonical draft definition containing identity, lampiran, actors, steps, and decision routing.

It owns:

- `SOP` DRAFT creation;
- `DetailSOP` version 1 creation;
- deterministic actor reuse/create;
- `DetailSOPPelaksana` ordering;
- lampiran creation;
- two-pass procedure-step and decision-target creation;
- initial edit-log creation;
- transaction atomicity;
- duplicate SOP-number error mapping at the caller/service boundary.

Blank SOP creation remains unchanged unless a tiny internal extraction is required for a directly shared invariant. Iteration 4 must not refactor unrelated catalog/editor logic.

## 13. Server Module Boundaries

Add a focused AI drafting submodule under SOP, for example:

- `server/src/modules/sop/ai-draft/sop-ai-draft.controller.ts`
- `sop-ai-draft.service.ts`
- `sop-ai-draft.schema.ts`
- `sop-ai-draft.mapper.ts`
- `providers/ai-draft-provider.ts`
- `providers/openai-draft.provider.ts`
- `providers/fake-ai-draft.provider.ts`
- DTOs and specs colocated with the module.

Responsibilities:

- controller: transport/authenticated request boundary;
- service: workspace authorization, provider availability, generation orchestration, workspace actor context, proposal canonicalization, create orchestration, error mapping;
- provider: external model request only;
- schema/mapper: structured-output parsing and domain validation;
- draft-instantiation helper: database mutation only after confirmation.

No Prisma model or migration is added for AI drafting.

## 14. Client Boundaries

Extend the existing workspace creation surface instead of adding a new page-level editor.

`WorkspaceDetailPage` gains `CreateSource = 'blank' | 'template' | 'ai'`.

AI state remains local/transient:

- input description/context;
- generation pending/error state;
- generated proposal;
- user identity fields.

On successful create, navigate to the existing SOP editor exactly like template creation.

When switching away from `Dengan AI`, transient AI proposal state is cleared so stale generated content cannot be accidentally confirmed later.

## 15. Error Handling

Map external and domain failures to stable application errors.

- provider disabled: HTTP 503 with a user-safe message;
- provider timeout/network failure: HTTP 503;
- provider rate limit: HTTP 503 or 429 according to existing API error conventions, without leaking provider body;
- provider refusal/incomplete/invalid structured output: HTTP 422 with a regenerate-oriented message;
- invalid user input: HTTP 400;
- workspace not owned: existing authorization behavior;
- duplicate SOP number during confirmation: existing conflict behavior;
- transaction failure: no partial SOP data remains.

Generation errors do not affect blank or template creation.

## 16. Security and Privacy

1. provider API keys exist only in backend environment variables;
2. no provider key or model call is made from browser code;
3. generated proposals are treated as untrusted external input and validated before use;
4. confirmation revalidates all client-supplied proposal fields;
5. provider prompts contain only data needed to generate the requested draft;
6. database IDs are excluded from provider input;
7. automatic web/file retrieval is disabled;
8. API logs must not contain secrets;
9. ordinary application logs should record operational metadata, not full user prompts or full model responses;
10. generation never bypasses existing workspace ownership checks;
11. AI output never attaches regulations automatically;
12. the user remains responsible for reviewing generated administrative content before completing the SOP.

## 17. Runtime Configuration

Add server configuration with explicit validation:

- `AI_DRAFT_PROVIDER=disabled|openai`;
- `OPENAI_API_KEY` required only when `AI_DRAFT_PROVIDER=openai`;
- `OPENAI_MODEL` required only when `AI_DRAFT_PROVIDER=openai`;
- `AI_DRAFT_TIMEOUT_MS` optional with a safe bounded default.

Production example environment documentation is updated with placeholders only. No real credential is committed.

The application must boot successfully with AI drafting disabled. This keeps the existing product deployable without an AI provider.

## 18. Testing Strategy

### Unit / contract tests

Cover:

- DTO whitespace and length validation;
- availability behavior;
- workspace ownership assertion;
- prompt-context construction without database IDs;
- strict provider-output parsing;
- canonicalization and actor de-duplication;
- invalid decision targets;
- non-decision steps carrying branches;
- maximum-step and maximum-field limits;
- provider disabled/timeout/rate-limit/refusal mapping;
- create-time revalidation;
- actor state changed between generate and create;
- transactional instantiation;
- duplicate SOP-number conflict mapping.

### Provider tests

Do not call a paid/live provider in mandatory CI.

The fake provider returns deterministic structured output so tests prove application behavior independent of provider variability.

The OpenAI adapter is tested through a mocked SDK boundary for request shape, structured-output configuration, `store: false`, timeout/error mapping, and response parsing.

### Client tests

Cover:

- third creation source `Dengan AI`;
- disabled/unavailable state;
- generate payload;
- read-only preview;
- regenerate behavior;
- identity requirements;
- final create payload;
- navigation to existing editor;
- switching source clears stale proposal state.

### E2E acceptance

Add one deterministic fake-provider journey:

`workspace -> Dengan AI -> description -> generate -> preview -> confirm identity -> create -> existing editor -> verify prefilled steps/lampiran -> edit -> autosave -> reload -> Flowchart/BPMN -> Complete -> Create New Version`.

Existing blank and template journeys remain mandatory regression coverage.

### Production contract

Production Compose validates that:

- app boots with `AI_DRAFT_PROVIDER=disabled` and no OpenAI key;
- `/sop/ai-drafts/availability` reports disabled after authentication in application-level tests;
- no production build requires a provider credential at image-build time;
- existing migration/seed/persistence/backup/restore checks remain unchanged because Iteration 4 adds no database migration.

## 19. Acceptance Criteria

Iteration 4 is complete when all are true:

1. user can select `Dengan AI` from the existing workspace SOP creation surface;
2. generation requires an owned workspace and performs zero application DB writes;
3. provider output is strict structured data plus application domain validation;
4. preview clearly shows actors, steps, routing, and lampiran before persistence;
5. user supplies/edits `judul`, `nomorSop`, and `namaLembaga` before confirmation;
6. confirmation revalidates the proposal and current workspace actor state;
7. one transaction creates a normal editable `DRAFT` with no partial data on failure;
8. generated draft enters the existing editor with no AI-specific editor mode;
9. autosave, reload, Flowchart/BPMN, completion, version cloning, print/PDF remain compatible;
10. blank and template creation still work when AI is disabled or fails;
11. mandatory CI uses no live paid AI request;
12. no new Prisma migration is introduced;
13. no automatic regulation attachment or removed legacy domain is restored.

## 20. Implementation Boundary

Implementation should be delivered on the same short-lived task branch/PR after this design spec is approved.

The implementation plan must use TDD and should sequence work roughly as:

1. provider/canonical schema RED-GREEN;
2. generation service/API RED-GREEN;
3. shared draft-instantiation extraction with regression coverage;
4. confirmed AI create API RED-GREEN;
5. client source/preview/create RED-GREEN;
6. deterministic E2E acceptance;
7. production configuration/contract;
8. final review and mandatory CI.

Do not begin a subsequent iteration from this document. Iteration transition remains explicit.