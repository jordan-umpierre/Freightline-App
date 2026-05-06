# Auth Middleware Design

**Date:** 2026-05-05
**Scope:** JWT authentication + role-based authorization middleware for Freightline backend

---

## Problem

Auth routes (`/auth/register`, `/auth/login`) are working and return JWTs. But there is no way yet to protect routes — any request can hit any endpoint. Loads CRUD and other sensitive routes need to be gated by (a) a valid JWT and (b) the correct user role.

---

## Architecture

One new file: `backend/middleware/auth.js`

Exports two named functions: `authenticate` and `authorize`. They are intentionally separate so they can be composed:

- `authenticate` alone: route needs a logged-in user but doesn't care about role
- `authenticate` + `authorize([...roles])`: route needs a logged-in user with a specific role

Usage on a route:

```js
router.get('/loads', authenticate, authorize(['admin', 'carrier']), getLoads)
```

---

## Function: `authenticate`

Runs on every protected route, before any role check.

**Steps:**
1. Read the `Authorization` header. Expect the format `Bearer <token>`.
2. If the header is missing or malformed, respond `401 { error: 'No token provided' }` and stop.
3. Call `jwt.verify(token, process.env.JWT_SECRET)`.
4. If verification throws (invalid signature, expired, malformed), respond `401 { error: 'Invalid token' }` and stop.
5. Attach the decoded payload to `req.user` — it contains `user_id` and `role`.
6. Call `next()`.

**Note:** Catch all `jwt.verify` error types uniformly. Do not expose which specific check failed — that leaks information about the token structure.

---

## Function: `authorize(roles)`

Runs after `authenticate` on role-restricted routes only.

**Signature:** Takes an array of allowed role strings, returns a middleware function.

**Steps:**
1. Read `req.user.role` (set by `authenticate`).
2. If the role is not in the `roles` array, respond `403 { error: 'Forbidden' }` and stop.
3. Otherwise call `next()`.

**401 vs 403 distinction:**
- `401 Unauthorized` — the server doesn't know who you are (no token / bad token)
- `403 Forbidden` — the server knows who you are, but you don't have permission

---

## Error Handling

| Scenario | Response |
|---|---|
| No `Authorization` header | `401 { error: 'No token provided' }` |
| Token present but invalid or expired | `401 { error: 'Invalid token' }` |
| Valid token, role not in allowed list | `403 { error: 'Forbidden' }` |

---

## Testing Plan (manual, curl)

No automated tests in this slice — those come in Week 6. Verify manually:

1. Hit a protected route with no token → expect `401`
2. Hit a protected route with a garbage token → expect `401`
3. Hit a role-restricted route with a valid token but wrong role → expect `403`
4. Hit a role-restricted route with a valid token and correct role → expect `200`

To test role enforcement, register two users with different roles and compare behavior.

---

## File Changes

| File | Change |
|---|---|
| `backend/middleware/auth.js` | New file — exports `authenticate` and `authorize` |
| `backend/routes/auth.js` | No change — auth routes stay unprotected (register/login don't need a token) |

---

## Out of Scope

- Refresh tokens
- Token blacklisting / logout
- Rate limiting on auth endpoints
- Automated tests (Week 6)
