'use client';

import type { Member, PaymentRecord } from '@/lib/types';

interface MembersListProps {
  members: Member[];
  paymentHistory: PaymentRecord[];
}

export function MembersList({ members, paymentHistory }: MembersListProps) {
  const getCount = (memberId: string) =>
    paymentHistory.filter((p) => p.memberId === memberId).length;

  const sorted = [...members].sort((a, b) => getCount(a.id) - getCount(b.id));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Members</h3>

      {members.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No members yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <div>
                <p className="font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                {getCount(member.id)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
