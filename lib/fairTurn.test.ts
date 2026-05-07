import { describe, it, expect } from 'vitest';
import { getNextFairPayer } from './fairTurn';
import type { Member, PaymentRecord } from './types';

const alice: Member = { id: 'u1', name: 'Alice', joinedAt: '2024-01-01T00:00:00.000Z' };
const bob: Member = { id: 'u2', name: 'Bob', joinedAt: '2024-01-01T00:00:00.000Z' };
const carol: Member = { id: 'u3', name: 'Carol', joinedAt: '2024-01-01T00:00:00.000Z' };

function payment(memberId: string, paidAt: string): PaymentRecord {
  return { id: `p-${memberId}-${paidAt}`, memberId, memberName: memberId, paidAt, description: null };
}

describe('getNextFairPayer', () => {
  it('returns null for empty member list', () => {
    expect(getNextFairPayer([], [])).toBeNull();
  });

  it('returns the only member when no payments exist', () => {
    expect(getNextFairPayer([alice], [])).toEqual(alice);
  });

  it('returns member with fewest payments', () => {
    const history = [
      payment('u1', '2024-01-02T00:00:00.000Z'),
      payment('u1', '2024-01-03T00:00:00.000Z'),
      payment('u2', '2024-01-04T00:00:00.000Z'),
    ];
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('on a tie picks the member who paid least recently', () => {
    const history = [
      payment('u1', '2024-01-10T00:00:00.000Z'),
      payment('u2', '2024-01-05T00:00:00.000Z'),
    ];
    // Both paid once; Bob paid earlier so Bob is next
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('prefers a member who has never paid over one with a payment', () => {
    const history = [payment('u1', '2024-01-01T00:00:00.000Z')];
    expect(getNextFairPayer([alice, bob], history)).toEqual(bob);
  });

  it('handles three members rotating fairly', () => {
    const history = [
      payment('u1', '2024-01-01T00:00:00.000Z'),
      payment('u2', '2024-01-02T00:00:00.000Z'),
      payment('u3', '2024-01-03T00:00:00.000Z'),
    ];
    // All paid once; Alice paid least recently → Alice is next
    expect(getNextFairPayer([alice, bob, carol], history)).toEqual(alice);
  });
});
