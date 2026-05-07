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
  onPaymentMarked: (updatedGroup: GroupDetail) => void;
}

export function MarkAsPaidButton({ group, onPaymentMarked }: MarkAsPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!group.nextPayer) return;
    setLoading(true);

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
    }

    setLoading(false);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={!group.nextPayer}
      >
        Mark as Paid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="pay-description" className="block text-sm font-medium text-gray-700 mb-2">
                What was this for? (optional)
              </label>
              <Input
                id="pay-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Tea round, Party drinks, Lunch order"
                autoFocus
              />
            </div>
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
