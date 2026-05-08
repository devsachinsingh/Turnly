import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupMembers, paymentRecords, paymentApprovals } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { getRequiredCancelVotes } from '@/lib/approvalRules';
import { buildGroupDetail } from '@/lib/groupDetail';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId, paymentId } = await params;
  const userId = session.user.id;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [payment] = await db
    .select()
    .from(paymentRecords)
    .where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.groupId, groupId)))
    .limit(1);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment is not pending' }, { status: 409 });
  }

  if (payment.userId === userId) {
    await db
      .update(paymentRecords)
      .set({ status: 'cancelled' })
      .where(eq(paymentRecords.id, paymentId));
    const detail = await buildGroupDetail(groupId);
    return NextResponse.json(detail);
  }

  try {
    await db.insert(paymentApprovals).values({ paymentId, userId, action: 'cancel_vote' });
  } catch {
    return NextResponse.json({ error: 'Already voted' }, { status: 409 });
  }

  const memberRows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const [{ total: cancelVoteCount }] = await db
    .select({ total: count() })
    .from(paymentApprovals)
    .where(and(eq(paymentApprovals.paymentId, paymentId), eq(paymentApprovals.action, 'cancel_vote')));

  const required = getRequiredCancelVotes(memberRows.length);
  if (cancelVoteCount >= required) {
    await db
      .update(paymentRecords)
      .set({ status: 'cancelled' })
      .where(eq(paymentRecords.id, paymentId));
  }

  const detail = await buildGroupDetail(groupId);
  return NextResponse.json(detail);
}
