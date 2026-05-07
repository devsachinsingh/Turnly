# Turnly — Production Migration Design

**Date:** 2026-05-07
**Status:** Approved

## Overview

Migrate Turnly from a localStorage-only single-device app to a production-ready web app backed by Neon Postgres, Auth.js v5 magic-link authentication, and Resend for email. Deploy on Vercel. All data syncs across devices; group codes work across different users' browsers.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) — unchanged |
| Database | Neon Postgres (`@neondatabase/serverless`) |
| ORM | Drizzle ORM + drizzle-kit (migrations) |
| Auth | Auth.js v5 (Email / magic link provider) |
| Email | Resend (free tier: 3,000/month, 100/day) |
| Deployment | Vercel |
| UI | shadcn/ui + Tailwind — unchanged |

---

## Database Schema

### App Tables

```sql
users
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
  email       text  UNIQUE NOT NULL
  name        text  NOT NULL DEFAULT ''
  created_at  timestamp DEFAULT now()

groups
  id             uuid     PRIMARY KEY DEFAULT gen_random_uuid()
  name           text     NOT NULL
  description    text
  emoji          text     NOT NULL DEFAULT '☕'
  code           text     UNIQUE NOT NULL   -- 6-char alphanumeric, collision-checked
  is_random_mode boolean  DEFAULT false
  created_at     timestamp DEFAULT now()

group_members
  id         uuid  PRIMARY KEY DEFAULT gen_random_uuid()
  group_id   uuid  NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  user_id    uuid  NOT NULL REFERENCES users(id) ON DELETE CASCADE
  joined_at  timestamp DEFAULT now()
  UNIQUE(group_id, user_id)

payment_records
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
  group_id    uuid  NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  user_id     uuid  REFERENCES users(id) ON DELETE SET NULL
  member_name text  NOT NULL   -- denormalised; survives user deletion
  description text
  paid_at     timestamp DEFAULT now()
```

### Auth.js Tables (auto-managed)

```
verification_tokens  -- one-time magic link tokens with expiry (10 min)
accounts             -- OAuth provider accounts (unused now, reserved)
sessions             -- database sessions (unused; we use JWT cookies)
```

### Key Decisions

- `member_name` is stored on `payment_records` so history survives user deletion
- `ON DELETE CASCADE` on `group_members` and `payment_records` means deleting a group is clean
- If the last member leaves a group, the group row is deleted (application-level check before `DELETE`)
- Group code uniqueness enforced at DB level (UNIQUE constraint) and application level (retry loop, max 5 attempts)

---

## Auth Flow

### Sign-in

1. User lands on `/` → email input form (replaces current name-only form)
2. Submits email → Auth.js `signIn("email", { email })` called
3. Auth.js generates one-time token → stores in `verification_tokens` (expires 10 min)
4. Resend delivers: "Click here to sign in to Turnly" email
5. User clicks link → `/api/auth/callback/email?token=...`
6. Auth.js verifies token → finds or creates `users` row → sets JWT session cookie
7. First-time user (empty `name`) → redirect to `/onboarding`; returning user → `/dashboard`

### Onboarding (first time only)

- Single screen: display name input
- POST saves `name` to `users` table
- Redirect to `/dashboard`

### Session

- Auth.js JWT session cookie — stateless, no DB hit on each request
- All API routes call `auth()` to get the current user; unauthenticated → 401
- `signOut()` clears the cookie → redirect to `/`

### Home Page Changes

- Name input → Email input
- "Let's Go" → "Send magic link"
- After submit → "Check your email ✉️" confirmation state (no redirect)

---

## API Design

All routes under `app/api/`. Every route validates the Auth.js session.

```
POST   /api/auth/[...nextauth]      Auth.js handler (do not touch)

GET    /api/groups                  List groups current user belongs to
POST   /api/groups                  Create group; auto-add creator as member

POST   /api/groups/join             Join by code — body: { code: "ABC123" }

GET    /api/groups/[id]             Group detail: info + members + payment history
PATCH  /api/groups/[id]             Toggle is_random_mode — body: { isRandomMode: boolean }
DELETE /api/groups/[id]             Leave group (remove self from group_members)
                                    If last member → delete group row

POST   /api/groups/[id]/payments    Mark as paid — body: { description?: string }
                                    Server computes next payer (fair or random)
                                    Client never sends memberId — prevents spoofing
```

### Behaviours

- **GET /api/groups/[id]**: Returns group info, members, payment history, and a computed `nextPayer: { id, name }` field — server runs `getNextFairPayer` or `getRandomPayer` so the client never recomputes it
- **POST /api/groups/[id]/payments**: Server runs `getNextFairPayer` or `getRandomPayer` against current DB state, inserts `payment_records` row, returns updated group including refreshed `nextPayer`
- **POST /api/groups/join**: Validates code format → finds group → checks user not already member → inserts `group_members` row
- **DELETE /api/groups/[id]**: Removes `group_members` row for current user. If `group_members` count drops to 0 → deletes `groups` row (cascade handles the rest)
- **Group code generation**: `generateGroupCode()` + DB uniqueness check, retry up to 5 times

---

## Frontend Changes

### Pages

| Page | Change |
|---|---|
| `/` | Email input + magic link flow + "check your email" state |
| `/onboarding` | New page — display name input for first-time users |
| `/dashboard` | Fetch `/api/groups`; refresh after create/join; Dialog modals |
| `/group/[id]` | Fetch `/api/groups/[id]`; all mutations via API; Dialog modals |

### Component Changes

| Component | Change |
|---|---|
| `UserSetup.tsx` | Replaced by email + magic link UI |
| `MarkAsPaidButton.tsx` | Remove `require()` → proper ESM imports; payer computed server-side |
| `CurrentTurn.tsx` | Payer from API response, not recomputed client-side |
| All modals | Hand-rolled `<div>` overlays → shadcn `<Dialog>` (a11y, focus trap, Esc) |

### Fixes

- `next.config.mjs`: remove `ignoreBuildErrors: true`, remove `images: { unoptimized: true }`
- `layout.tsx`: apply Geist font class to `<body>`; remove `generator: 'v0.app'` from metadata
- `lib/storage.ts`: deleted — all data via API
- React keys: `index` → actual record `id` fields
- IDs: `Date.now()` string → `crypto.randomUUID()` (where still generated client-side)

### Root Cleanup

Delete: `BUILD_SUMMARY.md`, `COMPLETION_REPORT.md`, `DEPLOY.md`, `GUIDE.md`, `IMPLEMENTATION.md`, `PROJECT_COMPLETE.txt`, `QUICKSTART.md`, `START_HERE.md`, `TESTING.md`

Keep: `README.md` (to be updated with new setup instructions)

---

## New Files / Structure

```
app/
  api/
    auth/[...nextauth]/route.ts   -- Auth.js handler
    groups/
      route.ts                    -- GET list, POST create
      join/route.ts               -- POST join by code
      [id]/
        route.ts                  -- GET detail, PATCH mode, DELETE leave
        payments/route.ts         -- POST mark as paid
  onboarding/
    page.tsx                      -- first-time name setup

lib/
  db/
    index.ts                      -- Neon + Drizzle client
    schema.ts                     -- Drizzle table definitions
  auth.ts                         -- Auth.js config (Resend + Drizzle adapter)
  fairTurn.ts                     -- unchanged
  randomTurn.ts                   -- unchanged
  codeGenerator.ts                -- unchanged

drizzle.config.ts                 -- drizzle-kit config
```

---

## Environment Variables

```env
# Neon
DATABASE_URL=

# Auth.js
AUTH_SECRET=                      # openssl rand -base64 32
AUTH_URL=                         # e.g. https://turnly.vercel.app

# Resend
AUTH_RESEND_KEY=                  # Resend API key
EMAIL_FROM=                       # e.g. noreply@yourdomain.com
```

---

## Out of Scope (this iteration)

- Real-time sync (WebSockets / SSE) — manual refresh is acceptable
- Gamification / badges / streaks — deferred
- Social reactions on payments — deferred
- OAuth providers (Google, GitHub) — Auth.js supports adding later with zero schema changes
- Admin / group owner permissions
