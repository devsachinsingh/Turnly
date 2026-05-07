'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Group, User } from '@/lib/types';
import { storage } from '@/lib/storage';
import { CurrentTurn } from '@/components/CurrentTurn';
import { GroupInfo } from '@/components/GroupInfo';
import { MembersList } from '@/components/MembersList';
import { PaymentHistory } from '@/components/PaymentHistory';
import { MarkAsPaidButton } from '@/components/MarkAsPaidButton';
import { RandomModeToggle } from '@/components/RandomModeToggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const savedUser = storage.getUser();
      if (!savedUser) {
        router.push('/');
        return;
      }

      const savedGroup = storage.getGroup(groupId);
      if (!savedGroup) {
        router.push('/dashboard');
        return;
      }

      setUser(savedUser);
      setGroup(savedGroup);
      setIsRandomMode(savedGroup.isRandomMode || false);
    } catch (error) {
      console.error('Error loading group:', error);
      router.push('/dashboard');
    }
  }, [groupId, router]);

  const handlePaymentMarked = (updatedGroup: Group) => {
    storage.updateGroup(updatedGroup);
    setGroup(updatedGroup);
  };

  const handleToggleRandomMode = (updatedGroup: Group) => {
    storage.updateGroup(updatedGroup);
    setGroup(updatedGroup);
    setIsRandomMode(updatedGroup.isRandomMode || false);
  };

  const handleCopyCode = () => {
    if (group) {
      navigator.clipboard.writeText(group.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!group || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Group not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Groups
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Feature */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Turn */}
            <CurrentTurn group={group} isRandomMode={isRandomMode} />

            {/* Mark as Paid Button */}
            <MarkAsPaidButton group={group} onPaymentMarked={handlePaymentMarked} />

            {/* Mode Toggle */}
            <RandomModeToggle group={group} onToggle={handleToggleRandomMode} />

            {/* Payment History */}
            <PaymentHistory history={group.paymentHistory} />
          </div>

          {/* Right Column - Info Sidebar */}
          <div className="space-y-6">
            {/* Group Info */}
            <GroupInfo group={group} onCopyCode={handleCopyCode} />

            {/* Feedback */}
            {copied && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                Code copied to clipboard!
              </div>
            )}

            {/* Members List */}
            <MembersList members={group.members} paymentHistory={group.paymentHistory} />

            {/* Leave Group */}
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                // Remove user from group
                const updatedGroup = {
                  ...group,
                  members: group.members.filter((m) => m.id !== user.id),
                };
                storage.updateGroup(updatedGroup);
                router.push('/dashboard');
              }}
            >
              Leave Group
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
