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
