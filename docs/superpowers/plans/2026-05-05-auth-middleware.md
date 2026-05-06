# Auth Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `authenticate` and `authorize` middleware in `backend/middleware/auth.js` so routes can be protected by login status and user role.

**Architecture:** Two composable Express middleware functions exported from a single file. `authenticate` verifies the JWT and attaches `req.user`. `authorize(roles)` checks `req.user.role` against an allowed list. They chain together on role-restricted routes.

**Tech Stack:** Node/Express, `jsonwebtoken`, `dotenv` (JWT_SECRET already in .env)

---

## File Map

| File | Action |
|---|---|
| `backend/middleware/auth.js` | Create — exports `authenticate` and `authorize` |
| `backend/index.js` | Modify temporarily — add a test route to verify middleware, remove after |

---

### Task 1: Verify auth endpoints before touching anything

Before writing middleware, confirm the foundation works. Start your server and run these curl commands. Save the token from registration — you'll need it in later tasks.

- [ ] **Start the server**

```bash
cd backend && node index.js
```

Expected: `DB connected: ...` and `Example app listening on port 3000`

- [ ] **Register a shipper**

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Alice","last_name":"Smith","email":"alice@test.com","password":"secret123","role":"shipper"}' \
  | jq
```

Expected: `{ "token": "<jwt string>" }`

- [ ] **Register a driver**

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Bob","last_name":"Jones","email":"bob@test.com","password":"secret123","role":"driver"}' \
  | jq
```

Expected: `{ "token": "<jwt string>" }`

- [ ] **Save both tokens** — copy them somewhere (a scratchpad, two terminal env vars, whatever works). You'll need them for curl tests in later tasks.

```bash
# Tip: in your terminal you can do:
SHIPPER_TOKEN="paste-alice-token-here"
DRIVER_TOKEN="paste-bob-token-here"
```

- [ ] **Commit** — nothing changed, but confirm your baseline is clean

```bash
git status
# Should show: nothing to commit
```

---

### Task 2: Create `backend/middleware/auth.js` with `authenticate`

- [ ] **Create the file**

```bash
mkdir -p backend/middleware
touch backend/middleware/auth.js
```

- [ ] **Write the `authenticate` function**

The function signature is a standard Express middleware: `(req, res, next) => { ... }`

Think through each step from the spec:
1. Pull the token out of `req.headers.authorization` — the format is `"Bearer <token>"`, so you'll need to split on the space and take the second part
2. If there's no header or no token after splitting, return early with `401`
3. Use `jwt.verify(token, process.env.JWT_SECRET)` — wrap in try/catch since it throws on failure
4. On success, attach the decoded payload to `req.user`, then call `next()`
5. In the catch, return `401`

Exports: `module.exports = { authenticate }`

Hint on the header parsing:
```js
const authHeader = req.headers.authorization
// authHeader might be undefined, or "Bearer abc123"
// .split(' ') gives you ["Bearer", "abc123"]
```

- [ ] **Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat: add authenticate middleware"
```

---

### Task 3: Wire `authenticate` to a temporary test route and verify

This is the fastest feedback loop — one throwaway route in `index.js` that you'll delete after confirming the middleware works.

- [ ] **Add a test route to `backend/index.js`**

After the auth router line, add:

```js
const { authenticate } = require('./middleware/auth')

app.get('/protected-test', authenticate, (req, res) => {
  res.json({ message: 'You are in', user: req.user })
})
```

- [ ] **Restart the server and test: no token**

```bash
curl -s http://localhost:3000/protected-test | jq
```

Expected: `{ "error": "No token provided" }` with status 401

- [ ] **Test: garbage token**

```bash
curl -s http://localhost:3000/protected-test \
  -H "Authorization: Bearer notarealtoken" \
  | jq
```

Expected: `{ "error": "Invalid token" }` with status 401

- [ ] **Test: valid shipper token**

```bash
curl -s http://localhost:3000/protected-test \
  -H "Authorization: Bearer $SHIPPER_TOKEN" \
  | jq
```

Expected: `{ "message": "You are in", "user": { "user_id": "...", "role": "shipper", ... } }`

- [ ] **Commit**

```bash
git add backend/index.js
git commit -m "feat: wire authenticate middleware to test route"
```

---

### Task 4: Add `authorize` to `backend/middleware/auth.js`

- [ ] **Write the `authorize` function**

`authorize` is a function that *returns* a middleware function. This pattern is called a "middleware factory" — it lets you pass arguments (the roles array) to a middleware.

Shape:
```js
const authorize = (roles) => {
  return (req, res, next) => {
    // check req.user.role against roles array
    // if not included: 403
    // if included: next()
  }
}
```

Hint: `Array.prototype.includes()` is your friend here.

- [ ] **Update exports**

```js
module.exports = { authenticate, authorize }
```

- [ ] **Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat: add authorize middleware factory"
```

---

### Task 5: Update test route to use `authorize` and verify role enforcement

- [ ] **Update the test route in `backend/index.js`**

Import `authorize` alongside `authenticate`, then update the route to only allow `driver`:

```js
const { authenticate, authorize } = require('./middleware/auth')

app.get('/protected-test', authenticate, authorize(['driver']), (req, res) => {
  res.json({ message: 'You are in', user: req.user })
})
```

- [ ] **Restart and test: shipper token (wrong role)**

```bash
curl -s http://localhost:3000/protected-test \
  -H "Authorization: Bearer $SHIPPER_TOKEN" \
  | jq
```

Expected: `{ "error": "Forbidden" }` with status 403

- [ ] **Test: driver token (correct role)**

```bash
curl -s http://localhost:3000/protected-test \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  | jq
```

Expected: `{ "message": "You are in", "user": { "role": "driver", ... } }`

- [ ] **Commit**

```bash
git add backend/index.js
git commit -m "test: verify role enforcement on protected test route"
```

---

### Task 6: Clean up and push

- [ ] **Remove the test route from `backend/index.js`**

Delete these lines:

```js
const { authenticate, authorize } = require('./middleware/auth')

app.get('/protected-test', authenticate, authorize(['driver']), (req, res) => {
  res.json({ message: 'You are in', user: req.user })
})
```

The middleware file stays — it'll be imported by real route files starting in the next spec (loads CRUD).

- [ ] **Verify server still starts cleanly**

```bash
node index.js
```

Expected: no errors, DB connected message

- [ ] **Commit and push**

```bash
git add backend/index.js
git commit -m "chore: remove auth middleware test route"
git push
```

---

## Verification Checklist

Before calling this done, confirm:

- [ ] `backend/middleware/auth.js` exports both `authenticate` and `authorize`
- [ ] No token → 401 `No token provided`
- [ ] Bad token → 401 `Invalid token`
- [ ] Valid token, wrong role → 403 `Forbidden`
- [ ] Valid token, correct role → 200 with `req.user` populated
- [ ] Test route removed from `index.js`
- [ ] All commits pushed
