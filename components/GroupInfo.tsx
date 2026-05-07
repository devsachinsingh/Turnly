'use client';

import type { GroupDetail } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface GroupInfoProps {
  group: GroupDetail;
  onCopyCode: () => void;
}

export function GroupInfo({ group, onCopyCode }: GroupInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{group.emoji}</span>
            <h3 className="text-2xl font-bold text-gray-900">{group.name}</h3>
          </div>
          {group.description && <p className="text-gray-600 mb-4">{group.description}</p>}
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Members:</span> {group.members.length}
            </p>
            <p className="text-sm text-gray-500">
              <span className="font-semibold">Total Payments:</span> {group.paymentHistory.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t">
        <p className="text-sm text-gray-600 mb-2">Share this code with your group:</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-lg p-3 text-center">
            <p className="font-mono text-2xl font-bold text-gray-900 tracking-wider">{group.code}</p>
          </div>
          <Button onClick={onCopyCode} variant="outline" size="sm">
            Copy
          </Button>
        </div>
      </div>
    </div>
  );
}
