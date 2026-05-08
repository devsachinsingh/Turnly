import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import postgres from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? '';

// neon-http for Vercel/Neon (serverless-safe); postgres.js for local Docker dev.
export const db = url.includes('neon.tech')
  ? drizzleNeon(neon(url), { schema })
  : drizzlePg(postgres(url), { schema });
