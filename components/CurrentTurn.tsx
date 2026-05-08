'use client';

import { useState, useEffect } from 'react';
import type { GroupDetail } from '@/lib/types';

interface CurrentTurnProps {
  group: GroupDetail;
  currentUserId: string;
}

export function CurrentTurn({ group, currentUserId }: CurrentTurnProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setIsRevealed(false);
    setShowCelebration(false);
  }, [group.nextPayer?.id]);

  const handleReveal = () => {
    setIsRevealed(true);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  };

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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-xl p-8 text-white text-center">
        <p className="text-lg font-semibold mb-3 opacity-90">It&apos;s Time to Pay!</p>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-6xl">{group.emoji}</span>
        </div>

        {isRevealed ? (
          <>
            <h2 className="text-5xl font-bold mb-2">
              {isYourTurn ? 'You!' : group.nextPayer.name}
            </h2>
            {isYourTurn && (
              <p className="text-lg opacity-80">({group.nextPayer.name})</p>
            )}
          </>
        ) : (
          <div className="cursor-pointer select-none" onClick={handleReveal}>
            <div
              className="text-5xl font-bold mb-2 transition-all duration-300"
              style={{ filter: 'blur(12px)' }}
            >
              {group.nextPayer.name}
            </div>
            <p className="text-sm opacity-80 mt-2">👆 Tap to reveal</p>
          </div>
        )}

        <p className="text-lg opacity-90 mt-3">
          {group.isRandomMode ? '🎲 Random Selection' : 'Fair Turn'}
        </p>
      </div>
    </div>
  );
}
