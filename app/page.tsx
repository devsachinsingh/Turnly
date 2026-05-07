'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/lib/types';
import { UserSetup } from '@/components/UserSetup';
import { storage } from '@/lib/storage';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user exists in localStorage on mount
    try {
      const savedUser = storage.getUser();
      if (savedUser) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }, [router]);

  const handleUserSet = (newUser: User) => {
    try {
      storage.setUser(newUser);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error setting user:', error);
    }
  };

  return <UserSetup onUserSet={handleUserSet} />;
}
