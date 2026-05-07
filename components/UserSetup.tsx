'use client';

import { useState } from 'react';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UserSetupProps {
  onUserSet: (user: User) => void;
}

export function UserSetup({ onUserSet }: UserSetupProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }

    const user: User = {
      id: `user_${Date.now()}`,
      name: trimmedName,
    };

    onUserSet(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Turnly</h1>
            <p className="text-xl text-gray-600">Who&apos;s paying next?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="John Doe"
                className="w-full"
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg">
              Let&apos;s Go
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Create or join a group to get started
          </p>
        </div>
      </div>
    </div>
  );
}
