'use client';

import { useState } from 'react';
import type { GroupSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GroupCreatorProps {
  onGroupCreated: (group: GroupSummary) => void;
}

const EMOJI_OPTIONS = ['☕', '🍕', '🍜', '🍺', '🎉', '🥘', '🍔', '🍱', '🍰', '🥗', '🌮', '🍛'];

export function GroupCreator({ onGroupCreated }: GroupCreatorProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('☕');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = groupName.trim();
    if (!name) {
      setError('Please enter a group name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description.trim(), emoji: selectedEmoji }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
        setLoading(false);
        return;
      }

      const newGroup = await res.json();
      // Ensure the group object has all required GroupSummary fields
      const groupSummary: GroupSummary = {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        emoji: newGroup.emoji,
        code: newGroup.code,
        isRandomMode: newGroup.isRandomMode ?? false,
        createdAt: newGroup.createdAt ?? new Date().toISOString(),
        memberCount: newGroup.memberCount ?? 1,
        paymentCount: newGroup.paymentCount ?? 0,
        pendingCount: newGroup.pendingCount ?? 0,
      };
      onGroupCreated(groupSummary);
    } catch (err) {
      setError('Failed to create group');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
          Group Name *
        </label>
        <Input
          id="groupName"
          type="text"
          value={groupName}
          onChange={(e) => { setGroupName(e.target.value); setError(''); }}
          placeholder="Office Tea Gang"
          maxLength={100}
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
          maxLength={200}
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

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Creating…' : 'Create Group'}
      </Button>
    </form>
  );
}
