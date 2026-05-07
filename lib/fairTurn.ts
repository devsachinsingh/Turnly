import { Member, PaymentRecord } from './types';

export function getNextFairPayer(
  members: Member[],
  paymentHistory: PaymentRecord[]
): Member | null {
  if (members.length === 0) return null;

  const paymentCounts: Record<string, number> = {};
  members.forEach((member) => {
    paymentCounts[member.id] = 0;
  });

  paymentHistory.forEach((payment) => {
    if (Object.prototype.hasOwnProperty.call(paymentCounts, payment.memberId)) {
      paymentCounts[payment.memberId]++;
    }
  });

  const minCount = Math.min(...Object.values(paymentCounts));
  const candidates = members.filter((m) => paymentCounts[m.id] === minCount);

  if (candidates.length === 1) return candidates[0];

  let leastRecentPayer = candidates[0];
  let leastRecentDate = new Date('2099-12-31');

  for (const candidate of candidates) {
    const lastPayment = paymentHistory
      .filter((p) => p.memberId === candidate.id)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];

    if (lastPayment) {
      const lastDate = new Date(lastPayment.paidAt);
      if (lastDate < leastRecentDate) {
        leastRecentDate = lastDate;
        leastRecentPayer = candidate;
      }
    } else {
      return candidate;
    }
  }

  return leastRecentPayer;
}
