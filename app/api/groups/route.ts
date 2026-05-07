import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups, groupMembers, paymentRecords } from '@/lib/db/schema';
import { eq, inArray, count } from 'drizzle-orm';
import { generateGroupCode } from '@/lib/codeGenerator';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const memberRows = await db
    .selectDistinct({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  if (memberRows.length === 0) return NextResponse.json([]);

  const ids = memberRows.map((r) => r.groupId);

  const [groupRows, memberCounts, paymentCounts] = await Promise.all([
    db.select().from(groups).where(inArray(groups.id, ids)),
    db
      .select({ groupId: groupMembers.groupId, total: count() })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, ids))
      .groupBy(groupMembers.groupId),
    db
      .select({ groupId: paymentRecords.groupId, total: count() })
      .from(paymentRecords)
      .where(inArray(paymentRecords.groupId, ids))
      .groupBy(paymentRecords.groupId),
  ]);

  const memberCountMap = Object.fromEntries(memberCounts.map((r) => [r.groupId, r.total]));
  const paymentCountMap = Object.fromEntries(paymentCounts.map((r) => [r.groupId, r.total]));

  const result = groupRows.map((g) => ({
    ...g,
    memberCount: memberCountMap[g.id] ?? 0,
    paymentCount: paymentCountMap[g.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const emoji = typeof body.emoji === 'string' ? body.emoji : '☕';

  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'Group name must be 1–100 characters' }, { status: 400 });
  }

  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateGroupCode();
    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.code, candidate))
      .limit(1);
    if (existing.length === 0) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });
  }

  const groupId = crypto.randomUUID();

  await db.insert(groups).values({ id: groupId, name, description, emoji, code, isRandomMode: false });
  await db.insert(groupMembers).values({ groupId, userId: session.user.id });

  const [newGroup] = await db.select().from(groups).where(eq(groups.id, groupId));

  return NextResponse.json({ ...newGroup, memberCount: 1, paymentCount: 0 }, { status: 201 });
}
