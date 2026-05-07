# Turnly — Payment Reveal + Approval System Design

**Date:** 2026-05-07
**Status:** Approved

---

## Overview

Three features added to the core payment flow:

1. **Scratch card reveal** — the next payer's name is hidden until the user taps to reveal it, making the experience fun and surprising.
2. **Amount field** — every payment record requires an amount (entered each time, not fixed).
3. **Approval system** — a submitted payment starts as `pending` and requires approval from other group members before it is counted. Payments that don't get approved within 10 days are auto-deleted.

---

## Database Schema Changes

### `payment_records` — 3 new columns

```sql
amount      numeric(10,2)  NOT NULL
status      text           NOT NULL DEFAULT 'pending'
              -- values: 'pending' | 'approved' | 'cancelled'
expires_at  timestamp      NOT NULL
              -- set to created_at + INTERVAL '10 days' on insert
```

**Rule:** Only the payer themselves can submit "Mark as Paid" for their own turn. The payer (`user_id`) and the submitter are always the same person. Cancel rights therefore belong to the payer.

### New table: `payment_approvals`

```sql
payment_approvals
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid()
  payment_id   uuid      NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE
  user_id      uuid      NOT NULL REFERENCES users(id) ON DELETE CASCADE
  action       text      NOT NULL  -- 'approve' | 'cancel_vote'
  created_at   timestamp DEFAULT now()
  UNIQUE(payment_id, user_id)     -- one vote per user per payment
```

### Drizzle migration

Add `amount`, `status`, `expiresAt` to `paymentRecords` table definition. Create `paymentApprovals` table. Run `drizzle-kit generate` + `drizzle-kit migrate`.

> Note: `submitted_by_user_id` is not needed — only the payer can submit their own payment.

---

## Approval Threshold Rules

| Group size | Required approvals to confirm | Required cancel votes |
|---|---|---|
| 1 member | Auto-approved on insert | N/A |
| 2 members | 1 (the non-payer) | 1 (the non-payer) |
| 3+ members | 2 (any non-payers) | all other members (total − 1) |

The payer themselves **cannot** approve or cancel-vote their own payment.

---

## Freeze Rule

If a group has **3 or more** payments with `status = 'pending'` simultaneously, no new payment can be submitted. The "Mark as Paid" button is disabled and the group page shows a warning banner.

---

## Expiry / Cleanup

On every `GET /api/groups/[id]` request, before building the response, delete all `payment_records` rows where `status = 'pending'` AND `expires_at < now()`. Cascade delete removes the associated `payment_approvals` rows automatically.

---

## API Changes

### Modified: `POST /api/groups/[id]/payments`

**Body:** `{ amount: number, description?: string }`

**Validation:**
- `amount` required, must be > 0
- Caller must be the **computed next payer** — server verifies `session.user.id === getNextFairPayer/getRandomPayer result`. If not, return 403 "It's not your turn".
- Count of pending payments for this group must be < 3 (else 400 with freeze message)

**Logic:**
1. Compute payer via `getNextFairPayer` (fair) or `getRandomPayer` (random) against current DB state — **payer is locked at submit time** (fixes the random-mode double-randomization bug).
2. Verify caller IS that computed payer (403 if not).
3. Insert `payment_records` row with `status = 'pending'`, `expires_at = now() + 10 days`.
4. If group has exactly 1 member → immediately set `status = 'approved'` (auto-approve).
5. Return updated group detail including new pending payment.

### New: `POST /api/groups/[id]/payments/[paymentId]/approve`

**Auth:** Caller must be a group member and must NOT be the payer of this payment.

**Logic:**
1. Check caller has not already voted on this payment (UNIQUE constraint catches DB-level, return 409 if duplicate).
2. Insert `{ action: 'approve' }` row into `payment_approvals`.
3. Count total `approve` actions for this payment.
4. If count ≥ threshold (1 for 2-member group, 2 for 3+ member group) → set `payment_records.status = 'approved'`.
5. Return updated group detail.

### New: `POST /api/groups/[id]/payments/[paymentId]/cancel`

**Auth:** Caller must be a group member.

**Logic:**
- If caller is the **payer** (`payment.userId === session.user.id`) → immediately set `status = 'cancelled'`. Return updated group detail.
- Otherwise → insert `{ action: 'cancel_vote' }`. Count total `cancel_vote` actions. If count ≥ (total members − 1) → set `status = 'cancelled'`. Return updated group detail.

### Modified: `GET /api/groups/[id]`

1. Run expiry cleanup (delete pending records past `expires_at`) before building response.
2. Return `nextPayer` computed from **approved-only** payment history.
3. Add `pendingPayments: PendingPayment[]` to response — each item includes:
   - `id`, `payerName`, `payerId`, `amount`, `description`, `expiresAt`
   - `approvals: { userId: string }[]` — list of users who have approved
   - `cancelVotes: { userId: string }[]` — list of users who have cancel-voted
4. Add `isFrozen: boolean` — true when pending count ≥ 3.

### Modified: `GET /api/groups` (dashboard)

Each group summary includes `pendingCount: number` — count of pending payments in the group where the current user is NOT the payer (`user_id`) AND has NOT yet cast any vote in `payment_approvals`. This represents payments that genuinely need the current user's attention. Drives the red dot.

---

## Types

```ts
interface PendingPayment {
  id: string;
  payerId: string;       // also the submitter — always the same person
  payerName: string;
  amount: number;
  description?: string | null;
  expiresAt: string;          // ISO string
  approvals: { userId: string }[];
  cancelVotes: { userId: string }[];
}

interface GroupDetail {
  // existing fields...
  pendingPayments: PendingPayment[];
  isFrozen: boolean;
}

interface GroupSummary {
  // existing fields...
  pendingCount: number;
}

interface PaymentRecord {
  // existing fields...
  amount: number;
  status: 'pending' | 'approved' | 'cancelled';
}
```

---

## fairTurn.ts Fix

`getNextFairPayer` must receive only **approved** payment history. In `buildGroupDetail` (and in the payments POST route), filter `paymentHistory` to `status === 'approved'` before passing to `getNextFairPayer` / `getRandomPayer`.

---

## Frontend Changes

### `CurrentTurn` — Scratch card reveal

- On load, the payer's name is replaced with a blurred/redacted block (CSS `filter: blur(8px)` on the name).
- A "👆 Tap to reveal" label is shown below the blurred block.
- On click: CSS transition removes the blur and shows the name. A 🎉 celebration animation fires.
- Reveal state (`isRevealed`) is local component state, defaulting to `false`.
- When `group.nextPayer?.id` changes (new turn after a payment is approved), `isRevealed` resets to `false`.
- Once revealed, stays revealed for the rest of the session on that turn.

### `MarkAsPaidButton` — Amount field + payer-only access

- Button is **only enabled** when the logged-in user is the current `group.nextPayer` (compare `session.user.id === group.nextPayer?.id`). For all other members it is hidden or shows "Waiting for [Name] to record their payment".
- Dialog adds a required **Amount** numeric input above the description field.
- Submit disabled if amount is empty or ≤ 0.
- If `group.isFrozen` → button is disabled with tooltip "Approve or cancel pending payments first".
- Confirmation dialog shows: payer name, amount, description (optional).
- POST body includes `amount`.

### New `PendingApprovals` component

Shown on the group detail page between `CurrentTurn` and `MarkAsPaidButton` when `group.pendingPayments.length > 0`.

**Freeze banner** (shown when `group.isFrozen`):
```
⚠️ 3 pending payments — approve or cancel before new payments can be recorded.
```

**Per-payment card shows:**
- Payer name + amount + description
- Time remaining: "X days left" (derived from `expiresAt`)
- Approval progress: e.g. "1/2 approvals"
- **Approve button** — disabled if:
  - Current user is the payer (`session.user.id === payment.payerId`)
  - Current user has already approved (`payment.approvals.some(a => a.userId === session.user.id)`)
- **Cancel button**:
  - If current user is the **payer** (`payment.payerId === session.user.id`) → label "Cancel Request" (immediate cancellation)
  - Otherwise → label "Vote to Cancel"
  - Disabled if current user has already cast a cancel vote

### Dashboard group cards — Red dot

- Show a red dot badge on the group card when `group.pendingCount > 0`.
- Badge shows the count (e.g. `2`).
- Tooltip: "2 payments need your approval".

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| 1 member group | Auto-approved on insert, no approval UI |
| 2 member group | 1 approval required; cancel needs 1 cancel vote |
| 3+ member group | 2 approvals required; cancel needs all-others vote |
| 3 simultaneous pending | Group frozen, Mark as Paid disabled |
| Payment expires (10 days) | Deleted on next GET, turn unblocked |
| Payer cancels own request | Immediate cancellation, no vote needed |
| All others vote cancel | Cancellation triggered when cancel_votes = members − 1 |
| Payer tries to approve own | Blocked server-side (403) + button disabled client-side |
| User approves twice | Blocked by UNIQUE constraint (409) + button disabled after first vote |
| Non-payer tries to submit payment | Blocked server-side (403 "It's not your turn") + button hidden client-side |
| Random mode payer mismatch | Fixed — payer computed and locked on POST, not re-randomized on reveal |
| fairTurn counts pending | Fixed — only approved payments passed to fairTurn |
| Solo cancellation vote | N/A — auto-approved, cancellation not applicable |

---

## Out of Scope

- Push / email notifications for pending approvals (in-app red dot only)
- Partial approvals shown as progress bar (text "1/2 approvals" is sufficient)
- Admin overrides
- Editing a pending payment's amount after submission
