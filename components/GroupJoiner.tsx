'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateGroupCode } from '@/lib/codeGenerator';

interface GroupJoinerProps {
  onGroupJoined: () => void;
}

export function GroupJoiner({ onGroupJoined }: GroupJoinerProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.toUpperCase().trim();

    if (!validateGroupCode(trimmed)) {
      setError('Invalid group code. Use the 6-character code.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    onGroupJoined();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
          Group Code
        </label>
        <Input
          id="code"
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          placeholder="ABC123"
          maxLength={6}
          className="text-center text-lg font-mono"
        />
        <p className="text-xs text-gray-500 mt-1">Ask your group admin for the code</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Joining…' : 'Join Group'}
      </Button>
    </form>
  );
}
