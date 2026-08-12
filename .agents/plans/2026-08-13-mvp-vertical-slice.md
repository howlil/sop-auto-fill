# Iteration 1 — MVP Vertical Slice Implementation Plan

**Goal:** menyediakan satu acceptance journey yang dapat dieksekusi terhadap real frontend, backend, dan database untuk product Workspace/SOP saat ini.

**Working branch:** `feat/mvp-vertical-slice`

## Task 1 — Current-model E2E bootstrap

**Files:**
- Create: `server/prisma/seed-e2e.ts`
- Add/Modify focused tests for E2E session/bootstrap helper as needed
- Modify: `server/package.json` only if command contract needs adjustment

- [ ] RED: test deterministic E2E identity/session contract.
- [ ] Implement seed/session harness using current `User -> Workspace -> SOP` schema.
- [ ] Clean only deterministic E2E user's owned data.
- [ ] Issue JWT compatible with current `JwtAccessStrategy` and `accessToken` cookie.
- [ ] Fail fast outside explicit E2E/test environment.

## Task 2 — Playwright authenticated state

**Files:**
- Modify: `client/e2e/global-setup.ts`
- Add/Modify: `client/e2e/support/*`
- Modify: `client/playwright.config.ts`

- [ ] Replace legacy role/user seed assumptions.
- [ ] Obtain deterministic token from server test harness.
- [ ] Persist `.auth/user.json` with HTTP-only `accessToken` cookie for test base URL.
- [ ] Verify `/auth/me` through real backend before running journey.

## Task 3 — Current MVP journey

**Files:**
- Create: `client/e2e/journeys/mvp-vertical-slice.spec.ts`
- Remove or exclude legacy Playwright specs/support that represent deleted domains.

- [ ] Create workspace through UI.
- [ ] Create SOP through UI.
- [ ] Edit minimum meaningful SOP data and prove autosave survives reload.
- [ ] Exercise Flowchart and BPMN rendering.
- [ ] Complete SOP and prove immutable/read-only behavior.
- [ ] Create New Version and prove cloned data returns as editable `DRAFT`.
- [ ] Exercise print/PDF path without changing protected rendering code.

## Task 4 — E2E CI gate

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] Add disposable database service for E2E.
- [ ] Generate/push Prisma schema only against CI test database.
- [ ] Start real backend with E2E env.
- [ ] Install Playwright Chromium and run MVP journey.
- [ ] Upload Playwright report/trace only on failure.
- [ ] Keep server/client unit/typecheck/build mandatory.

## Task 5 — Final regression and iteration close

**Files:**
- Modify: `.agents/CURRENT_ITERATION.md`
- Modify this plan checkboxes/status

- [ ] Run mandatory CI.
- [ ] Confirm MVP E2E green against PR head.
- [ ] Confirm no production auth bypass exists.
- [ ] Mark Iteration 1 `COMPLETE`.
- [ ] Open one PR, review blockers, squash merge to `master`, then verify master CI.

## Non-goals

- New collaboration/multi-owner workspace features.
- UI redesign/polish unrelated to E2E blockers.
- Live Google OAuth automation in CI.
- Reintroducing OPD/evaluation/TTE/public archive compatibility.
- Performance optimization or dependency upgrades unrelated to this vertical slice.
