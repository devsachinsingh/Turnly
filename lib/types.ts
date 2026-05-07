export interface User {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  name: string;
  joinedDate: string;
}

export interface PaymentRecord {
  memberId: string;
  memberName: string;
  date: string;
  description?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  code: string;
  members: Member[];
  paymentHistory: PaymentRecord[];
  createdAt: string;
  isRandomMode?: boolean;
}
