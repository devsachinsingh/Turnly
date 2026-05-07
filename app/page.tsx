'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';
import { UserSetup } from '@/components/UserSetup';
import { storage } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = storage.getUser();
    if (savedUser) {
      setUser(savedUser);
      router.push('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleUserSet = (newUser: User) => {
    storage.setUser(newUser);
    setUser(newUser);
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Turnly</h1>
          <p className="text-gray-600 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return <UserSetup onUserSet={handleUserSet} />;
}
