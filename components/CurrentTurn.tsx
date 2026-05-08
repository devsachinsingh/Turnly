'use client';

import { useState, useEffect } from 'react';
import type { GroupDetail } from '@/lib/types';

interface CurrentTurnProps {
  group: GroupDetail;
  currentUserId: string;
}

export function CurrentTurn({ group, currentUserId }: CurrentTurnProps) {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setShowCelebration(true);
    const timer = setTimeout(() => setShowCelebration(false), 2000);
    return () => clearTimeout(timer);
  }, [group.nextPayer?.id]);

  if (!group.nextPayer) {
    return (
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No members in group yet</p>
      </div>
    );
  }

  const isYourTurn = group.nextPayer.id === currentUserId;

  return (
    <div className="relative">
      {showCelebration && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white text-center">
        <p className="text-lg font-semibold mb-3 opacity-90">It&apos;s Time to Pay!</p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-6xl">{group.emoji}</span>
        </div>
        <h2 className="text-5xl font-bold mb-2">
          {isYourTurn ? 'You!' : group.nextPayer.name}
        </h2>
        {isYourTurn && (
          <p className="text-lg opacity-80">({group.nextPayer.name})</p>
        )}
        <p className="text-lg opacity-90 mt-2">
          {group.isRandomMode ? '🎲 Random Selection' : 'Fair Turn'}
        </p>
      </div>
    </div>
  );
}
