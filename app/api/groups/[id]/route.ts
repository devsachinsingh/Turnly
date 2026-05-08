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

  // When switching modes, clear the locked random payer so a fresh pick happens.
  await db
    .update(groups)
    .set({ isRandomMode: body.isRandomMode, currentRandomPayerId: null })
    .where(eq(groups.id, id));

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
