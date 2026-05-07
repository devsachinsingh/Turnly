'use client';

import { useState } from 'react';
import { Group, PaymentRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MarkAsPaidButtonProps {
  group: Group;
  onPaymentMarked: (updatedGroup: Group) => void;
}

export function MarkAsPaidButton({ group, onPaymentMarked }: MarkAsPaidButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState('');

  const handleMarkAsPaid = () => {
    if (group.members.length === 0) return;

    // Get the current payer (same logic as CurrentTurn)
    const { getNextFairPayer } = require('@/lib/fairTurn');
    const { getRandomPayer } = require('@/lib/randomTurn');

    const currentPayer = group.isRandomMode
      ? getRandomPayer(group.members)
      : getNextFairPayer(group.members, group.paymentHistory);

    if (!currentPayer) return;

    const newPayment: PaymentRecord = {
      memberId: currentPayer.id,
      memberName: currentPayer.name,
      date: new Date().toISOString(),
      description: description.trim() || undefined,
    };

    const updatedGroup = {
      ...group,
      paymentHistory: [...group.paymentHistory, newPayment],
    };

    onPaymentMarked(updatedGroup);
    setShowModal(false);
    setDescription('');
  };

  return (
    <>
      <Button onClick={() => setShowModal(true)} size="lg" className="w-full bg-green-600 hover:bg-green-700">
        Mark as Paid
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Mark Payment</h3>

            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Tea round, Party drinks, Lunch order"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleMarkAsPaid}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
