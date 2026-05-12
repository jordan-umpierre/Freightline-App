# Phase 3 — Frontend RTL Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "no frontend tests" gap with a small, defensible Vitest + React Testing Library suite (3 tests + 1 helper unit test) that covers the role-based UI logic at the heart of the freight workflow.

**Architecture:** Add Vitest as the frontend test runner (lighter than Jest, native Vite integration). Mock `fetch` per-test (no MSW yet — overkill for this scope). Pull the `exceptionTone` helper out of `App.jsx` into its own module so it's directly unit-testable. Otherwise leave `App.jsx` alone.

**Tech Stack:** Vitest, React Testing Library, `@testing-library/user-event`, `@testing-library/jest-dom`, jsdom.

**Spec reference:** `docs/superpowers/specs/2026-05-11-freightline-resume-polish-design.md` Phase 3.

**Prerequisite:** Phase 1 plan complete and CI green.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/package.json` | Modify | Add Vitest + RTL deps; add `test` script. |
| `frontend/vitest.config.js` | Create | Vitest config with jsdom + setup file. |
| `frontend/src/test/setup.js` | Create | Global test setup — imports jest-dom matchers. |
| `frontend/src/lib/exceptionTone.js` | Create | Extract pure helper from `App.jsx` for direct unit testing. |
| `frontend/src/App.jsx` | Modify | Replace inline `exceptionTone` definition with import from the new module. |
| `frontend/src/__tests__/exceptionTone.test.js` | Create | Unit test for the extracted helper. |
| `frontend/src/__tests__/AuthScreen.test.jsx` | Create | RTL test for login form behavior + error rendering. |
| `frontend/src/__tests__/LoadList.test.jsx` | Create | RTL test for role-based action button rendering. |
| `.github/workflows/ci.yml` | Modify | Run `npm test` after lint, before build, in the frontend job. |

Note: `AuthScreen` and `LoadList` are currently defined as components inside `App.jsx` and aren't exported. Two options: (a) export them from `App.jsx` so tests can import them, or (b) extract them into their own files. Option (a) is the smaller change and avoids touching App.jsx structure. **This plan uses option (a).**

---

## Task 1: Install dependencies and add `test` script

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dev dependencies**

Run from `frontend/`:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Verify the versions land in `package.json` `devDependencies`:
```bash
grep -E "vitest|testing-library|jsdom" package.json
```

Expected: 5 lines with the new packages.

- [ ] **Step 2: Add `test` script**

Open `frontend/package.json` and update the `scripts` block to add a `test` line. Final scripts block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "test": "vitest run",
  "preview": "vite preview"
}
```

Use `vitest run` (not bare `vitest`) so CI doesn't enter watch mode.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add vitest + react testing library deps"
```

---

## Task 2: Add Vitest config and setup file

**Files:**
- Create: `frontend/vitest.config.js`
- Create: `frontend/src/test/setup.js`

- [ ] **Step 1: Create `frontend/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
```

`globals: true` means `describe`, `test`, `expect` are global (no per-file imports). `css: false` skips CSS processing during tests (faster, and no test cares about styles).

- [ ] **Step 2: Create `frontend/src/test/setup.js`**

```js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

Imports the custom matchers (`toBeInTheDocument`, etc.) and ensures every test starts with a clean DOM.

- [ ] **Step 3: Verify Vitest is wired correctly with a smoke test**

Create a temporary smoke test at `frontend/src/__tests__/_smoke.test.js`:
```js
test('smoke', () => {
  expect(1 + 1).toBe(2)
})
```

Run from `frontend/`:
```bash
npm test
```

Expected: 1 test passes, completes in under 5 seconds.

Delete the smoke test:
```bash
rm src/__tests__/_smoke.test.js
```

- [ ] **Step 4: Commit**

```bash
git add frontend/vitest.config.js frontend/src/test/setup.js
git commit -m "test(frontend): add vitest config with jsdom and global setup"
```

---

## Task 3: Extract `exceptionTone` helper and add unit test (TDD)

**Files:**
- Create: `frontend/src/lib/exceptionTone.js`
- Create: `frontend/src/__tests__/exceptionTone.test.js`
- Modify: `frontend/src/App.jsx` (replace inline definition with import)

- [ ] **Step 1: Write the failing test first**

Create `frontend/src/__tests__/exceptionTone.test.js`:
```js
import { exceptionTone } from '../lib/exceptionTone'

describe('exceptionTone', () => {
  test('returns success color when no exceptions', () => {
    expect(exceptionTone([])).toBe('#2e8f6d')
  })

  test('returns warning color for non-critical exceptions', () => {
    expect(exceptionTone([{ severity: 'warning' }])).toBe('#d69a1c')
  })

  test('returns critical color when any exception is critical', () => {
    const exceptions = [{ severity: 'warning' }, { severity: 'critical' }]
    expect(exceptionTone(exceptions)).toBe('#b4502a')
  })

  test('handles missing exceptions argument', () => {
    expect(exceptionTone()).toBe('#2e8f6d')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `frontend/`:
```bash
npm test -- src/__tests__/exceptionTone.test.js
```

Expected: failure — `Cannot find module '../lib/exceptionTone'` or similar.

- [ ] **Step 3: Create the module**

Create `frontend/src/lib/exceptionTone.js`:
```js
export function exceptionTone(exceptions = []) {
  if (exceptions.some((exception) => exception.severity === 'critical')) return '#b4502a'
  if (exceptions.length > 0) return '#d69a1c'
  return '#2e8f6d'
}
```

This is the same logic that's currently inline in `App.jsx` at line ~132.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/__tests__/exceptionTone.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Replace the inline definition in `App.jsx`**

Open `frontend/src/App.jsx`. At the top of the file, after the existing `import './App.css'` line, add:
```js
import { exceptionTone } from './lib/exceptionTone'
```

Then find and **delete** the inline definition (around line 132 — the function `function exceptionTone(exceptions = []) { ... }` block, all 4 lines).

- [ ] **Step 6: Verify the app still builds**

Run from `frontend/`:
```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/exceptionTone.js frontend/src/__tests__/exceptionTone.test.js frontend/src/App.jsx
git commit -m "test(frontend): extract exceptionTone helper and add unit tests

Pulls the inline exceptionTone helper out of App.jsx so it can be
unit-tested directly. Tests the three branches (no exceptions /
warning / critical) plus the missing-argument case."
```

---

## Task 4: Export `AuthScreen` and `LoadList` from App.jsx for testing

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add named exports**

Open `frontend/src/App.jsx`. At the very bottom of the file, after `export default App`, add:
```js
export { AuthScreen, LoadList }
```

Do not change the function declarations themselves — they remain `function AuthScreen(...)` etc.

- [ ] **Step 2: Verify the app still builds**

```bash
cd frontend && npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "refactor(frontend): export AuthScreen and LoadList for unit testing"
```

---

## Task 5: AuthScreen test (TDD)

**Files:**
- Create: `frontend/src/__tests__/AuthScreen.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/AuthScreen.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AuthScreen } from '../App'

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockReset()
  })

  test('renders login form by default', () => {
    render(<AuthScreen onToken={vi.fn()} />)

    expect(screen.getByRole('button', { name: /enter dashboard/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument()
  })

  test('switches to register mode and shows extra fields', async () => {
    const user = userEvent.setup()
    render(<AuthScreen onToken={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /^register$/i }))

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
  })

  test('surfaces server error on failed login', async () => {
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: async () => JSON.stringify({ error: 'Invalid credentials' }),
    })

    render(<AuthScreen onToken={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'demo@test.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /enter dashboard/i }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  test('calls onToken with the returned token on successful login', async () => {
    const onToken = vi.fn()
    const user = userEvent.setup()
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ token: 'abc.def.ghi' }),
    })

    render(<AuthScreen onToken={onToken} />)

    await user.type(screen.getByLabelText(/email/i), 'demo@test.com')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /enter dashboard/i }))

    await vi.waitFor(() => expect(onToken).toHaveBeenCalledWith('abc.def.ghi'))
  })
})
```

- [ ] **Step 2: Run the tests to verify they pass**

```bash
cd frontend && npm test -- src/__tests__/AuthScreen.test.jsx
```

Expected: 4 tests pass. If any fail, the most likely cause is a label-text mismatch — the test uses regex (`/email/i`) so capitalization doesn't matter, but typos do. Look at the actual JSX in `App.jsx` to confirm label text.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/AuthScreen.test.jsx
git commit -m "test(frontend): add AuthScreen tests covering login, register, and error states"
```

---

## Task 6: LoadList test (TDD)

**Files:**
- Create: `frontend/src/__tests__/LoadList.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/LoadList.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LoadList } from '../App'

const postedLoad = {
  id: 'load-1',
  status: 'posted',
  origin_address: 'Kansas City, MO',
  destination_address: 'Dallas, TX',
  weight_lbs: 18000,
  rate_cents: 240000,
}

const assignedLoad = {
  id: 'load-2',
  status: 'assigned',
  origin_address: 'Chicago, IL',
  destination_address: 'Atlanta, GA',
  weight_lbs: 26000,
  rate_cents: 315000,
}

function driverActions(load) {
  if (load.status === 'posted') return <button>Accept</button>
  if (load.status === 'assigned') return <button>Start</button>
  return null
}

describe('LoadList', () => {
  test('renders rows for each load', () => {
    render(
      <LoadList
        title="Available freight"
        loads={[postedLoad, assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Kansas City, MO')).toBeInTheDocument()
    expect(screen.getByText('Atlanta, GA')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // count badge
  })

  test('renders driver-specific Accept button for posted loads', () => {
    render(
      <LoadList
        title="Available freight"
        loads={[postedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
        actions={driverActions}
      />
    )

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  test('renders driver-specific Start button for assigned loads', () => {
    render(
      <LoadList
        title="Active freight"
        loads={[assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
        actions={driverActions}
      />
    )

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  test('renders no action buttons when actions prop is omitted (shipper view)', () => {
    render(
      <LoadList
        title="Posted freight"
        loads={[postedLoad, assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
```

Note: this tests the **`LoadList` component's contract** (it renders whatever `actions` returns), not the role-determination logic in `App` itself. That's intentional — `actions` is the seam, and testing through that seam covers what matters without coupling to `App`'s state.

- [ ] **Step 2: Run the tests**

```bash
cd frontend && npm test -- src/__tests__/LoadList.test.jsx
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/LoadList.test.jsx
git commit -m "test(frontend): add LoadList tests for role-based action rendering"
```

---

## Task 7: Update CI to run frontend tests

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `npm test` to the frontend job**

Open `.github/workflows/ci.yml`. The frontend job currently runs:
```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

Change it to:
```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run frontend tests in the CI pipeline"
git push origin main
```

- [ ] **Step 3: Verify CI is green**

Open https://github.com/jordan-umpierre/Freightline-App/actions and watch the latest run. Both `backend` and `frontend` jobs must pass.

If the frontend job fails on the `npm test` step, run the same command locally to reproduce, fix, commit, push.

---

## Task 8: Run the full local test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests locally**

From the repo root:
```bash
(cd backend && npm test) && (cd frontend && npm test)
```

Expected:
- Backend: 26 tests pass in <10 seconds
- Frontend: 12 tests pass in <10 seconds (4 exceptionTone + 4 AuthScreen + 4 LoadList)

If both pass, Phase 3 is done.

---

## Acceptance criteria (from spec)

- [x] `cd frontend && npm test` runs and passes — Tasks 5–7
- [x] CI's frontend job runs frontend tests after lint, before build — Task 7
- [x] At least three tests covering role-based UI logic — `AuthScreen` (4), `LoadList` (4 — covers role-driven action rendering), `exceptionTone` (4 — covers exception severity display contract)

---

## Notes for the executor

- If a test is flaky in the watcher but passes with `vitest run`, it's almost always a missing `await` on a `userEvent` interaction or a `findBy*` query.
- Don't be tempted to mock more than `fetch`. Per-test `global.fetch = vi.fn()` is enough for this scope. MSW would be the right call if/when there are >10 tests sharing fixtures.
- Resist the urge to test `App.jsx` itself (the giant orchestrator). Its useEffect chains depend on multiple async fetches; testing them well requires either a heavy mock setup or MSW. Three focused tests on stable contracts is more defensible than five flaky ones.
