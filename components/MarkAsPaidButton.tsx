'use client';

import { useState } from 'react';
import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MarkAsPaidButtonProps {
  group: GroupDetail;
  currentUserId: string;
  onPaymentMarked: (updatedGroup: GroupDetail) => void;
}

export function MarkAsPaidButton({ group, currentUserId, onPaymentMarked }: MarkAsPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const isYourTurn = group.nextPayer?.id === currentUserId;

  const handleConfirm = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    setLoading(true);

    const res = await fetch(`/api/groups/${group.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parsedAmount, description }),
    });

    if (res.ok) {
      const updated: GroupDetail = await res.json();
      onPaymentMarked(updated);
      setOpen(false);
      setAmount('');
      setDescription('');
    }

    setLoading(false);
  };

  if (!isYourTurn) {
    return (
      <div className="w-full text-center py-3 px-4 bg-gray-100 rounded-lg text-gray-600 text-sm">
        Waiting for <span className="font-semibold">{group.nextPayer?.name ?? '…'}</span> to record their payment
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={group.isFrozen}
        title={group.isFrozen ? 'Approve or cancel pending payments first' : undefined}
      >
        {group.isFrozen ? '⚠️ Approve pending payments first' : 'Mark as Paid'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="pay-description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="pay-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Tea round, Party drinks, Lunch order"
              />
            </div>
            <p className="text-sm text-gray-600">
              Recording payment for <span className="font-semibold">{group.nextPayer?.name}</span>
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={loading || !amount || parseFloat(amount) <= 0}
              >
                {loading ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
