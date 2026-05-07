import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Resend from 'next-auth/providers/resend';
import Nodemailer from 'next-auth/providers/nodemailer';
import { db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';

const isLocal = process.env.NODE_ENV !== 'production';

const emailProvider = isLocal
  ? Nodemailer({
      server: process.env.EMAIL_SERVER ?? 'smtp://localhost:1025',
      from: process.env.EMAIL_FROM ?? 'Turnly <noreply@localhost>',
    })
  : Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    });

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [emailProvider],
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
