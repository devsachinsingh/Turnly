'use client';

import { useState } from 'react';
import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { getRequiredApprovals } from '@/lib/approvalRules';

interface PendingApprovalsProps {
  group: GroupDetail;
  currentUserId: string;
  onUpdate: (updatedGroup: GroupDetail) => void;
}

function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function PendingApprovals({ group, currentUserId, onUpdate }: PendingApprovalsProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  if (group.pendingPayments.length === 0) return null;

  const required = getRequiredApprovals(group.members.length);

  const act = async (paymentId: string, action: 'approve' | 'cancel') => {
    const key = paymentId + action;
    setLoadingKey(key);
    const res = await fetch(`/api/groups/${group.id}/payments/${paymentId}/${action}`, {
      method: 'POST',
    });
    if (res.ok) {
      const updated: GroupDetail = await res.json();
      onUpdate(updated);
    }
    setLoadingKey(null);
  };

  return (
    <div className="space-y-3">
      {group.isFrozen && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-800 text-sm font-medium">
          ⚠️ 3 pending payments — approve or cancel before new payments can be recorded.
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">Pending Approvals</h3>

      {group.pendingPayments.map((payment) => {
        const isPayer = payment.payerId === currentUserId;
        const hasApproved = payment.approvals.some((a) => a.userId === currentUserId);
        const hasCancelVoted = payment.cancelVotes.some((v) => v.userId === currentUserId);
        const days = daysLeft(payment.expiresAt);

        return (
          <div key={payment.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{payment.payerName}</p>
                <p className="text-xl font-bold text-green-700">₹{payment.amount.toFixed(2)}</p>
                {payment.description && (
                  <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
                )}
              </div>
              <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
                <p>{payment.approvals.length}/{required} approvals</p>
                <p className={days <= 2 ? 'text-red-600 font-semibold' : ''}>{days}d left</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isPayer || hasApproved || loadingKey === payment.id + 'approve'}
                onClick={() => act(payment.id, 'approve')}
              >
                {hasApproved ? '✓ Approved' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={(hasCancelVoted && !isPayer) || loadingKey === payment.id + 'cancel'}
                onClick={() => act(payment.id, 'cancel')}
              >
                {isPayer
                  ? 'Cancel Request'
                  : hasCancelVoted
                  ? '✓ Voted to Cancel'
                  : 'Vote to Cancel'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
