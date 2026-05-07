export interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface Member {
  id: string;
  name: string;
  joinedAt: string;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  paidAt: string;
  description?: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  code: string;
  isRandomMode: boolean;
  createdAt: string;
  memberCount: number;
  paymentCount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  code: string;
  isRandomMode: boolean;
  createdAt: string;
  members: Member[];
  paymentHistory: PaymentRecord[];
  nextPayer: { id: string; name: string } | null;
}
