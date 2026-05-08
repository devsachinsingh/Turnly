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
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isYourTurn = group.nextPayer?.id === currentUserId;

  const handleOpen = () => {
    setError('');
    setDescription('');
    setOpen(true);
  };

  const handleConfirm = async () => {
    if (!group.nextPayer) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/groups/${group.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (res.ok) {
        const updated: GroupDetail = await res.json();
        onPaymentMarked(updated);
        setOpen(false);
        setDescription('');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
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
        onClick={handleOpen}
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
      >
        Mark as Paid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Recording payment for <span className="font-semibold">{group.nextPayer?.name}</span>
            </p>
            <div>
              <label htmlFor="pay-description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="pay-description"
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(''); }}
                placeholder="e.g., Tea round, Party drinks, Lunch order"
                maxLength={200}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={loading}
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
