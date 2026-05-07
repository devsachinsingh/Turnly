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
