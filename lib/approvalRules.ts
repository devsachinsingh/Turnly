export function getRequiredApprovals(memberCount: number): number {
  if (memberCount <= 1) return 0;
  if (memberCount === 2) return 1;
  return 2;
}

export function getRequiredCancelVotes(memberCount: number): number {
  return memberCount - 1;
}
