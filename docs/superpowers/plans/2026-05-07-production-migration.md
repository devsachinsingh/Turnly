# Turnly Production Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Turnly from localStorage to Neon Postgres + Auth.js v5 magic-link auth so groups sync across devices and the "join by code" flow actually works.

**Architecture:** Next.js Route Handlers serve a REST API backed by Drizzle ORM on Neon Postgres. Auth.js v5 handles magic-link email auth via Resend. All pages fetch from API routes; localStorage and `lib/storage.ts` are removed entirely. The fair-turn and random-turn algorithms remain as pure functions, now called server-side.

**Tech Stack:** `next-auth@beta`, `@auth/drizzle-adapter`, `drizzle-orm`, `@neondatabase/serverless`, `resend`, `drizzle-kit` (dev), `vitest` (dev)

---

## File Map

### New files
| File | Purpose |
|---|---|
| `lib/db/schema.ts` | Drizzle table definitions + relations |
| `lib/db/index.ts` | Neon + Drizzle client (singleton) |
| `lib/auth.ts` | Auth.js v5 config (Resend provider + Drizzle adapter) |
| `drizzle.config.ts` | drizzle-kit config |
| `middleware.ts` | Route protection (redirect unauthenticated users) |
| `types/next-auth.d.ts` | Augment session to include `user.id` |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js route handler |
| `app/api/user/route.ts` | PATCH display name (onboarding) |
| `app/api/groups/route.ts` | GET list, POST create |
| `app/api/groups/join/route.ts` | POST join by code |
| `app/api/groups/[id]/route.ts` | GET detail, PATCH mode, DELETE leave |
| `app/api/groups/[id]/payments/route.ts` | POST mark as paid |
| `app/onboarding/page.tsx` | First-time display name setup |
| `vitest.config.ts` | Vitest config for pure-function tests |
| `lib/fairTurn.test.ts` | Tests for fair-turn algorithm |
| `lib/codeGenerator.test.ts` | Tests for code generator |

### Modified files
| File | Change |
|---|---|
| `package.json` | Add new deps + test script |
| `next.config.mjs` | Remove `ignoreBuildErrors`, remove `images.unoptimized` |
| `app/layout.tsx` | Apply Geist font class to `<body>`, remove `generator` metadata |
| `app/page.tsx` | Email input + magic link flow |
| `app/dashboard/page.tsx` | Fetch `/api/groups`, shadcn `<Dialog>` modals |
| `app/group/[id]/page.tsx` | Fetch `/api/groups/[id]`, all mutations via API |
| `components/UserSetup.tsx` | Replace name form with email magic link form |
| `components/CurrentTurn.tsx` | Accept `nextPayer` prop instead of computing it |
| `components/MarkAsPaidButton.tsx` | Remove `require()`, call `POST /api/groups/[id]/payments` |
| `components/GroupJoiner.tsx` | Call `POST /api/groups/join` instead of localStorage |
| `components/MembersList.tsx` | `joinedDate` → `joinedAt` |
| `components/PaymentHistory.tsx` | `date` → `paidAt`, `index` key → `id` key |
| `lib/types.ts` | Update all types to match API response shapes |
| `lib/fairTurn.ts` | `payment.date` → `payment.paidAt` |

### Deleted files
- `lib/storage.ts`
- `BUILD_SUMMARY.md`, `COMPLETION_REPORT.md`, `DEPLOY.md`, `GUIDE.md`, `IMPLEMENTATION.md`, `PROJECT_COMPLETE.txt`, `QUICKSTART.md`, `START_HERE.md`, `TESTING.md`

---

## Task 1: Install packages + vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime packages**

```bash
pnpm add next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless resend
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Install dev packages**

```bash
pnpm add -D drizzle-kit vitest
```

- [ ] **Step 3: Add test script to package.json**

Open `package.json` and update the `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 5: Verify vitest runs**

```bash
pnpm test
```

Expected output: `No test files found` (no tests yet — that is correct).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add backend deps and vitest"
```

---

## Task 2: Update lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
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
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "refactor: update types to match database schema"
```

---

## Task 3: Write failing tests for pure functions

**Files:**
- Create: `lib/fairTurn.test.ts`
- Create: `lib/codeGenerator.test.ts`

- [ ] **Step 1: Create lib/fairTurn.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { getNextFairPayer } from './fairTurn';
import type { Member, PaymentRecord } from './types';

const alice: Member = { id: 'u1', name: 'Alice', joinedAt: '2024-01-01T00:00:00.000Z' };
const bob: Member = { id: 'u2', name: 'Bob', joinedAt: '2024-01-01T00:00:00.000Z' };
const carol: Member = { id: 'u3', name: 'Carol', joinedAt: '2024-01-01T00:00:00.000Z' };

function payment(memberId: string, paidAt: string): PaymentRecord {
  return { id: `p-${memberId}-${paidAt}`, memberId, memberName: memberId, paidAt, description: null };
}

describe('getNextFairPayer', () => {
  it('returns null for empty member list', () => {
    expect(getNextFairPayer([], [])).toBeNull();
  });

  it('returns the only member when no payments exist', () => {
    expect(getNextFairPayer([alice], [])).toEqual(alice);
  });

  it('returns member with fewest payments', () => {
    const history = [
      payment('u1', '2024-01-02T00:00:00.000Z'),
      payment('u1', '2024-01-03T00:00:00.000Z'),
      payment('u2', '2024-01-04T00:00:00.000Z'),
    ];
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('on a tie picks the member who paid least recently', () => {
    const history = [
      payment('u1', '2024-01-10T00:00:00.000Z'),
      payment('u2', '2024-01-05T00:00:00.000Z'),
    ];
    // Both paid once; Bob paid earlier so Bob is next
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('prefers a member who has never paid over one with a payment', () => {
    const history = [payment('u1', '2024-01-01T00:00:00.000Z')];
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('handles three members rotating fairly', () => {
    const history = [
      payment('u1', '2024-01-01T00:00:00.000Z'),
      payment('u2', '2024-01-02T00:00:00.000Z'),
      payment('u3', '2024-01-03T00:00:00.000Z'),
    ];
    // All paid once; Alice paid least recently → Alice is next
    expect(getNextFairPayer([alice, bob, carol], history)).toEqual(alice);
  });
});
```

- [ ] **Step 2: Create lib/codeGenerator.test.ts**

```typescript
import { describe, it, expect } from 'vitest';
import { generateGroupCode, validateGroupCode } from './codeGenerator';

describe('generateGroupCode', () => {
  it('returns a 6-character string', () => {
    expect(generateGroupCode()).toHaveLength(6);
  });

  it('returns only uppercase alphanumeric characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateGroupCode()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it('generates unique codes across many calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateGroupCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe('validateGroupCode', () => {
  it('accepts valid 6-char alphanumeric codes', () => {
    expect(validateGroupCode('ABC123')).toBe(true);
    expect(validateGroupCode('ZZZZZZ')).toBe(true);
    expect(validateGroupCode('000000')).toBe(true);
  });

  it('accepts lowercase input (normalised internally)', () => {
    expect(validateGroupCode('abc123')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(validateGroupCode('ABC12')).toBe(false);
    expect(validateGroupCode('ABC1234')).toBe(false);
    expect(validateGroupCode('')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(validateGroupCode('ABC!23')).toBe(false);
    expect(validateGroupCode('AB C12')).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — expect failures**

```bash
pnpm test
```

Expected: `getNextFairPayer` tests fail because `fairTurn.ts` still uses `payment.date` (not yet updated). `codeGenerator` tests should pass already.

- [ ] **Step 4: Commit test files**

```bash
git add lib/fairTurn.test.ts lib/codeGenerator.test.ts
git commit -m "test: add failing tests for fairTurn and codeGenerator"
```

---

## Task 4: Update lib/fairTurn.ts (make tests pass)

**Files:**
- Modify: `lib/fairTurn.ts`

- [ ] **Step 1: Replace lib/fairTurn.ts**

```typescript
import { Member, PaymentRecord } from './types';

export function getNextFairPayer(
  members: Member[],
  paymentHistory: PaymentRecord[]
): Member | null {
  if (members.length === 0) return null;

  const paymentCounts: Record<string, number> = {};
  members.forEach((member) => {
    paymentCounts[member.id] = 0;
  });

  paymentHistory.forEach((payment) => {
    if (Object.prototype.hasOwnProperty.call(paymentCounts, payment.memberId)) {
      paymentCounts[payment.memberId]++;
    }
  });

  const minCount = Math.min(...Object.values(paymentCounts));
  const candidates = members.filter((m) => paymentCounts[m.id] === minCount);

  if (candidates.length === 1) return candidates[0];

  let leastRecentPayer = candidates[0];
  let leastRecentDate = new Date('2099-12-31');

  for (const candidate of candidates) {
    const lastPayment = paymentHistory
      .filter((p) => p.memberId === candidate.id)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];

    if (lastPayment) {
      const lastDate = new Date(lastPayment.paidAt);
      if (lastDate < leastRecentDate) {
        leastRecentDate = lastDate;
        leastRecentPayer = candidate;
      }
    } else {
      return candidate;
    }
  }

  return leastRecentPayer;
}
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
pnpm test
```

Expected: All tests in `lib/fairTurn.test.ts` and `lib/codeGenerator.test.ts` pass.

- [ ] **Step 3: Commit**

```bash
git add lib/fairTurn.ts
git commit -m "fix: update fairTurn to use paidAt field name"
```

---

## Task 5: Drizzle schema

**Files:**
- Create: `lib/db/schema.ts`

- [ ] **Step 1: Create lib/db/schema.ts**

```typescript
import {
  pgTable, text, boolean, timestamp, integer, primaryKey, unique,
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
});

// ── Relations ──────────────────────────────────────────────────────────

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  payments: many(paymentRecords),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  group: one(groups, { fields: [paymentRecords.groupId], references: [groups.id] }),
  user: one(users, { fields: [paymentRecords.userId], references: [users.id] }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add Drizzle schema for all tables"
```

---

## Task 6: Drizzle client + drizzle-kit config

**Files:**
- Create: `lib/db/index.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Create lib/db/index.ts**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 2: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/index.ts drizzle.config.ts
git commit -m "feat: add Drizzle client and drizzle-kit config"
```

---

## Task 7: Neon setup + push schema to database

**Files:**
- Create: `.env.local` (not committed)

- [ ] **Step 1: Create Neon database**

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up / log in (free account)
3. Click **New Project** → name it `turnly` → Create
4. Copy the **connection string** — it looks like: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

- [ ] **Step 2: Create .env.local**

```bash
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://REPLACE_ME

AUTH_SECRET=REPLACE_ME_run_openssl_rand_-base64_32
AUTH_URL=http://localhost:3000

AUTH_RESEND_KEY=re_REPLACE_ME
EMAIL_FROM=noreply@yourdomain.com
EOF
```

Replace `DATABASE_URL` with the Neon connection string from Step 1.

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

Paste the output as `AUTH_SECRET`.

- [ ] **Step 3: Verify .env.local is gitignored**

```bash
grep '.env' .gitignore
```

Expected: `.env*.local` or `.env.local` appears. If missing, add it:
```bash
echo '.env*.local' >> .gitignore
```

- [ ] **Step 4: Push schema to Neon**

```bash
pnpm db:push
```

Expected output: Drizzle prints each table being created. Should end with `All changes applied`.

- [ ] **Step 5: Verify tables in Neon console**

Open [console.neon.tech](https://console.neon.tech) → your project → Tables. Confirm these tables exist: `user`, `account`, `session`, `verification_token`, `group`, `group_member`, `payment_record`.

- [ ] **Step 6: Commit .gitignore update if changed**

```bash
git add .gitignore
git diff --staged --quiet || git commit -m "chore: ensure .env.local is gitignored"
```

---

## Task 8: Auth.js config

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Create types/next-auth.d.ts**

```typescript
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
```

- [ ] **Step 2: Create lib/auth.ts**

```typescript
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Resend from 'next-auth/providers/resend';
import { db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/',
    newUser: '/onboarding',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts
git commit -m "feat: add Auth.js v5 config with Resend magic link"
```

---

## Task 9: Auth.js route handler + middleware

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create app/api/auth/[...nextauth]/route.ts**

```typescript
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 2: Create middleware.ts** (project root, next to `package.json`)

```typescript
import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  const protectedPaths = ['/dashboard', '/group', '/onboarding'];
  const isProtected = protectedPaths.some((p) => nextUrl.pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/group/:path*', '/onboarding'],
};
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth middleware.ts
git commit -m "feat: add Auth.js route handler and middleware"
```

---

## Task 10: Resend setup + smoke test auth

**Files:** (no code changes — setup only)

- [ ] **Step 1: Get Resend API key**

1. Go to [resend.com](https://resend.com) → Sign up free
2. Dashboard → API Keys → Create API Key → copy it
3. Paste into `.env.local` as `AUTH_RESEND_KEY=re_...`

- [ ] **Step 2: Set EMAIL_FROM**

For local dev, Resend allows sending from `onboarding@resend.dev` on the free plan without domain verification. Set:

```
EMAIL_FROM=Turnly <onboarding@resend.dev>
```

- [ ] **Step 3: Start dev server and test magic link**

```bash
pnpm dev
```

Open `http://localhost:3000`, enter your email, click "Send magic link". Check your inbox for the email. Click the link — you should land on `/onboarding` (page doesn't exist yet, 404 is expected — the redirect is what we're verifying).

- [ ] **Step 4: Verify user was created in Neon**

In Neon console → Tables → `user` — confirm your email appears.

---

## Task 11: User API route (name update)

**Files:**
- Create: `app/api/user/route.ts`

- [ ] **Step 1: Create app/api/user/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name || name.length > 50) {
    return NextResponse.json({ error: 'Name must be 1–50 characters' }, { status: 400 });
  }

  await db.update(users).set({ name }).where(eq(users.id, session.user.id));

  return NextResponse.json({ name });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/user/route.ts
git commit -m "feat: add PATCH /api/user for display name update"
```

---

## Task 12: Groups API — list and create

**Files:**
- Create: `app/api/groups/route.ts`

- [ ] **Step 1: Create app/api/groups/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords } from '@/lib/db/schema';
import { eq, inArray, count } from 'drizzle-orm';
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
      .where(inArray(paymentRecords.groupId, ids))
      .groupBy(paymentRecords.groupId),
  ]);

  const memberCountMap = Object.fromEntries(memberCounts.map((r) => [r.groupId, r.total]));
  const paymentCountMap = Object.fromEntries(paymentCounts.map((r) => [r.groupId, r.total]));

  const result = groupRows.map((g) => ({
    ...g,
    memberCount: memberCountMap[g.id] ?? 0,
    paymentCount: paymentCountMap[g.id] ?? 0,
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

  // Generate a unique group code (retry up to 5 times on collision)
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

  return NextResponse.json({ ...newGroup, memberCount: 1, paymentCount: 0 }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/route.ts
git commit -m "feat: add GET /api/groups and POST /api/groups"
```

---

## Task 13: Groups API — join by code

**Files:**
- Create: `app/api/groups/join/route.ts`

- [ ] **Step 1: Create app/api/groups/join/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateGroupCode } from '@/lib/codeGenerator';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const code = typeof body.code === 'string' ? body.code.toUpperCase().trim() : '';

  if (!validateGroupCode(code)) {
    return NextResponse.json({ error: 'Invalid group code' }, { status: 400 });
  }

  const [group] = await db.select().from(groups).where(eq(groups.code, code)).limit(1);
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, session.user.id)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: 'Already a member' }, { status: 409 });
  }

  await db.insert(groupMembers).values({ groupId: group.id, userId: session.user.id });

  return NextResponse.json(group, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/groups/join/route.ts
git commit -m "feat: add POST /api/groups/join"
```

---

## Task 14: Groups API — detail, mode toggle, leave

**Files:**
- Create: `app/api/groups/[id]/route.ts`

- [ ] **Step 1: Create app/api/groups/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, users } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import type { Member, PaymentRecord } from '@/lib/types';

async function requireMembership(groupId: string, userId: string) {
  const [row] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return !!row;
}

async function buildGroupDetail(groupId: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

  const memberRows = await db
    .select({ id: users.id, name: users.name, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const paymentRows = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.groupId, groupId))
    .orderBy(desc(paymentRecords.paidAt));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    joinedAt: m.joinedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const paymentHistory: PaymentRecord[] = paymentRows.map((p) => ({
    id: p.id,
    memberId: p.userId ?? '',
    memberName: p.memberName,
    paidAt: p.paidAt.toISOString(),
    description: p.description,
  }));

  const nextPayer = group.isRandomMode
    ? getRandomPayer(members)
    : getNextFairPayer(members, paymentHistory);

  return { ...group, members, paymentHistory, nextPayer };
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

  // If no members remain, delete the group (cascade removes payments)
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
git add "app/api/groups/[id]/route.ts"
git commit -m "feat: add GET/PATCH/DELETE /api/groups/[id]"
```

---

## Task 15: Payments API

**Files:**
- Create: `app/api/groups/[id]/payments/route.ts`

- [ ] **Step 1: Create app/api/groups/[id]/payments/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, users } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import type { Member, PaymentRecord } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId } = await params;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, session.user.id)))
    .limit(1);

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Build current members + payment history to compute next payer
  const memberRows = await db
    .select({ id: users.id, name: users.name, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const paymentRows = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.groupId, groupId))
    .orderBy(desc(paymentRecords.paidAt));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    joinedAt: m.joinedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const history: PaymentRecord[] = paymentRows.map((p) => ({
    id: p.id,
    memberId: p.userId ?? '',
    memberName: p.memberName,
    paidAt: p.paidAt.toISOString(),
    description: p.description,
  }));

  const payer = group.isRandomMode
    ? getRandomPayer(members)
    : getNextFairPayer(members, history);

  if (!payer) return NextResponse.json({ error: 'No members in group' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const description =
    typeof body.description === 'string' ? body.description.trim() || null : null;

  await db.insert(paymentRecords).values({
    groupId,
    userId: payer.id,
    memberName: payer.name,
    description,
  });

  // Return updated group detail
  const updatedPaymentRows = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.groupId, groupId))
    .orderBy(desc(paymentRecords.paidAt));

  const updatedHistory: PaymentRecord[] = updatedPaymentRows.map((p) => ({
    id: p.id,
    memberId: p.userId ?? '',
    memberName: p.memberName,
    paidAt: p.paidAt.toISOString(),
    description: p.description,
  }));

  const nextPayer = group.isRandomMode
    ? getRandomPayer(members)
    : getNextFairPayer(members, updatedHistory);

  return NextResponse.json({ ...group, members, paymentHistory: updatedHistory, nextPayer }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/groups/[id]/payments/route.ts"
git commit -m "feat: add POST /api/groups/[id]/payments"
```

---

## Task 16: Update home page + UserSetup component

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/UserSetup.tsx`

- [ ] **Step 1: Replace components/UserSetup.tsx**

```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function UserSetup() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    await signIn('resend', { email: trimmed, redirect: false });
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">✉️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-600">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <p className="text-sm text-gray-400 mt-4">
              No email? Check your spam folder or{' '}
              <button
                className="text-blue-600 underline"
                onClick={() => setSent(false)}
              >
                try again
              </button>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Turnly</h1>
            <p className="text-xl text-gray-600">Who&apos;s paying next?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@example.com"
                className="w-full"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            No password needed — we&apos;ll email you a sign-in link
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace app/page.tsx**

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserSetup } from '@/components/UserSetup';

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return <UserSetup />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/UserSetup.tsx
git commit -m "feat: replace name form with email magic link sign-in"
```

---

## Task 17: Onboarding page

**Files:**
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Create app/onboarding/page.tsx**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Onboarding() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.name) router.push('/dashboard');
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your display name');
      return;
    }
    if (trimmed.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    await update({ name: trimmed });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Turnly!</h1>
            <p className="text-gray-600">What should we call you?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Display name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="John Doe"
                maxLength={50}
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Saving…' : "Let's Go"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add SessionProvider to layout (required for `useSession`)**

Open `app/layout.tsx` and wrap children with a SessionProvider. First create a client wrapper component `components/session-provider.tsx`:

```typescript
'use client';

import { SessionProvider } from 'next-auth/react';

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Then update `app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { NextAuthProvider } from '@/components/session-provider';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Turnly — Who's Paying Next?",
  description: 'Fair payment turn manager for groups. Manage tea rounds, parties, food orders, and more.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx components/session-provider.tsx app/layout.tsx
git commit -m "feat: add onboarding page and fix layout font + SessionProvider"
```

---

## Task 18: Update dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Replace app/dashboard/page.tsx**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { GroupSummary } from '@/lib/types';
import { GroupCreator } from '@/components/GroupCreator';
import { GroupJoiner } from '@/components/GroupJoiner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Dashboard() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then(setGroups)
      .catch(console.error);
  }, []);

  const refreshGroups = () =>
    fetch('/api/groups').then((r) => r.json()).then(setGroups).catch(console.error);

  const handleGroupCreated = (newGroup: GroupSummary) => {
    setGroups((prev) => [newGroup, ...prev]);
    setShowCreate(false);
  };

  const handleGroupJoined = () => {
    // Refetch so counts are accurate — the join endpoint returns a raw group row without counts
    refreshGroups();
    setShowJoin(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Turnly</h1>
            <p className="text-sm text-gray-600">Welcome, {session?.user?.name}</p>
          </div>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: '/' })}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button onClick={() => setShowCreate(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
            + Create Group
          </Button>
          <Button onClick={() => setShowJoin(true)} variant="outline" size="lg">
            Join Group
          </Button>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create a Group</DialogTitle>
            </DialogHeader>
            <GroupCreator onGroupCreated={handleGroupCreated} />
          </DialogContent>
        </Dialog>

        <Dialog open={showJoin} onOpenChange={setShowJoin}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Group</DialogTitle>
            </DialogHeader>
            <GroupJoiner onGroupJoined={handleGroupJoined} />
          </DialogContent>
        </Dialog>

        {groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl font-semibold text-gray-900 mb-2">No groups yet</p>
            <p className="text-gray-600 mb-8">Create a new group or join an existing one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link key={group.id} href={`/group/${group.id}`}>
                <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 cursor-pointer h-full">
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
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: update dashboard to fetch from API and use Dialog modals"
```

---

## Task 19: Update CurrentTurn component

**Files:**
- Modify: `components/CurrentTurn.tsx`

- [ ] **Step 1: Replace components/CurrentTurn.tsx**

The `nextPayer` is now passed as a prop (computed server-side in the API). The celebration animation is kept.

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { GroupDetail } from '@/lib/types';

interface CurrentTurnProps {
  group: GroupDetail;
}

export function CurrentTurn({ group }: CurrentTurnProps) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setShowCelebration(true);
    const timer = setTimeout(() => setShowCelebration(false), 2000);
    return () => clearTimeout(timer);
  }, [group.nextPayer?.id]);

  if (!group.nextPayer) {
    return (
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No members in group yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {showCelebration && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white text-center">
        <p className="text-lg font-semibold mb-3 opacity-90">It&apos;s Time to Pay!</p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-6xl">{group.emoji}</span>
        </div>
        <h2 className="text-5xl font-bold mb-2">{group.nextPayer.name}</h2>
        <p className="text-lg opacity-90">
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
git commit -m "refactor: CurrentTurn accepts nextPayer from API response"
```

---

## Task 20: Update MarkAsPaidButton component

**Files:**
- Modify: `components/MarkAsPaidButton.tsx`

- [ ] **Step 1: Replace components/MarkAsPaidButton.tsx**

```typescript
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
  onPaymentMarked: (updatedGroup: GroupDetail) => void;
}

export function MarkAsPaidButton({ group, onPaymentMarked }: MarkAsPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!group.nextPayer) return;
    setLoading(true);

    const res = await fetch(`/api/groups/${group.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });

    if (res.ok) {
      const updated: GroupDetail = await res.json();
      onPaymentMarked(updated);
      setOpen(false);
      setDescription('');
    }

    setLoading(false);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={!group.nextPayer}
      >
        Mark as Paid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="pay-description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="pay-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Tea round, Party drinks, Lunch order"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={loading}
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
git commit -m "fix: remove require() from MarkAsPaidButton, call payments API"
```

---

## Task 21: Update GroupCreator, GroupJoiner, MembersList, PaymentHistory

**Files:**
- Modify: `components/GroupCreator.tsx`
- Modify: `components/GroupJoiner.tsx`
- Modify: `components/MembersList.tsx`
- Modify: `components/PaymentHistory.tsx`

- [ ] **Step 1: Replace components/GroupCreator.tsx**

GroupCreator now calls `POST /api/groups` and returns a `GroupSummary`.

```typescript
'use client';

import { useState } from 'react';
import type { GroupSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GroupCreatorProps {
  onGroupCreated: (group: GroupSummary) => void;
}

const EMOJI_OPTIONS = ['☕', '🍕', '🍜', '🍺', '🎉', '🥘', '🍔', '🍱', '🍰', '🥗', '🌮', '🍛'];

export function GroupCreator({ onGroupCreated }: GroupCreatorProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('☕');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError('Please enter a group name');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description.trim(), emoji: selectedEmoji }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    const newGroup: GroupSummary = await res.json();
    onGroupCreated(newGroup);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
          Group Name *
        </label>
        <Input
          id="groupName"
          type="text"
          value={groupName}
          onChange={(e) => { setGroupName(e.target.value); setError(''); }}
          placeholder="Office Tea Gang"
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description (optional)
        </label>
        <Input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this group for?"
          maxLength={200}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Choose an Emoji</label>
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedEmoji(emoji)}
              className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                selectedEmoji === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Creating…' : 'Create Group'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Replace components/GroupJoiner.tsx**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateGroupCode } from '@/lib/codeGenerator';

interface GroupJoinerProps {
  onGroupJoined: () => void;
}

export function GroupJoiner({ onGroupJoined }: GroupJoinerProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.toUpperCase().trim();

    if (!validateGroupCode(trimmed)) {
      setError('Invalid group code. Use the 6-character code.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    onGroupJoined();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
          Group Code
        </label>
        <Input
          id="code"
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          placeholder="ABC123"
          maxLength={6}
          className="text-center text-lg font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">Ask your group admin for the code</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Joining…' : 'Join Group'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Replace components/MembersList.tsx**

```typescript
'use client';

import type { Member, PaymentRecord } from '@/lib/types';

interface MembersListProps {
  members: Member[];
  paymentHistory: PaymentRecord[];
}

export function MembersList({ members, paymentHistory }: MembersListProps) {
  const getCount = (memberId: string) =>
    paymentHistory.filter((p) => p.memberId === memberId).length;

  const sorted = [...members].sort((a, b) => getCount(a.id) - getCount(b.id));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Members</h3>

      {members.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No members yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <div>
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                {getCount(member.id)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace components/PaymentHistory.tsx**

```typescript
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
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-semibold text-gray-900">{record.memberName}</td>
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

- [ ] **Step 5: Commit**

```bash
git add components/GroupCreator.tsx components/GroupJoiner.tsx components/MembersList.tsx components/PaymentHistory.tsx
git commit -m "refactor: update all components for API-based data and new types"
```

---

## Task 22: Update group detail page

**Files:**
- Modify: `app/group/[id]/page.tsx`

- [ ] **Step 1: Replace app/group/[id]/page.tsx**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { GroupDetail } from '@/lib/types';
import { CurrentTurn } from '@/components/CurrentTurn';
import { GroupInfo } from '@/components/GroupInfo';
import { MembersList } from '@/components/MembersList';
import { PaymentHistory } from '@/components/PaymentHistory';
import { MarkAsPaidButton } from '@/components/MarkAsPaidButton';
import { RandomModeToggle } from '@/components/RandomModeToggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${id}`)
      .then((r) => {
        if (!r.ok) { router.push('/dashboard'); return null; }
        return r.json();
      })
      .then((data) => data && setGroup(data))
      .catch(() => router.push('/dashboard'));
  }, [id, router]);

  const handlePaymentMarked = (updated: GroupDetail) => setGroup(updated);

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
            <CurrentTurn group={group} />
            <MarkAsPaidButton group={group} onPaymentMarked={handlePaymentMarked} />
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

- [ ] **Step 2: Update RandomModeToggle to accept a simple callback**

The `onToggle` prop now takes no arguments (the parent handles the API call). Open `components/RandomModeToggle.tsx` and replace:

```typescript
'use client';

import type { GroupDetail } from '@/lib/types';

interface RandomModeToggleProps {
  group: GroupDetail;
  onToggle: () => void;
}

export function RandomModeToggle({ group, onToggle }: RandomModeToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-900">
          {group.isRandomMode ? '🎲 Random Mode' : '⚖️ Fair Mode'}
        </p>
        <p className="text-sm text-gray-600">
          {group.isRandomMode ? 'Anyone can pay next' : 'Fair turn based on history'}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
          group.isRandomMode ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
            group.isRandomMode ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Update GroupInfo to accept GroupDetail type**

Open `components/GroupInfo.tsx` and change the import from `Group` to `GroupDetail`:

```typescript
'use client';

import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface GroupInfoProps {
  group: GroupDetail;
  onCopyCode: () => void;
}

export function GroupInfo({ group, onCopyCode }: GroupInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{group.emoji}</span>
            <h3 className="text-2xl font-bold text-gray-900">{group.name}</h3>
          </div>
          {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Members:</span> {group.members.length}
            </p>
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Total Payments:</span> {group.paymentHistory.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-gray-600 mb-2">Share this code with your group:</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-lg p-3 text-center">
            <p className="font-mono text-2xl font-bold text-gray-900 tracking-wider">{group.code}</p>
          </div>
          <Button onClick={onCopyCode} variant="outline" size="sm">
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/group/[id]/page.tsx" components/RandomModeToggle.tsx components/GroupInfo.tsx
git commit -m "feat: update group detail page to fetch from API"
```

---

## Task 23: Code quality fixes + cleanup

**Files:**
- Modify: `next.config.mjs`
- Delete: `lib/storage.ts`
- Delete: root markdown docs
- Modify: `README.md`

- [ ] **Step 1: Replace next.config.mjs**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 2: Delete lib/storage.ts**

```bash
rm lib/storage.ts
```

- [ ] **Step 3: Delete stale markdown docs**

```bash
rm BUILD_SUMMARY.md COMPLETION_REPORT.md DEPLOY.md GUIDE.md IMPLEMENTATION.md PROJECT_COMPLETE.txt QUICKSTART.md START_HERE.md TESTING.md
```

- [ ] **Step 4: Update README.md**

```markdown
# Turnly — Who's Paying Next?

A fair payment turn manager for groups. Create a group, share the code, and Turnly tracks whose turn it is to pay — across all devices.

## Stack

- **Next.js 16** (App Router)
- **Neon Postgres** + **Drizzle ORM**
- **Auth.js v5** — magic link via **Resend**
- **Tailwind CSS** + **shadcn/ui**
- **Vercel** deployment

## Local Development

1. Clone the repo
2. Install dependencies: `pnpm install`
3. Create a Neon database at [console.neon.tech](https://console.neon.tech)
4. Create a Resend account at [resend.com](https://resend.com) and get an API key
5. Copy `.env.local.example` to `.env.local` and fill in the values:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=              # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_RESEND_KEY=re_...
EMAIL_FROM=Turnly <onboarding@resend.dev>
```

6. Push the schema to your database: `pnpm db:push`
7. Start the dev server: `pnpm dev`

## Deployment (Vercel)

1. Connect your GitHub repo to Vercel
2. Add environment variables in the Vercel dashboard (same as `.env.local` but with production values — set `AUTH_URL` to your Vercel domain)
3. Deploy

## Running Tests

```bash
pnpm test
```
```

- [ ] **Step 5: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
AUTH_SECRET=generate_with_openssl_rand_-base64_32
AUTH_URL=http://localhost:3000
AUTH_RESEND_KEY=re_your_key_here
EMAIL_FROM=Turnly <onboarding@resend.dev>
EOF
```

- [ ] **Step 6: Commit**

```bash
git add next.config.mjs README.md .env.local.example
git add -A
git commit -m "chore: remove ignoreBuildErrors, delete storage.ts and stale docs, update README"
```

---

## Task 24: Build verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (`fairTurn.test.ts` and `codeGenerator.test.ts`).

- [ ] **Step 2: Run TypeScript build**

```bash
pnpm build
```

Expected: Build succeeds with zero errors. Fix any type errors before proceeding.

- [ ] **Step 3: Smoke test locally**

```bash
pnpm dev
```

Walk through the full golden path:
1. Open `http://localhost:3000` → email form appears
2. Enter email → "Check your email" screen appears
3. Click the magic link in the email → `/onboarding` page appears
4. Enter a display name → redirected to `/dashboard`
5. Create a group → group appears in the grid
6. Copy the group code
7. Open an incognito window → sign in with a different email → enter name → join the group using the code → group appears in the second user's dashboard
8. Open the group → "who pays next" is shown
9. Click "Mark as Paid" → confirm → payment appears in history, next payer updates

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
# Verify nothing unintended is staged
git commit -m "feat: complete production migration to Neon + Auth.js"
```
