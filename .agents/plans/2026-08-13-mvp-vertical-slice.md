# Iteration 1 — MVP Vertical Slice Implementation Plan

**Goal:** menyediakan satu acceptance journey yang dapat dieksekusi terhadap real frontend, backend, dan database untuk product Workspace/SOP saat ini.

**Working branch:** `feat/mvp-vertical-slice`
**Iteration status:** `COMPLETE`
**Fresh verification:** GitHub Actions run #145 pada head `9c06a9482` — server, client, dan E2E `success`.

## Task 1 — Current-model E2E bootstrap

**Files:**
- Create: `server/prisma/seed-e2e.ts`
- Add/Modify focused tests for E2E session/bootstrap helper as needed

- [x] RED: test deterministic E2E identity/session contract.
- [x] Implement seed/session harness using current `User -> Workspace -> SOP` schema.
- [x] Clean only deterministic E2E user's owned data.
- [x] Issue JWT compatible with current `JwtAccessStrategy` and `accessToken` cookie.
- [x] Fail fast outside explicit E2E/test environment.

## Task 2 — Playwright authenticated state

**Files:**
- Modify: `client/e2e/global-setup.ts`
- Modify: `client/playwright.config.ts`

- [x] Replace legacy role/user seed assumptions.
- [x] Obtain deterministic token from server test harness.
- [x] Persist `.auth/user.json` with HTTP-only `accessToken` cookie and production-equivalent persisted auth state.
- [x] Verify `/auth/me` through real backend before running journey.

## Task 3 — Current MVP journey

**Files:**
- Create: `client/e2e/journeys/mvp-vertical-slice.spec.ts`
- Add minimal workspace pelaksana UI required by current editor.
- Fix E2E-proven editor layout regression.
- Exclude legacy Playwright specs from active acceptance surface.

- [x] Create workspace through UI.
- [x] Create workspace pelaksana through UI and select it in SOP authoring.
- [x] Create SOP through UI.
- [x] Edit a minimum valid three-step SOP and prove autosave survives reload.
- [x] Exercise Flowchart and BPMN rendering.
- [x] Exercise real PDF generation through blob print iframe creation.
- [x] Complete SOP and prove immutable/read-only behavior.
- [x] Create New Version and prove cloned data returns as editable `DRAFT` v2.

## Task 4 — E2E CI gate

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] Add disposable MySQL database service for E2E.
- [x] Generate/push Prisma schema only against CI E2E database.
- [x] Start real backend with E2E environment.
- [x] Install Playwright Chromium and run MVP journey.
- [x] Upload Playwright report/trace only on failure.
- [x] Keep server/client unit/typecheck/build mandatory.

## Task 5 — Final regression and iteration close

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Modify this plan

- [x] Run mandatory CI.
- [x] Confirm MVP E2E green against PR head (run #145).
- [x] Confirm no production auth bypass exists; `AuthController` remains Google login + authenticated `/me` + logout only.
- [x] Mark Iteration 1 `COMPLETE`.
- [x] Open one PR (#3) for the iteration.
- [ ] Complete final review, squash merge PR #3 to `master`, and verify master CI. This is the remaining integration step after functional iteration completion.

## E2E-Proven Fixes / Product Gaps Closed

- Dev client API default corrected from backend port `3000` to actual backend port `3001`.
- E2E auth state now mirrors production login state without adding an auth bypass endpoint.
- SOP editor right panel changed from unbounded `w-full` to bounded responsive width after E2E proved it pushed document/diagram controls outside the desktop viewport.
- Workspace now exposes minimal pelaksana creation/listing because the refactor had retained editor pelaksana selection while removing the only UI that could create those records.
- Legacy OPD/evaluation/TTE/public-archive Playwright journeys are no longer part of the active acceptance config.

## Non-goals Preserved

- New collaboration/multi-owner workspace features.
- UI redesign/polish unrelated to E2E blockers.
- Live Google OAuth automation in CI.
- Reintroducing OPD/evaluation/TTE/public archive compatibility.
- Performance optimization or dependency upgrades unrelated to this vertical slice.
