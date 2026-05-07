'use client';

import { useEffect, useState } from 'react';
import { Member, Group } from '@/lib/types';
import { getNextFairPayer } from '@/lib/fairTurn';
import { getRandomPayer } from '@/lib/randomTurn';

interface CurrentTurnProps {
  group: Group;
  isRandomMode: boolean;
}

export function CurrentTurn({ group, isRandomMode }: CurrentTurnProps) {
  const [currentPayer, setCurrentPayer] = useState<Member | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const payer = isRandomMode ? getRandomPayer(group.members) : getNextFairPayer(group.members, group.paymentHistory);
    setCurrentPayer(payer);
    setShowCelebration(true);
    const timer = setTimeout(() => setShowCelebration(false), 2000);
    return () => clearTimeout(timer);
  }, [group, isRandomMode]);

  if (!currentPayer) {
    return (
      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No members in group yet</p>
      </div>
    );
  }

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
        <h2 className="text-5xl font-bold mb-2">{currentPayer.name}</h2>
        <p className="text-lg opacity-90">{isRandomMode ? "🎲 Random Selection" : "Fair Turn"}</p>
      </div>
    </div>
  );
}
