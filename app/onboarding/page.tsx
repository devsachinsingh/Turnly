'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Onboarding() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.name) router.push('/dashboard');
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your display name');
      return;
    }
    if (trimmed.length > 50) {
      setError('Name must be 50 characters or less');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!res.ok) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    await update({ name: trimmed });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Turnly!</h1>
            <p className="text-gray-600">What should we call you?</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Display name
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
                maxLength={50}
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Saving…' : "Let's Go"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
