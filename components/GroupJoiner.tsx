'use client';

import { useState } from 'react';
import { User, Group, Member } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateGroupCode } from '@/lib/codeGenerator';
import { storage } from '@/lib/storage';

interface GroupJoinerProps {
  currentUser: User;
  onGroupJoined: (group: Group) => void;
}

export function GroupJoiner({ currentUser, onGroupJoined }: GroupJoinerProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.toUpperCase().trim();

    if (!validateGroupCode(trimmedCode)) {
      setError('Invalid group code. Use the 6-character code.');
      return;
    }

    const group = storage.findGroupByCode(trimmedCode);

    if (!group) {
      setError('Group not found. Check the code and try again.');
      return;
    }

    // Check if user is already a member
    if (group.members.some((m) => m.id === currentUser.id)) {
      setError('You are already a member of this group!');
      return;
    }

    // Add user to group
    const newMember: Member = {
      id: currentUser.id,
      name: currentUser.name,
      joinedDate: new Date().toISOString(),
    };

    group.members.push(newMember);
    storage.updateGroup(group);

    onGroupJoined(group);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Join a Group</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
            Group Code
          </label>
          <Input
            id="code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="ABC123"
            maxLength={6}
            className="text-center text-lg font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">Ask your group admin for the code</p>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" className="w-full" size="lg">
          Join Group
        </Button>
      </form>
    </div>
  );
}
