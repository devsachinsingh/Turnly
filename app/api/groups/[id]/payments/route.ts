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

  return NextResponse.json(
    { ...group, members, paymentHistory: updatedHistory, nextPayer },
    { status: 201 }
  );
}
