# Payment Reveal + Approval System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scratch-card turn reveal, required amount on payments, and a 2-approval system where pending payments expire in 10 days if not approved.

**Architecture:** Schema gains `amount/status/expires_at` on `payment_records`, a `current_random_payer_id` on `groups` (locks random-mode payer between GET and POST to prevent double-randomization), and a new `payment_approvals` table. A shared `lib/groupDetail.ts` helper is extracted so all five routes that return `GroupDetail` stay consistent. New approve/cancel API routes handle voting. Frontend adds reveal animation, payer-only Mark as Paid, and a `PendingApprovals` component.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Neon Postgres (`pnpm db:push` for schema), Vitest, shadcn/ui + Tailwind, next-auth v5.

---

## File Map

| Action | File |
|---|---|
| Modify | `lib/db/schema.ts` |
| Modify | `lib/types.ts` |
| **Create** | `lib/approvalRules.ts` |
| **Create** | `lib/approvalRules.test.ts` |
| **Create** | `lib/groupDetail.ts` |
| Modify | `app/api/groups/[id]/route.ts` |
| Modify | `app/api/groups/[id]/payments/route.ts` |
| **Create** | `app/api/groups/[id]/payments/[paymentId]/approve/route.ts` |
| **Create** | `app/api/groups/[id]/payments/[paymentId]/cancel/route.ts` |
| Modify | `app/api/groups/route.ts` |
| Modify | `components/CurrentTurn.tsx` |
| Modify | `components/MarkAsPaidButton.tsx` |
| Modify | `components/PaymentHistory.tsx` |
| **Create** | `components/PendingApprovals.tsx` |
| Modify | `app/group/[id]/page.tsx` |
| Modify | `app/dashboard/page.tsx` |

---

## Task 1: Schema — add columns + new table

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Update schema.ts**

Replace the entire `lib/db/schema.ts` with:

```ts
import {
  pgTable, text, boolean, timestamp, integer, primaryKey, unique, numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccountType } from '@auth/core/adapters';

// ── Auth.js required tables ────────────────────────────────────────────

export const users = pgTable('user', {
  id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('session_token').notNull().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_token',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ── App tables ─────────────────────────────────────────────────────────

export const groups = pgTable('group', {
  id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  emoji: text('emoji').notNull().default('☕'),
  code: text('code').unique().notNull(),
  isRandomMode: boolean('is_random_mode').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  currentRandomPayerId: text('current_random_payer_id').references(() => users.id, { onDelete: 'set null' }),
});

export const groupMembers = pgTable(
  'group_member',
  {
    id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { mode: 'date' }).defaultNow(),
  },
  (table) => ({
    uniqueGroupUser: unique().on(table.groupId, table.userId),
  }),
);

export const paymentRecords = pgTable('payment_record', {
  id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  memberName: text('member_name').notNull(),
  description: text('description'),
  paidAt: timestamp('paid_at', { mode: 'date' }).defaultNow().notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const paymentApprovals = pgTable(
  'payment_approval',
  {
    id: text('id').notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    paymentId: text('payment_id').notNull().references(() => paymentRecords.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  },
  (table) => ({
    uniquePaymentUser: unique().on(table.paymentId, table.userId),
  }),
);

// ── Relations ──────────────────────────────────────────────────────────

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  payments: many(paymentRecords),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one, many }) => ({
  group: one(groups, { fields: [paymentRecords.groupId], references: [groups.id] }),
  user: one(users, { fields: [paymentRecords.userId], references: [users.id] }),
  approvals: many(paymentApprovals),
}));

export const paymentApprovalsRelations = relations(paymentApprovals, ({ one }) => ({
  payment: one(paymentRecords, { fields: [paymentApprovals.paymentId], references: [paymentRecords.id] }),
  user: one(users, { fields: [paymentApprovals.userId], references: [users.id] }),
}));
```

- [ ] **Step 2: Push schema to database**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && pnpm db:push
```

Expected: Drizzle applies the new columns and table. Confirm with `y` if prompted.

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add amount/status/expires_at to payment_records, add payment_approvals table"
```

---

## Task 2: Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace lib/types.ts**

```ts
export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface Member {
  id: string;
  name: string;
  joinedAt: string;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  paidAt: string;
  description?: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'cancelled';
}

export interface PendingPayment {
  id: string;
  payerId: string;
  payerName: string;
  amount: number;
  description?: string | null;
  expiresAt: string;
  approvals: { userId: string }[];
  cancelVotes: { userId: string }[];
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  code: string;
  isRandomMode: boolean;
  createdAt: string;
  memberCount: number;
  paymentCount: number;
  pendingCount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  code: string;
  isRandomMode: boolean;
  createdAt: string;
  members: Member[];
  paymentHistory: PaymentRecord[];
  nextPayer: { id: string; name: string } | null;
  pendingPayments: PendingPayment[];
  isFrozen: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: update types — PendingPayment, isFrozen, pendingCount, amount on PaymentRecord"
```

---

## Task 3: Approval rules (pure logic + tests)

**Files:**
- Create: `lib/approvalRules.ts`
- Create: `lib/approvalRules.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/approvalRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getRequiredApprovals, getRequiredCancelVotes } from './approvalRules';

describe('getRequiredApprovals', () => {
  it('returns 0 for 1 member (auto-approve)', () => {
    expect(getRequiredApprovals(1)).toBe(0);
  });
  it('returns 1 for 2 members', () => {
    expect(getRequiredApprovals(2)).toBe(1);
  });
  it('returns 2 for 3 members', () => {
    expect(getRequiredApprovals(3)).toBe(2);
  });
  it('returns 2 for 10 members', () => {
    expect(getRequiredApprovals(10)).toBe(2);
  });
});

describe('getRequiredCancelVotes', () => {
  it('returns 1 for 2 members', () => {
    expect(getRequiredCancelVotes(2)).toBe(1);
  });
  it('returns 2 for 3 members', () => {
    expect(getRequiredCancelVotes(3)).toBe(2);
  });
  it('returns 9 for 10 members', () => {
    expect(getRequiredCancelVotes(10)).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && pnpm test
```

Expected: `Cannot find module './approvalRules'`

- [ ] **Step 3: Create lib/approvalRules.ts**

```ts
export function getRequiredApprovals(memberCount: number): number {
  if (memberCount <= 1) return 0;
  if (memberCount === 2) return 1;
  return 2;
}

export function getRequiredCancelVotes(memberCount: number): number {
  return memberCount - 1;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && pnpm test
```

Expected: all tests pass including existing fairTurn tests.

- [ ] **Step 5: Commit**

```bash
git add lib/approvalRules.ts lib/approvalRules.test.ts
git commit -m "feat: add approvalRules — getRequiredApprovals and getRequiredCancelVotes"
```

---

## Task 4: Shared buildGroupDetail helper

**Files:**
- Create: `lib/groupDetail.ts`

- [ ] **Step 1: Create lib/groupDetail.ts**

```ts
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, paymentApprovals, users } from '@/lib/db/schema';
import { eq, and, lt, desc, ne } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import type { Member, PaymentRecord, PendingPayment, GroupDetail } from '@/lib/types';

export async function buildGroupDetail(groupId: string): Promise<GroupDetail | null> {
  await db.delete(paymentRecords).where(
    and(
      eq(paymentRecords.groupId, groupId),
      eq(paymentRecords.status, 'pending'),
      lt(paymentRecords.expiresAt, new Date()),
    ),
  );

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

  const memberRows = await db
    .select({ id: users.id, name: users.name, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    joinedAt: m.joinedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const allPaymentRows = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.groupId, groupId))
    .orderBy(desc(paymentRecords.paidAt));

  const approvedHistory: PaymentRecord[] = allPaymentRows
    .filter((p) => p.status === 'approved')
    .map((p) => ({
      id: p.id,
      memberId: p.userId ?? '',
      memberName: p.memberName,
      paidAt: p.paidAt.toISOString(),
      description: p.description,
      amount: parseFloat(p.amount),
      status: 'approved' as const,
    }));

  const pendingRows = allPaymentRows.filter((p) => p.status === 'pending');
  const pendingPayments: PendingPayment[] = [];

  for (const p of pendingRows) {
    const votes = await db
      .select()
      .from(paymentApprovals)
      .where(eq(paymentApprovals.paymentId, p.id));

    pendingPayments.push({
      id: p.id,
      payerId: p.userId ?? '',
      payerName: p.memberName,
      amount: parseFloat(p.amount),
      description: p.description,
      expiresAt: p.expiresAt.toISOString(),
      approvals: votes.filter((v) => v.action === 'approve').map((v) => ({ userId: v.userId ?? '' })),
      cancelVotes: votes.filter((v) => v.action === 'cancel_vote').map((v) => ({ userId: v.userId ?? '' })),
    });
  }

  let nextPayer: { id: string; name: string } | null;

  if (group.isRandomMode) {
    if (group.currentRandomPayerId) {
      nextPayer = members.find((m) => m.id === group.currentRandomPayerId) ?? null;
    } else {
      nextPayer = getRandomPayer(members);
      if (nextPayer) {
        await db
          .update(groups)
          .set({ currentRandomPayerId: nextPayer.id })
          .where(eq(groups.id, groupId));
      }
    }
  } else {
    nextPayer = getNextFairPayer(members, approvedHistory);
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    emoji: group.emoji,
    code: group.code,
    isRandomMode: group.isRandomMode,
    createdAt: group.createdAt?.toISOString() ?? new Date().toISOString(),
    members,
    paymentHistory: approvedHistory,
    nextPayer,
    pendingPayments,
    isFrozen: pendingPayments.length >= 3,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/groupDetail.ts
git commit -m "feat: extract buildGroupDetail to shared lib — expiry cleanup, approved-only fairTurn, pendingPayments"
```

---

## Task 5: Update GET/PATCH/DELETE /api/groups/[id]

**Files:**
- Modify: `app/api/groups/[id]/route.ts`

- [ ] **Step 1: Replace app/api/groups/[id]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildGroupDetail } from '@/lib/groupDetail';

async function requireMembership(groupId: string, userId: string) {
  const [row] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return !!row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const isMember = await requireMembership(id, session.user.id);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const detail = await buildGroupDetail(id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const isMember = await requireMembership(id, session.user.id);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  if (typeof body.isRandomMode !== 'boolean') {
    return NextResponse.json({ error: 'isRandomMode must be boolean' }, { status: 400 });
  }

  await db.update(groups).set({ isRandomMode: body.isRandomMode }).where(eq(groups.id, id));

  const detail = await buildGroupDetail(id);
  return NextResponse.json(detail);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const isMember = await requireMembership(id, session.user.id);
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, session.user.id)));

  const [remaining] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, id))
    .limit(1);

  if (!remaining) {
    await db.delete(groups).where(eq(groups.id, id));
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[id]/route.ts
git commit -m "refactor: use buildGroupDetail in group GET/PATCH/DELETE routes"
```

---

## Task 6: Update POST /api/groups/[id]/payments

**Files:**
- Modify: `app/api/groups/[id]/payments/route.ts`

- [ ] **Step 1: Replace the payments POST route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, users } from '@/lib/db/schema';
import { eq, and, count, desc } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import { buildGroupDetail } from '@/lib/groupDetail';
import type { Member, PaymentRecord } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawAmount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount);
  if (!rawAmount || rawAmount <= 0 || isNaN(rawAmount)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;

  const memberRows = await db
    .select({ id: users.id, name: users.name, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    joinedAt: m.joinedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const approvedRows = await db
    .select()
    .from(paymentRecords)
    .where(and(eq(paymentRecords.groupId, groupId), eq(paymentRecords.status, 'approved')))
    .orderBy(desc(paymentRecords.paidAt));

  const approvedHistory: PaymentRecord[] = approvedRows.map((p) => ({
    id: p.id,
    memberId: p.userId ?? '',
    memberName: p.memberName,
    paidAt: p.paidAt.toISOString(),
    description: p.description,
    amount: parseFloat(p.amount),
    status: 'approved' as const,
  }));

  const payer = group.isRandomMode
    ? getRandomPayer(members)
    : getNextFairPayer(members, approvedHistory);

  if (!payer) return NextResponse.json({ error: 'No members in group' }, { status: 400 });

  if (payer.id !== userId) {
    return NextResponse.json({ error: "It's not your turn" }, { status: 403 });
  }

  const [{ total: pendingCount }] = await db
    .select({ total: count() })
    .from(paymentRecords)
    .where(and(eq(paymentRecords.groupId, groupId), eq(paymentRecords.status, 'pending')));

  if (pendingCount >= 3) {
    return NextResponse.json(
      { error: 'Group is frozen — approve or cancel pending payments first' },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  const [inserted] = await db
    .insert(paymentRecords)
    .values({
      groupId,
      userId: payer.id,
      memberName: payer.name,
      description,
      amount: rawAmount.toFixed(2),
      status: 'pending',
      expiresAt,
    })
    .returning({ id: paymentRecords.id });

  if (members.length === 1) {
    await db
      .update(paymentRecords)
      .set({ status: 'approved' })
      .where(eq(paymentRecords.id, inserted.id));
  }

  // Clear locked random payer so next GET picks a new one for the next turn
  if (group.isRandomMode) {
    await db.update(groups).set({ currentRandomPayerId: null }).where(eq(groups.id, groupId));
  }

  const detail = await buildGroupDetail(groupId);
  return NextResponse.json(detail, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[id]/payments/route.ts
git commit -m "feat: payments POST — require amount, verify caller is payer, freeze check, auto-approve solo"
```

---

## Task 7: New approve route

**Files:**
- Create: `app/api/groups/[id]/payments/[paymentId]/approve/route.ts`

- [ ] **Step 1: Create approve route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupMembers, paymentRecords, paymentApprovals } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { getRequiredApprovals } from '@/lib/approvalRules';
import { buildGroupDetail } from '@/lib/groupDetail';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId, paymentId } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [payment] = await db
    .select()
    .from(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.groupId, groupId)))
    .limit(1);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment is not pending' }, { status: 409 });
  }
  if (payment.userId === userId) {
    return NextResponse.json({ error: 'Cannot approve your own payment' }, { status: 403 });
  }

  try {
    await db.insert(paymentApprovals).values({ paymentId, userId, action: 'approve' });
  } catch {
    return NextResponse.json({ error: 'Already voted' }, { status: 409 });
  }

  const memberRows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const [{ total: approvalCount }] = await db
    .select({ total: count() })
    .from(paymentApprovals)
    .where(and(eq(paymentApprovals.paymentId, paymentId), eq(paymentApprovals.action, 'approve')));

  const required = getRequiredApprovals(memberRows.length);
  if (approvalCount >= required) {
    await db
      .update(paymentRecords)
      .set({ status: 'approved' })
      .where(eq(paymentRecords.id, paymentId));
  }

  const detail = await buildGroupDetail(groupId);
  return NextResponse.json(detail);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[id]/payments/[paymentId]/approve/route.ts
git commit -m "feat: add POST approve route — vote to approve pending payment"
```

---

## Task 8: New cancel route

**Files:**
- Create: `app/api/groups/[id]/payments/[paymentId]/cancel/route.ts`

- [ ] **Step 1: Create cancel route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupMembers, paymentRecords, paymentApprovals } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { getRequiredCancelVotes } from '@/lib/approvalRules';
import { buildGroupDetail } from '@/lib/groupDetail';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId, paymentId } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [payment] = await db
    .select()
    .from(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.groupId, groupId)))
    .limit(1);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment is not pending' }, { status: 409 });
  }

  if (payment.userId === userId) {
    await db
      .update(paymentRecords)
      .set({ status: 'cancelled' })
      .where(eq(paymentRecords.id, paymentId));
    const detail = await buildGroupDetail(groupId);
    return NextResponse.json(detail);
  }

  try {
    await db.insert(paymentApprovals).values({ paymentId, userId, action: 'cancel_vote' });
  } catch {
    return NextResponse.json({ error: 'Already voted' }, { status: 409 });
  }

  const memberRows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const [{ total: cancelVoteCount }] = await db
    .select({ total: count() })
    .from(paymentApprovals)
    .where(and(eq(paymentApprovals.paymentId, paymentId), eq(paymentApprovals.action, 'cancel_vote')));

  const required = getRequiredCancelVotes(memberRows.length);
  if (cancelVoteCount >= required) {
    await db
      .update(paymentRecords)
      .set({ status: 'cancelled' })
      .where(eq(paymentRecords.id, paymentId));
  }

  const detail = await buildGroupDetail(groupId);
  return NextResponse.json(detail);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/[id]/payments/[paymentId]/cancel/route.ts
git commit -m "feat: add POST cancel route — payer cancels immediately, others vote to cancel"
```

---

## Task 9: Update GET /api/groups — add pendingCount

**Files:**
- Modify: `app/api/groups/route.ts`

- [ ] **Step 1: Replace app/api/groups/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, paymentApprovals } from '@/lib/db/schema';
import { eq, inArray, count, and, ne } from 'drizzle-orm';
import { generateGroupCode } from '@/lib/codeGenerator';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const memberRows = await db
    .selectDistinct({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  if (memberRows.length === 0) return NextResponse.json([]);

  const ids = memberRows.map((r) => r.groupId);

  const [groupRows, memberCounts, paymentCounts] = await Promise.all([
    db.select().from(groups).where(inArray(groups.id, ids)),
    db
      .select({ groupId: groupMembers.groupId, total: count() })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, ids))
      .groupBy(groupMembers.groupId),
    db
      .select({ groupId: paymentRecords.groupId, total: count() })
      .from(paymentRecords)
      .where(and(inArray(paymentRecords.groupId, ids), eq(paymentRecords.status, 'approved')))
      .groupBy(paymentRecords.groupId),
  ]);

  const pendingForUser = await db
    .select({ groupId: paymentRecords.groupId, paymentId: paymentRecords.id })
    .from(paymentRecords)
    .where(
      and(
        inArray(paymentRecords.groupId, ids),
        eq(paymentRecords.status, 'pending'),
        ne(paymentRecords.userId, userId),
      ),
    );

  let votedSet = new Set<string>();
  if (pendingForUser.length > 0) {
    const votedRows = await db
      .select({ paymentId: paymentApprovals.paymentId })
      .from(paymentApprovals)
      .where(
        and(
          inArray(
            paymentApprovals.paymentId,
            pendingForUser.map((p) => p.paymentId),
          ),
          eq(paymentApprovals.userId, userId),
        ),
      );
    votedSet = new Set(votedRows.map((v) => v.paymentId));
  }

  const pendingCountMap: Record<string, number> = {};
  for (const { groupId, paymentId } of pendingForUser) {
    if (!votedSet.has(paymentId)) {
      pendingCountMap[groupId] = (pendingCountMap[groupId] ?? 0) + 1;
    }
  }

  const memberCountMap = Object.fromEntries(memberCounts.map((r) => [r.groupId, r.total]));
  const paymentCountMap = Object.fromEntries(paymentCounts.map((r) => [r.groupId, r.total]));

  const result = groupRows.map((g) => ({
    ...g,
    memberCount: memberCountMap[g.id] ?? 0,
    paymentCount: paymentCountMap[g.id] ?? 0,
    pendingCount: pendingCountMap[g.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const emoji = typeof body.emoji === 'string' ? body.emoji : '☕';

  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'Group name must be 1–100 characters' }, { status: 400 });
  }

  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateGroupCode();
    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.code, candidate))
      .limit(1);
    if (existing.length === 0) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });
  }

  const groupId = crypto.randomUUID();

  await db.insert(groups).values({ id: groupId, name, description, emoji, code, isRandomMode: false });
  await db.insert(groupMembers).values({ groupId, userId: session.user.id });

  const [newGroup] = await db.select().from(groups).where(eq(groups.id, groupId));

  return NextResponse.json(
    { ...newGroup, memberCount: 1, paymentCount: 0, pendingCount: 0 },
    { status: 201 },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/route.ts
git commit -m "feat: add pendingCount to dashboard groups — payments needing current user's approval"
```

---

## Task 10: CurrentTurn — scratch card reveal

**Files:**
- Modify: `components/CurrentTurn.tsx`

- [ ] **Step 1: Replace CurrentTurn.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { GroupDetail } from '@/lib/types';

interface CurrentTurnProps {
  group: GroupDetail;
  currentUserId: string;
}

export function CurrentTurn({ group, currentUserId }: CurrentTurnProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
    setShowCelebration(false);
  }, [group.nextPayer?.id]);

  const handleReveal = () => {
    setIsRevealed(true);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  };

  if (!group.nextPayer) {
    return (
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No members in group yet</p>
      </div>
    );
  }

  const isYourTurn = group.nextPayer.id === currentUserId;

  return (
    <div className="relative">
      {showCelebration && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white text-center">
        <p className="text-lg font-semibold mb-3 opacity-90">It&apos;s Time to Pay!</p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-6xl">{group.emoji}</span>
        </div>

        {isRevealed ? (
          <>
            <h2 className="text-5xl font-bold mb-2">
              {isYourTurn ? 'You!' : group.nextPayer.name}
            </h2>
            {isYourTurn && (
              <p className="text-lg opacity-80">({group.nextPayer.name})</p>
            )}
          </>
        ) : (
          <div className="cursor-pointer select-none" onClick={handleReveal}>
            <div
              className="text-5xl font-bold mb-2 transition-all duration-300"
              style={{ filter: 'blur(12px)' }}
            >
              {group.nextPayer.name}
            </div>
            <p className="text-sm opacity-80 mt-2">👆 Tap to reveal</p>
          </div>
        )}

        <p className="text-lg opacity-90 mt-3">
          {group.isRandomMode ? '🎲 Random Selection' : 'Fair Turn'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CurrentTurn.tsx
git commit -m "feat: CurrentTurn scratch-card reveal — blurred name, tap to reveal, your-turn highlight"
```

---

## Task 11: MarkAsPaidButton — amount + payer-only

**Files:**
- Modify: `components/MarkAsPaidButton.tsx`

- [ ] **Step 1: Replace MarkAsPaidButton.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MarkAsPaidButtonProps {
  group: GroupDetail;
  currentUserId: string;
  onPaymentMarked: (updatedGroup: GroupDetail) => void;
}

export function MarkAsPaidButton({ group, currentUserId, onPaymentMarked }: MarkAsPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const isYourTurn = group.nextPayer?.id === currentUserId;

  const handleConfirm = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    setLoading(true);

    const res = await fetch(`/api/groups/${group.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parsedAmount, description }),
    });

    if (res.ok) {
      const updated: GroupDetail = await res.json();
      onPaymentMarked(updated);
      setOpen(false);
      setAmount('');
      setDescription('');
    }

    setLoading(false);
  };

  if (!isYourTurn) {
    return (
      <div className="w-full text-center py-3 px-4 bg-gray-100 rounded-lg text-gray-600 text-sm">
        Waiting for <span className="font-semibold">{group.nextPayer?.name ?? '…'}</span> to record their payment
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={group.isFrozen}
        title={group.isFrozen ? 'Approve or cancel pending payments first' : undefined}
      >
        {group.isFrozen ? '⚠️ Approve pending payments first' : 'Mark as Paid'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="pay-description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="pay-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Tea round, Party drinks, Lunch order"
              />
            </div>
            <p className="text-sm text-gray-600">
              Recording payment for <span className="font-semibold">{group.nextPayer?.name}</span>
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={loading || !amount || parseFloat(amount) <= 0}
              >
                {loading ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/MarkAsPaidButton.tsx
git commit -m "feat: MarkAsPaidButton — require amount, payer-only access, frozen state"
```

---

## Task 12: New PendingApprovals component

**Files:**
- Create: `components/PendingApprovals.tsx`

- [ ] **Step 1: Create PendingApprovals.tsx**

```tsx
'use client';

import { useState } from 'react';
import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { getRequiredApprovals } from '@/lib/approvalRules';

interface PendingApprovalsProps {
  group: GroupDetail;
  currentUserId: string;
  onUpdate: (updatedGroup: GroupDetail) => void;
}

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function PendingApprovals({ group, currentUserId, onUpdate }: PendingApprovalsProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  if (group.pendingPayments.length === 0) return null;

  const required = getRequiredApprovals(group.members.length);

  const act = async (paymentId: string, action: 'approve' | 'cancel') => {
    const key = paymentId + action;
    setLoadingKey(key);
    const res = await fetch(`/api/groups/${group.id}/payments/${paymentId}/${action}`, {
      method: 'POST',
    });
    if (res.ok) {
      const updated: GroupDetail = await res.json();
      onUpdate(updated);
    }
    setLoadingKey(null);
  };

  return (
    <div className="space-y-3">
      {group.isFrozen && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-800 text-sm font-medium">
          ⚠️ 3 pending payments — approve or cancel before new payments can be recorded.
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">Pending Approvals</h3>

      {group.pendingPayments.map((payment) => {
        const isPayer = payment.payerId === currentUserId;
        const hasApproved = payment.approvals.some((a) => a.userId === currentUserId);
        const hasCancelVoted = payment.cancelVotes.some((v) => v.userId === currentUserId);
        const days = daysLeft(payment.expiresAt);

        return (
          <div key={payment.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{payment.payerName}</p>
                <p className="text-xl font-bold text-green-700">₹{payment.amount.toFixed(2)}</p>
                {payment.description && (
                  <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
                )}
              </div>
              <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
                <p>{payment.approvals.length}/{required} approvals</p>
                <p className={days <= 2 ? 'text-red-600 font-semibold' : ''}>{days}d left</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isPayer || hasApproved || loadingKey === payment.id + 'approve'}
                onClick={() => act(payment.id, 'approve')}
              >
                {hasApproved ? '✓ Approved' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={(hasCancelVoted && !isPayer) || loadingKey === payment.id + 'cancel'}
                onClick={() => act(payment.id, 'cancel')}
              >
                {isPayer
                  ? 'Cancel Request'
                  : hasCancelVoted
                  ? '✓ Voted to Cancel'
                  : 'Vote to Cancel'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PendingApprovals.tsx
git commit -m "feat: add PendingApprovals component — approve/cancel voting UI with freeze banner"
```

---

## Task 13: Update PaymentHistory — add Amount column

**Files:**
- Modify: `components/PaymentHistory.tsx`

- [ ] **Step 1: Replace PaymentHistory.tsx**

```tsx
'use client';

import type { PaymentRecord } from '@/lib/types';

interface PaymentHistoryProps {
  history: PaymentRecord[];
}

export function PaymentHistory({ history }: PaymentHistoryProps) {
  const sorted = [...history].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>

      {history.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No payments recorded yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Who</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-semibold text-gray-900">{record.memberName}</td>
                  <td className="py-3 px-3 text-green-700 font-medium">₹{record.amount.toFixed(2)}</td>
                  <td className="py-3 px-3 text-gray-600">
                    {new Date(record.paidAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{record.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PaymentHistory.tsx
git commit -m "feat: PaymentHistory — add Amount column"
```

---

## Task 14: Wire up group page

**Files:**
- Modify: `app/group/[id]/page.tsx`

- [ ] **Step 1: Replace app/group/[id]/page.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { GroupDetail } from '@/lib/types';
import { CurrentTurn } from '@/components/CurrentTurn';
import { GroupInfo } from '@/components/GroupInfo';
import { MembersList } from '@/components/MembersList';
import { PaymentHistory } from '@/components/PaymentHistory';
import { MarkAsPaidButton } from '@/components/MarkAsPaidButton';
import { RandomModeToggle } from '@/components/RandomModeToggle';
import { PendingApprovals } from '@/components/PendingApprovals';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUserId = session?.user?.id ?? '';

  useEffect(() => {
    fetch(`/api/groups/${id}`)
      .then((r) => {
        if (!r.ok) { router.push('/dashboard'); return null; }
        return r.json();
      })
      .then((data) => data && setGroup(data))
      .catch(() => router.push('/dashboard'));
  }, [id, router]);

  const handleToggleRandomMode = async () => {
    if (!group) return;
    const res = await fetch(`/api/groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRandomMode: !group.isRandomMode }),
    });
    if (res.ok) setGroup(await res.json());
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!group) return;
    await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    router.push('/dashboard');
  };

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Groups
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <CurrentTurn group={group} currentUserId={currentUserId} />
            <PendingApprovals group={group} currentUserId={currentUserId} onUpdate={setGroup} />
            <MarkAsPaidButton group={group} currentUserId={currentUserId} onPaymentMarked={setGroup} />
            <RandomModeToggle group={group} onToggle={handleToggleRandomMode} />
            <PaymentHistory history={group.paymentHistory} />
          </div>

          <div className="space-y-6">
            <GroupInfo group={group} onCopyCode={handleCopyCode} />
            {copied && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                Code copied to clipboard!
              </div>
            )}
            <MembersList members={group.members} paymentHistory={group.paymentHistory} />
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLeave}
            >
              Leave Group
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/group/[id]/page.tsx
git commit -m "feat: group page — wire up currentUserId, PendingApprovals, updated component props"
```

---

## Task 15: Dashboard — red dot badge

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Replace the group card rendering block in dashboard/page.tsx**

Find the `{groups.map((group) => (` block and replace with:

```tsx
{groups.map((group) => (
  <Link key={group.id} href={`/group/${group.id}`}>
    <div className="relative bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 cursor-pointer h-full">
      {group.pendingCount > 0 && (
        <div
          className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
          title={`${group.pendingCount} payment${group.pendingCount !== 1 ? 's' : ''} need your approval`}
        >
          {group.pendingCount}
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{group.emoji}</span>
        <h3 className="text-xl font-bold text-gray-900 flex-1">{group.name}</h3>
      </div>
      {group.description && (
        <p className="text-gray-600 text-sm mb-4">{group.description}</p>
      )}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</span>
        <span>{group.paymentCount} payment{group.paymentCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  </Link>
))}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: dashboard — red dot badge on groups needing approval"
```

---

## Task 16: Run full test suite + TypeScript check

- [ ] **Step 1: Run tests**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && pnpm test
```

Expected: all tests pass (fairTurn, codeGenerator, approvalRules).

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && npx tsc --noEmit
```

Expected: no errors. Fix any type mismatches before continuing.

- [ ] **Step 3: Start dev server and smoke test**

```bash
cd /Users/sachin/Documents/SachinP/Turnly && pnpm dev
```

Open `http://localhost:3000` and verify:
- Dashboard loads, group cards show (red dot absent when no pending payments)
- Group page loads, "Tap to reveal" is shown, clicking reveals name
- If logged-in user is the payer, "Mark as Paid" button is visible; otherwise the waiting message shows
- Mark as Paid dialog has an Amount field; submitting without amount is disabled
- After submitting, a pending payment card appears in PendingApprovals
- Approve and Cancel buttons behave correctly per role

---
