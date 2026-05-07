import { Member, PaymentRecord } from './types';

export function getNextFairPayer(
  members: Member[],
  paymentHistory: PaymentRecord[]
): Member | null {
  if (members.length === 0) return null;

  // Count how many times each member has paid
  const paymentCounts: Record<string, number> = {};
  members.forEach((member) => {
    paymentCounts[member.id] = 0;
  });

  paymentHistory.forEach((payment) => {
    if (paymentCounts.hasOwnProperty(payment.memberId)) {
      paymentCounts[payment.memberId]++;
    }
  });

  // Find minimum payment count
  const minCount = Math.min(...Object.values(paymentCounts));

  // Get all members with minimum payment count
  const candidatesWithMinCount = members.filter((m) => paymentCounts[m.id] === minCount);

  // If only one candidate, return it
  if (candidatesWithMinCount.length === 1) {
    return candidatesWithMinCount[0];
  }

  // Tie-breaker: pick the one who paid least recently
  let leastRecentPayer = candidatesWithMinCount[0];
  let leastRecentDate = new Date('2099-12-31');

  for (const candidate of candidatesWithMinCount) {
    const lastPayment = paymentHistory
      .filter((p) => p.memberId === candidate.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (lastPayment) {
      const lastDate = new Date(lastPayment.date);
      if (lastDate < leastRecentDate) {
        leastRecentDate = lastDate;
        leastRecentPayer = candidate;
      }
    } else {
      // Never paid before - prefer them
      return candidate;
    }
  }

  return leastRecentPayer;
}
