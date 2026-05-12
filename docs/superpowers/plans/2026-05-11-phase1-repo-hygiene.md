# Phase 1 — Repo Hygiene & Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm test` and CI green and fast, clean up working-tree garbage, and add a real `LICENSE` so the repo passes a 30-second hygiene check.

**Architecture:** Pure cleanup. The slowness/failure in `npm test` is almost certainly an open handle (MongoDB client kept alive after the test process should exit). Fix is a global Jest setup that mocks `db/mongo` so no test process ever touches a real Mongo. Everything else is file-level cleanup.

**Tech Stack:** Jest, Node.js, git.

**Spec reference:** `docs/superpowers/specs/2026-05-11-freightline-resume-polish-design.md` Phase 1.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/jest.setup.js` | Create | Global test setup that auto-mocks `db/mongo` so no test connects to a real Mongo. |
| `backend/package.json` | Modify | Add `jest.setupFiles` config; change `license` from `ISC` to `MIT`. |
| `.gitignore` | Modify | Add `.DS_Store`, `*.local`, and Finder-dupe pattern. |
| `frontend/src/index 2.css` | Delete | Finder dupe of `index.css` — should not exist. |
| `CLAUDE.md` | Restore | Discard stale uncommitted edit (already obsolete). |
| `LICENSE` | Create | MIT license text. |

---

## Task 1: Diagnose the slow / failing test suite

**Files:**
- Read-only: `backend/__tests__/loads.test.js`, `backend/__tests__/pings.test.js`, `backend/__tests__/liveHub.test.js`
- Working dir: `backend/`

- [ ] **Step 1: Run the suite with open-handle detection**

Run from `backend/`:
```bash
npm test -- --detectOpenHandles --forceExit 2>&1 | tee /tmp/jest-handles.log
```

This may still take a couple of minutes. `--forceExit` ensures it actually terminates.

- [ ] **Step 2: Inspect the open-handle output**

Run:
```bash
grep -A 20 "Jest has detected" /tmp/jest-handles.log
```

Expected: a section listing open handles. The most likely culprit is a TCP socket or `MongoClient` kept open by `backend/db/mongo.js`, kept alive because `backend/services/pingStore.js` is required transitively by `backend/routes/loads.js` (and through it, by `backend/app.js`). Module-level `require` doesn't connect, but the test framework still observes any handle that gets opened by other tests in the same run.

If `--detectOpenHandles` instead points at WebSockets in `liveHub.test.js`, jump to Task 2.5 (added below).

- [ ] **Step 3: Confirm the diagnosis by mocking `db/mongo` ad-hoc and re-running**

Temporarily prepend the top of `backend/__tests__/loads.test.js` with:
```js
jest.mock('../db/mongo', () => ({
  getMongoDb: jest.fn(),
  getPingCollection: jest.fn(),
  closeMongo: jest.fn(),
}))
```

Run only that file:
```bash
npm test -- __tests__/loads.test.js --forceExit
```

Expected: completes in under 5 seconds, all 7 tests in that file pass. If it does, diagnosis is confirmed — the global mock in Task 2 will fix it for all suites.

- [ ] **Step 4: Revert the ad-hoc mock**

Revert the temporary edit:
```bash
git restore backend/__tests__/loads.test.js
```

(Don't commit anything yet — Task 2 will add the proper global mock.)

---

## Task 2: Add a global Jest setup that mocks `db/mongo`

**Files:**
- Create: `backend/jest.setup.js`
- Modify: `backend/package.json` (add jest config block)

- [ ] **Step 1: Create `backend/jest.setup.js`**

Create the file with exactly:
```js
// Prevents any test from opening a real MongoDB connection.
// Tests that need to assert on Mongo calls should re-mock specific
// service functions (see __tests__/pings.test.js for an example).
jest.mock('./db/mongo', () => ({
  getMongoDb: jest.fn(),
  getPingCollection: jest.fn(),
  closeMongo: jest.fn(),
}))
```

- [ ] **Step 2: Wire the setup file into `backend/package.json`**

Open `backend/package.json` and add a `jest` block at the top level (sibling to `dependencies`). Use `setupFiles` (runs before the test framework loads — the right hook for top-level `jest.mock` calls):

```json
"jest": {
  "setupFiles": ["<rootDir>/jest.setup.js"]
}
```

Place the `jest` block immediately before `dependencies`. Do not delete or reorder anything else.

- [ ] **Step 3: Run the full backend test suite**

Run:
```bash
cd backend && time npm test
```

Expected:
- All 26 tests pass
- Total wall-clock time under 10 seconds (your local machine; CI may be a bit slower)
- No "Jest did not exit" warning at the end
- No `--forceExit` needed

- [ ] **Step 4: If tests still hang, check `liveHub.test.js`**

If the suite is still slow after Task 2 Step 3, the open handle is in `liveHub.test.js` — the WebSocket server isn't closing. Open `backend/__tests__/liveHub.test.js` and verify the `afterEach` block looks like:

```js
afterEach((done) => {
  hub.close().then(() => server.close(done))
})
```

If `hub.close()` returns a Promise but `server.close(done)` doesn't fire reliably, change to:
```js
afterEach(async () => {
  await hub.close()
  await new Promise((resolve) => server.close(resolve))
})
```

Re-run Step 3.

- [ ] **Step 5: Commit**

```bash
git add backend/jest.setup.js backend/package.json
git commit -m "test: prevent jest from opening real mongo connections

Adds a setupFiles entry that auto-mocks db/mongo so importing the
loads router (which transitively requires pingStore -> mongo) does
not keep a TCP handle open after tests should exit. Reduces local
test wall time from ~5min (with --forceExit) to under 10 seconds."
```

If you also edited `liveHub.test.js`, include it in the same commit.

---

## Task 3: Clean working tree

**Files:**
- Restore: `CLAUDE.md` (discard uncommitted edits)
- Delete: `frontend/src/index 2.css`
- Modify: `.gitignore`

- [ ] **Step 1: Inspect what's in CLAUDE.md before discarding**

Run:
```bash
git diff CLAUDE.md
```

The diff updates Week-2 status notes that are now several weeks out of date (project is now post-live-tracking-dashboard). The diff has no future value.

- [ ] **Step 2: Discard the stale CLAUDE.md edit**

Run:
```bash
git restore CLAUDE.md
```

Note: Updating `CLAUDE.md` to reflect *current* project state is **out of scope** for Phase 1 (it's a personal coaching file, doesn't ship). If you want to refresh it later, do it as a separate commit.

- [ ] **Step 3: Delete the Finder dupe CSS file**

Run:
```bash
rm "frontend/src/index 2.css"
```

Verify it's gone:
```bash
ls "frontend/src/index 2.css" 2>&1
```
Expected: `ls: frontend/src/index 2.css: No such file or directory`

- [ ] **Step 4: Update `.gitignore` to prevent future Finder dupes and OS junk**

Open `.gitignore` and replace its contents with:

```
node_modules/
.env
dist/

# OS / editor noise
.DS_Store
Thumbs.db
*.swp
*.local

# Finder duplicates ("file 2.ext", "file 3.ext")
* [0-9].*
```

- [ ] **Step 5: Verify `.gitignore` works**

Run:
```bash
git status --short
```

Expected: only `M .gitignore` (no untracked files anymore — `index 2.css` is deleted, and any `.DS_Store` files are now ignored).

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: clean working tree and harden gitignore

- Discard stale Week-2-era CLAUDE.md edit
- Delete frontend/src/index 2.css (macOS Finder dupe)
- Ignore .DS_Store, *.local, and Finder-dupe pattern so they
  never sneak back in"
```

---

## Task 4: Add MIT LICENSE

**Files:**
- Create: `LICENSE`
- Modify: `backend/package.json` (license field)

- [ ] **Step 1: Create `LICENSE` at repo root**

Create the file with this exact content (replace `Jordan Umpierre` if you prefer a different name on the copyright):

```
MIT License

Copyright (c) 2026 Jordan Umpierre

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Update `backend/package.json` `license` field**

Find the line:
```json
"license": "ISC",
```

Change to:
```json
"license": "MIT",
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE backend/package.json
git commit -m "docs: add MIT LICENSE and align package.json license field"
```

---

## Task 5: Push and verify CI

**Files:** None (git operation only)

- [ ] **Step 1: Push to main**

Run:
```bash
git push origin main
```

- [ ] **Step 2: Watch the CI run**

Open: https://github.com/jordan-umpierre/Freightline-App/actions

Wait for the latest run (will be on commit added by Task 4 Step 3) to finish. Both `backend` and `frontend` jobs should be green.

- [ ] **Step 3: If CI is red, diagnose and fix**

If `backend` job fails: pull the failing job's logs, identify whether the failure is the same handle issue (might mean the global mock didn't cover something CI hits) or something new. Fix locally, re-run `npm test` to confirm, commit, push.

If `frontend` job fails: almost certainly a lint or build issue. Run `npm run lint && npm run build` from `frontend/` locally to reproduce.

Do not move to Phase 2 until CI is green.

- [ ] **Step 4: Verify the smoke test still passes**

Even with CI green, do one manual smoke check that nothing in the deployed app broke:

```bash
curl -sS https://freightline-app-production.up.railway.app/ && echo
```

Expected: `{"name":"Freightline API","status":"ok"}`

(Phase 1 didn't touch deployed code, but a sanity check costs nothing.)

---

## Acceptance criteria (from spec)

- [x] `cd backend && npm test` passes all 26 tests in under 5 seconds — verified in Task 2 Step 3
- [x] `cd frontend && npm run lint && npm run build` succeeds — already passes
- [x] Latest CI run on `main` is green — verified in Task 5 Step 2
- [x] `git status` is clean — verified after Task 3 Step 6
- [x] `LICENSE` file exists at repo root — verified after Task 4 Step 3

---

## Notes for the executor

- This phase is unusually light on TDD because most tasks aren't writing application code — they're cleanup and infrastructure. The "test" for each task is the verification step at the end.
- If Task 1's diagnosis surfaces a *different* open handle than expected (e.g., a `pg.Pool` kept alive somewhere), adapt Task 2's mock to cover whatever the real culprit is. The shape of the fix is right; the specific module being mocked might shift.
- The three commits in this phase are intentionally separable so you can stop and reassess after any of them. If you only have time for Task 2 in one sitting, that alone unblocks CI and is worth shipping.
