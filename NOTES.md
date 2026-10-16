# NOTES.md – Assumptions, Decisions & Future Improvements

## Assumptions

### 1. Late-join rule
Members may only be added **before the first contribution of week 1 is recorded**.  
Once any payment is made, the rotation order is locked.  
*Rationale:* Adding a member mid-rotation would break the payout schedule (their "slot" in the rotation would be undefined, and earlier recipients received a smaller pot than later ones would). The fairest and simplest policy is to refuse late joins.

### 2. Payout rotation scope
The rotation covers exactly one full cycle (each member receives the pot once).  
After all members have been paid, the week counter continues advancing but no further payouts are made — the group admin would need to reset the group for a new cycle.  
*Rationale:* The spec does not define multi-cycle behaviour; a clean stop is safer than silently wrapping around.

### 3. Partial payments
A member may pay in any number of instalments during an open week, as long as the running total does not exceed the weekly amount.  
Overpayments are rejected with a clear error message.

### 4. Minimum group size
Contributions cannot be recorded until the group has at least **2 members**.  
A single-member susu is meaningless (the member would pay themselves the pot).

### 5. Money precision
All monetary values are stored and computed as `decimal.js` `Decimal` objects — never native JavaScript `Number` (floating-point).  
This guarantees exact arithmetic (e.g. `3 × 33.33 = 99.99`, not `99.99000000000001`).

### 6. Persistence
Data is stored **in-memory** for the duration of the server process.  
Restarting the server, or pressing "Reset Group", clears all data.  
This is acceptable for a small-scale demonstration program.

### 7. Week numbering
Weeks are 1-based integers. The payout recipient for week _N_ is the member with `joinOrder === N` (cycling with modulo if the rotation repeats).

### 8. Currency
All amounts are in **GHS (Ghanaian Cedi)**. No currency conversion is performed.

### 9. Case sensitivity for member names
Member names are stored and matched exactly as entered (case-sensitive).  
`"Ama"` and `"ama"` would be treated as different members.  
*Decision:* This matches the spec's wording ("unique name or ID") and avoids silent surprises from normalisation.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Separate `SusuGroup.js` from `routes/index.js` | Keeps all business logic testable without HTTP machinery. Tests import `SusuGroup` directly. |
| `decimal.js` for money | Eliminates floating-point rounding bugs — critical for financial software. |
| Custom error hierarchy (`SusuError` → subclasses) | Routes can catch `SusuError` in one `catch` block and return a 400, while letting unexpected errors bubble up as 500s. |
| App factory pattern (`createApp()`) | Allows tests to import the app without binding a port, making `supertest` integration straightforward. |
| In-memory store with `/reset` route | Keeps the demo simple; a real app would swap the store for a database connection. |
| EJS over a client-side framework | Server-rendered HTML is simpler, requires no build step, and is easier to audit. |

---

## What I Would Improve With More Time

1. **Persistent storage** — Replace the in-memory store with a database (e.g. SQLite via `better-sqlite3`, or PostgreSQL via `pg`). This would survive server restarts.

2. **Multi-group support** — Allow the server to manage several susu groups simultaneously, each with its own URL and data.

3. **User authentication** — Add member-level login so only the right person can record their own contribution, and only a group admin can close weeks.

4. **Email / SMS notifications** — Notify members when a week opens, when someone pays, and when the week closes with a payout.

5. **Multi-cycle support** — After all members have been paid once, start a new cycle automatically rather than requiring a manual reset.

6. **Audit log** — Record every state-changing action with a timestamp and author, so the group has a transparent history.

7. **Integration tests** — Add `supertest` tests covering the HTTP layer (form submissions, error responses, JSON report endpoint) in addition to the existing unit tests.

8. **Input sanitisation** — Strip HTML/script tags from member names to prevent stored XSS if the app is exposed publicly.

9. **Containerisation** — Add a `Dockerfile` so the app can be deployed anywhere with a single command.

10. **Internationalisation** — Support multiple currencies and locale-specific number formatting.
