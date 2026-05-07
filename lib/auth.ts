import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Resend from 'next-auth/providers/resend';
import Nodemailer from 'next-auth/providers/nodemailer';
import { db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { authConfig } from './auth.config';

const isLocal = process.env.NODE_ENV !== 'production';

const emailProvider = isLocal
  ? Nodemailer({
      id: 'resend',
      server: process.env.EMAIL_SERVER ?? 'smtp://localhost:1025',
      from: process.env.EMAIL_FROM ?? 'Turnly <noreply@localhost>',
    })
  : Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    });

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [emailProvider],
});
