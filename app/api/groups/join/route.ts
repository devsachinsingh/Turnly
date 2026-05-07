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
