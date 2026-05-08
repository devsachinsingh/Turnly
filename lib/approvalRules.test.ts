import { describe, it, expect } from 'vitest';
import { getRequiredApprovals, getRequiredCancelVotes } from './approvalRules';

describe('getRequiredApprovals', () => {
  it('returns 0 for 1 member (auto-approve)', () => {
    expect(getRequiredApprovals(1)).toBe(0);
  });
  it('returns 1 for 2 members', () => {
    expect(getRequiredApprovals(2)).toBe(1);
  });
  it('returns 2 for 3 members', () => {
    expect(getRequiredApprovals(3)).toBe(2);
  });
  it('returns 2 for 10 members', () => {
    expect(getRequiredApprovals(10)).toBe(2);
  });
});

describe('getRequiredCancelVotes', () => {
  it('returns 1 for 2 members', () => {
    expect(getRequiredCancelVotes(2)).toBe(1);
  });
  it('returns 2 for 3 members', () => {
    expect(getRequiredCancelVotes(3)).toBe(2);
  });
  it('returns 9 for 10 members', () => {
    expect(getRequiredCancelVotes(10)).toBe(9);
  });
});
