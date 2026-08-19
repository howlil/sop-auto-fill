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
2. optional context fields:
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

## 6. Provider Output and Canonical Proposal

The provider returns only generation content. Workspace reuse metadata is derived by the application.

Provider output:

```ts
type AiDraftProviderOutput = {
  suggestedTitle: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
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

After provider-output validation, the application derives:

```ts
type AiDraftProposal = AiDraftProviderOutput & {
  actors: string[];
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
};
```

`actors` are unique normalized actor names in first-use order. The provider is never asked to generate database IDs and never decides whether an actor already exists in the workspace.

## 7. Structural Validation Rules

Provider Structured Outputs are necessary but not sufficient. The application performs domain validation after parsing and repeats the same validation at create time.

Exact rules:

1. `suggestedTitle`: trimmed, 2-500 characters;
2. step count: 2-25;
3. `urutan`: unique positive integers and canonicalized to contiguous `1..N` while preserving ascending order;
4. `kegiatan`, `kelengkapan`, `keluaran`, `keterangan`: trimmed, 1-500 characters each;
5. `actorName`: trimmed, 1-255 characters;
6. `waktu`: integer from 1 through 1,000,000;
7. `satuanWaktu`: existing `SatuanWaktu` enum only;
8. `jenis`: existing `JenisLangkahProsedur` enum only;
9. duplicate actors after normalization collapse to one canonical actor in first-use order;
10. `targetYaUrutan` and `targetTidakUrutan`, when non-null, must resolve to an existing original step order and are remapped after order canonicalization;
11. `KEPUTUSAN` must have at least one non-null branch target;
12. when a `KEPUTUSAN` has both targets, the two targets must differ;
13. non-`KEPUTUSAN` steps must have both branch targets null;
14. routing may point to an earlier step because correction loops are valid;
15. each lampiran array contains 0-20 items;
16. each lampiran item is trimmed, non-empty, and 1-500 characters;
17. provider output with unknown keys, invalid enums, malformed routing, or values outside these limits is rejected and never persisted.

A client cannot bypass these rules by modifying a previously generated proposal because the create endpoint canonicalizes and validates again.

## 8. Provider Abstraction

Add a provider-neutral server interface:

```ts
interface AiDraftProvider {
  generate(input: AiDraftGenerationInput): Promise<AiDraftProviderOutput>;
}
```

Initial implementations:

- `OpenAiDraftProvider`: production implementation;
- `FakeAiDraftProvider`: deterministic test implementation.

Application services depend on `AiDraftProvider`, not directly on an SDK client. Provider selection is server configuration. The browser cannot choose a provider or model.

## 9. OpenAI Provider Contract

The initial production adapter uses the OpenAI Responses API from the backend with the official TypeScript/JavaScript SDK.

Provider behavior:

1. API key is loaded only from server environment configuration;
2. model name comes from `OPENAI_MODEL`; product code does not hard-code a model ID;
3. the request uses Responses API Structured Outputs with `type: json_schema` and strict schema adherence;
4. `store: false` is set because this synchronous flow does not require provider-side response state;
5. no tools are enabled;
6. no web search, file search, function calling, or external retrieval is exposed to the model;
7. provider calls use the configured bounded timeout;
8. raw provider error bodies are never forwarded to the client;
9. refusal, incomplete response, empty output, invalid JSON/schema output, or application-invalid output are handled as failed generation;
10. provider request IDs may be logged for diagnosis, but API keys, full prompts, and full model responses are not written to ordinary application logs.

The prompt instructs the model to draft only from user-provided process facts, avoid inventing legal/regulatory references, avoid inventing organization-specific identifiers, and return only the requested structured object.

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

Exact validation:

- authenticated user must own `workspaceId`;
- `deskripsiProses`: trimmed, required, 20-8,000 characters;
- `tujuanProses`: trimmed, optional, maximum 2,000 characters;
- `catatanTambahan`: trimmed, optional, maximum 4,000 characters;
- empty optional values are omitted;
- the server loads workspace actor names ordered by name and sends at most 100 unique normalized names as reusable vocabulary/context;
- database IDs are never sent to the provider.

The request does not contain `nomorSop` or authoritative `namaLembaga`; those values are supplied by the user only during confirmation.

## 11. API Contract

### `GET /sop/ai-drafts/availability`

Authenticated endpoint returning:

```ts
{ enabled: boolean }
```

It exposes neither key configuration details nor model name. `enabled` is true only when the selected provider is operationally configured.

### `POST /sop/ai-drafts/generate`

Requires authentication and owned workspace.

Response:

```ts
{
  proposal: AiDraftProposal;
}
```

This endpoint performs zero application database writes.

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
2. trim and validate identity fields using existing database limits;
3. revalidate and canonicalize the proposal;
4. ignore client-supplied `pelaksanaId` values as authoritative input;
5. re-resolve current workspace actors by normalized name so actor state may safely change between generation and confirmation;
6. instantiate the draft in one transaction;
7. return minimal `{ sopId, detailSopId, workspaceId, status }` identity for navigation.

The create route does not call the model again.

## 12. Shared Draft Instantiation Boundary

Iteration 3 already implements transactional creation from a template. AI creation needs the same invariants. The transaction must not be duplicated.

Extract one focused internal draft-instantiation service used by template creation and AI creation, with no public controller.

Preferred location:

`server/src/modules/sop/draft/sop-draft-instantiation.service.ts`

Input is a canonical draft definition containing identity, lampiran, ordered actor names, steps, and decision routing.

It owns:

- `SOP` DRAFT creation;
- `DetailSOP` version 1 creation;
- deterministic actor reuse/create;
- `DetailSOPPelaksana` ordering;
- lampiran creation;
- two-pass procedure-step and decision-target creation;
- initial edit-log creation;
- transaction atomicity.

Duplicate SOP-number conflicts remain mapped by the calling template/AI service to the existing conflict response.

Blank SOP creation remains unchanged. Iteration 4 must not refactor unrelated catalog/editor logic.

## 13. Server Module Boundaries

Add a focused AI drafting submodule:

- `server/src/modules/sop/ai-draft/sop-ai-draft.controller.ts`
- `server/src/modules/sop/ai-draft/sop-ai-draft.service.ts`
- `server/src/modules/sop/ai-draft/sop-ai-draft.schema.ts`
- `server/src/modules/sop/ai-draft/sop-ai-draft.mapper.ts`
- `server/src/modules/sop/ai-draft/providers/ai-draft-provider.ts`
- `server/src/modules/sop/ai-draft/providers/openai-draft.provider.ts`
- `server/src/modules/sop/ai-draft/providers/fake-ai-draft.provider.ts`
- DTOs and specs colocated with the module.

Responsibilities:

- controller: transport/authenticated request boundary;
- service: workspace authorization, availability, provider orchestration, actor context, proposal canonicalization, confirmation orchestration, error mapping;
- provider: external model request only;
- schema/mapper: provider-output parsing and domain validation;
- draft-instantiation service: database mutation only after confirmation.

No Prisma model or migration is added for AI drafting.

## 14. Client Boundaries

Extend the existing workspace creation surface instead of adding a second editor page.

`WorkspaceDetailPage` gains:

```ts
type CreateSource = 'blank' | 'template' | 'ai';
```

AI state is transient client state only:

- description/context input;
- availability state;
- generation pending/error state;
- generated proposal;
- user identity fields.

On successful confirmation, navigate to the existing SOP editor exactly like template creation.

Switching away from `Dengan AI` clears generated proposal state. Editing any generation input after a proposal exists also invalidates/clears that proposal, requiring regeneration before confirmation. This prevents stale preview confirmation.

## 15. Error Handling

Stable application mapping:

- provider disabled or not configured: HTTP 503;
- provider timeout/network failure: HTTP 503;
- upstream provider rate limit: HTTP 503 with a user-safe retry message;
- provider refusal/incomplete/empty/invalid structured output: HTTP 422 with a regenerate-oriented message;
- invalid user input: HTTP 400;
- workspace not owned: existing authorization behavior;
- duplicate SOP number during confirmation: existing HTTP conflict behavior;
- transaction failure: no partial SOP data remains.

No raw provider response/error body is returned to the client. Generation errors do not affect blank or template creation.

## 16. Security and Privacy

1. provider API keys exist only in backend environment variables;
2. no provider key or model call is made from browser code;
3. generated proposals are treated as untrusted external input and validated before use;
4. confirmation revalidates all client-supplied proposal fields;
5. provider prompts contain only data needed to generate the requested draft;
6. database IDs are excluded from provider input;
7. automatic web/file retrieval is disabled;
8. API logs must not contain secrets;
9. ordinary logs record operational metadata rather than full prompts or full responses;
10. generation never bypasses workspace ownership checks;
11. AI output never attaches regulations automatically;
12. `store: false` is used for OpenAI Responses API calls;
13. the user must review generated administrative content before completing the SOP.

## 17. Runtime Configuration

Add explicit server configuration validation:

- `AI_DRAFT_PROVIDER=disabled|openai`, default `disabled`;
- `OPENAI_API_KEY`, required and non-empty when provider is `openai`;
- `OPENAI_MODEL`, required and non-empty when provider is `openai`;
- `AI_DRAFT_TIMEOUT_MS`, optional integer from 5,000 through 60,000, default 30,000.

If `AI_DRAFT_PROVIDER=openai` but required OpenAI configuration is missing, application startup fails configuration validation. With the default `disabled` value, the application boots without any OpenAI credential.

Update `.env.production.example` with placeholders only. No real credential is committed. Provider credentials are runtime values and are not required while building container images.

## 18. Testing Strategy

### Unit / contract tests

Cover:

- DTO whitespace and exact length validation;
- availability behavior;
- workspace ownership assertion;
- actor-context cap and exclusion of database IDs;
- strict provider-output parsing;
- canonicalization and actor de-duplication;
- step-order remapping;
- invalid decision targets;
- non-decision branches;
- all field/count limits;
- provider disabled/timeout/rate-limit/refusal mapping;
- create-time revalidation;
- changed actor state between generate and create;
- transactional instantiation;
- duplicate SOP-number conflict mapping.

### Provider tests

Mandatory CI never calls a paid/live provider.

`FakeAiDraftProvider` returns deterministic structured output so application behavior is independent of model variability.

`OpenAiDraftProvider` is tested behind a mocked official SDK boundary for:

- Responses API request shape;
- strict JSON-schema output format;
- `store: false`;
- no tools;
- configured model/timeout;
- refusal/incomplete/error mapping;
- provider output parsing.

### Client tests

Cover:

- third source `Dengan AI`;
- disabled/unavailable state;
- generate payload;
- read-only preview;
- input change invalidates stale proposal;
- regenerate behavior;
- identity requirements;
- final create payload;
- navigation to existing editor;
- switching source clears proposal state.

### E2E acceptance

Add one deterministic fake-provider journey:

`workspace -> Dengan AI -> description -> generate -> preview -> confirm identity -> create -> existing editor -> verify prefilled steps/lampiran -> edit -> autosave -> reload -> Flowchart/BPMN -> Complete -> Create New Version`.

Existing blank and template journeys remain mandatory regression coverage.

### Production contract

Production Compose verifies:

- app boots with `AI_DRAFT_PROVIDER=disabled` and no OpenAI key;
- provider credentials are not build-time requirements;
- existing migration/seed/persistence/readiness/PDF/backup/restore checks remain green;
- Iteration 4 introduces no Prisma migration.

## 19. Acceptance Criteria

Iteration 4 is complete only when all are true:

1. user can select `Dengan AI` from the existing workspace SOP creation surface;
2. generation requires an owned workspace and performs zero application DB writes;
3. OpenAI production calls are backend-only and use Responses API strict Structured Outputs;
4. provider output also passes application domain validation;
5. preview clearly shows actors, steps, routing, and lampiran before persistence;
6. user supplies/edits `judul`, `nomorSop`, and `namaLembaga` before confirmation;
7. confirmation revalidates proposal and current actor state;
8. one transaction creates a normal editable `DRAFT` with no partial data on failure;
9. generated draft enters the existing editor with no AI-specific editor mode;
10. autosave, reload, Flowchart/BPMN, completion, version cloning, print/PDF remain compatible;
11. blank and template creation still work when AI is disabled or fails;
12. mandatory CI uses no live paid AI request;
13. no new Prisma migration is introduced;
14. no automatic regulation attachment or removed legacy domain is restored.

## 20. Implementation Boundary

After this design spec is approved, implementation continues on the same short-lived task branch/PR.

The implementation plan must use TDD and sequence work as:

1. provider-output schema and validation RED/GREEN;
2. provider abstraction, fake provider, OpenAI adapter, and configuration RED/GREEN;
3. generation service/API RED/GREEN;
4. shared draft-instantiation extraction with Iteration 3 regression coverage;
5. confirmed AI create API RED/GREEN;
6. client AI source/preview/create RED/GREEN;
7. deterministic E2E acceptance;
8. production contract/configuration;
9. final review and mandatory CI.

Do not begin a subsequent iteration from this document. Iteration transition remains explicit.