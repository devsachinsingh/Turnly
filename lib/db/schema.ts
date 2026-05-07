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
