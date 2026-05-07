'use client';

import { Group } from '@/lib/types';

interface RandomModeToggleProps {
  group: Group;
  onToggle: (updatedGroup: Group) => void;
}

export function RandomModeToggle({ group, onToggle }: RandomModeToggleProps) {
  const handleToggle = () => {
    const updatedGroup = {
      ...group,
      isRandomMode: !group.isRandomMode,
    };
    onToggle(updatedGroup);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-900">
          {group.isRandomMode ? '🎲 Random Mode' : '⚖️ Fair Mode'}
        </p>
        <p className="text-sm text-gray-600">
          {group.isRandomMode ? 'Anyone can pay next' : 'Fair turn based on history'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
          group.isRandomMode ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
            group.isRandomMode ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
