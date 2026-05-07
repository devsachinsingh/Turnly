'use client';

import { useState } from 'react';
import { Group } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateGroupCode } from '@/lib/codeGenerator';

interface GroupCreatorProps {
  onGroupCreated: (group: Group) => void;
}

const EMOJI_OPTIONS = ['☕', '🍕', '🍜', '🍺', '🎉', '🥘', '🍔', '🍱', '🍰', '🥗', '🌮', '🍛'];

export function GroupCreator({ onGroupCreated }: GroupCreatorProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('☕');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setError('Please enter a group name');
      return;
    }

    const newGroup: Group = {
      id: `group_${Date.now()}`,
      name: trimmedName,
      description: description.trim(),
      emoji: selectedEmoji,
      code: generateGroupCode(),
      members: [],
      paymentHistory: [],
      createdAt: new Date().toISOString(),
      isRandomMode: false,
    };

    onGroupCreated(newGroup);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create a Group</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
            Group Name *
          </label>
          <Input
            id="groupName"
            type="text"
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value);
              setError('');
            }}
            placeholder="Office Tea Gang"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <Input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group for?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Choose an Emoji</label>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                className={`p-3 text-2xl rounded-lg border-2 transition-all ${
                  selectedEmoji === emoji ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" className="w-full" size="lg">
          Create Group
        </Button>
      </form>
    </div>
  );
}
