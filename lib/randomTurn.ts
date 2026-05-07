import { Member } from './types';

export function getRandomPayer(members: Member[]): Member | null {
  if (members.length === 0) return null;
  return members[Math.floor(Math.random() * members.length)];
}
