import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, users } from '@/lib/db/schema';
import { eq, and, count, desc } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import { buildGroupDetail } from '@/lib/groupDetail';
import type { Member, PaymentRecord } from '@/lib/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rawAmount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount);
  if (!rawAmount || rawAmount <= 0 || isNaN(rawAmount)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;

  const memberRows = await db
    .select({ id: users.id, name: users.name, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.name ?? '',
    joinedAt: m.joinedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const approvedRows = await db
    .select()
    .from(paymentRecords)
    .where(and(eq(paymentRecords.groupId, groupId), eq(paymentRecords.status, 'approved')))
    .orderBy(desc(paymentRecords.paidAt));

  const approvedHistory: PaymentRecord[] = approvedRows.map((p) => ({
    id: p.id,
    memberId: p.userId ?? '',
    memberName: p.memberName,
    paidAt: p.paidAt.toISOString(),
    description: p.description,
    amount: parseFloat(p.amount),
    status: 'approved' as const,
  }));

  const payer = group.isRandomMode
    ? getRandomPayer(members)
    : getNextFairPayer(members, approvedHistory);

  if (!payer) return NextResponse.json({ error: 'No members in group' }, { status: 400 });

  if (payer.id !== userId) {
    return NextResponse.json({ error: "It's not your turn" }, { status: 403 });
  }

  const [{ total: pendingCount }] = await db
    .select({ total: count() })
    .from(paymentRecords)
    .where(and(eq(paymentRecords.groupId, groupId), eq(paymentRecords.status, 'pending')));

  if (pendingCount >= 3) {
    return NextResponse.json(
      { error: 'Group is frozen — approve or cancel pending payments first' },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  const [inserted] = await db
    .insert(paymentRecords)
    .values({
      groupId,
      userId: payer.id,
      memberName: payer.name,
      description,
      amount: rawAmount.toFixed(2),
      status: 'pending',
      expiresAt,
    })
    .returning({ id: paymentRecords.id });

  if (members.length === 1) {
    await db
      .update(paymentRecords)
      .set({ status: 'approved' })
      .where(eq(paymentRecords.id, inserted.id));
  }

  // Clear locked random payer so next GET picks a new one for the next turn
  if (group.isRandomMode) {
    await db.update(groups).set({ currentRandomPayerId: null }).where(eq(groups.id, groupId));
  }

  const detail = await buildGroupDetail(groupId);
  return NextResponse.json(detail, { status: 201 });
}
