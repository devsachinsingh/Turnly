import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords, paymentApprovals, users } from '@/lib/db/schema';
import { eq, and, lt, desc, ne } from 'drizzle-orm';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';
import type { Member, PaymentRecord, PendingPayment, GroupDetail } from '@/lib/types';

export async function buildGroupDetail(groupId: string): Promise<GroupDetail | null> {
  await db.delete(paymentRecords).where(
    and(
      eq(paymentRecords.groupId, groupId),
      eq(paymentRecords.status, 'pending'),
      lt(paymentRecords.expiresAt, new Date()),
    ),
  );

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) return null;

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

  const allPaymentRows = await db
    .select()
    .from(paymentRecords)
    .where(eq(paymentRecords.groupId, groupId))
    .orderBy(desc(paymentRecords.paidAt));

  const approvedHistory: PaymentRecord[] = allPaymentRows
    .filter((p) => p.status === 'approved')
    .map((p) => ({
      id: p.id,
      memberId: p.userId ?? '',
      memberName: p.memberName,
      paidAt: p.paidAt.toISOString(),
      description: p.description,
      amount: parseFloat(p.amount),
      status: 'approved' as const,
    }));

  const pendingRows = allPaymentRows.filter((p) => p.status === 'pending');
  const pendingPayments: PendingPayment[] = [];

  for (const p of pendingRows) {
    const votes = await db
      .select()
      .from(paymentApprovals)
      .where(eq(paymentApprovals.paymentId, p.id));

    pendingPayments.push({
      id: p.id,
      payerId: p.userId ?? '',
      payerName: p.memberName,
      amount: parseFloat(p.amount),
      description: p.description,
      expiresAt: p.expiresAt.toISOString(),
      approvals: votes.filter((v) => v.action === 'approve').map((v) => ({ userId: v.userId ?? '' })),
      cancelVotes: votes.filter((v) => v.action === 'cancel_vote').map((v) => ({ userId: v.userId ?? '' })),
    });
  }

  let nextPayer: { id: string; name: string } | null;

  if (group.isRandomMode) {
    if (group.currentRandomPayerId) {
      nextPayer = members.find((m) => m.id === group.currentRandomPayerId) ?? null;
    } else {
      nextPayer = getRandomPayer(members);
      if (nextPayer) {
        await db
          .update(groups)
          .set({ currentRandomPayerId: nextPayer.id })
          .where(eq(groups.id, groupId));
      }
    }
  } else {
    nextPayer = getNextFairPayer(members, approvedHistory);
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    emoji: group.emoji,
    code: group.code,
    isRandomMode: group.isRandomMode,
    createdAt: group.createdAt?.toISOString() ?? new Date().toISOString(),
    members,
    paymentHistory: approvedHistory,
    nextPayer,
    pendingPayments,
    isFrozen: pendingPayments.length >= 3,
  };
}
