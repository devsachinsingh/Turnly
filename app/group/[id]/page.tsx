'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { GroupDetail } from '@/lib/types';
import { CurrentTurn } from '@/components/CurrentTurn';
import { GroupInfo } from '@/components/GroupInfo';
import { MembersList } from '@/components/MembersList';
import { PaymentHistory } from '@/components/PaymentHistory';
import { MarkAsPaidButton } from '@/components/MarkAsPaidButton';
import { RandomModeToggle } from '@/components/RandomModeToggle';
import { PendingApprovals } from '@/components/PendingApprovals';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUserId = session?.user?.id ?? '';

  useEffect(() => {
    fetch(`/api/groups/${id}`)
      .then((r) => {
        if (!r.ok) { router.push('/dashboard'); return null; }
        return r.json();
      })
      .then((data) => data && setGroup(data))
      .catch(() => router.push('/dashboard'));
  }, [id, router]);

  const handleToggleRandomMode = async () => {
    if (!group) return;
    const res = await fetch(`/api/groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRandomMode: !group.isRandomMode }),
    });
    if (res.ok) setGroup(await res.json());
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!group) return;
    await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
    router.push('/dashboard');
  };

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-semibold">
            ← Back to Groups
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <CurrentTurn group={group} currentUserId={currentUserId} />
            <PendingApprovals group={group} currentUserId={currentUserId} onUpdate={setGroup} />
            <MarkAsPaidButton group={group} currentUserId={currentUserId} onPaymentMarked={setGroup} />
            <RandomModeToggle group={group} onToggle={handleToggleRandomMode} />
            <PaymentHistory history={group.paymentHistory} />
          </div>

          <div className="space-y-6">
            <GroupInfo group={group} onCopyCode={handleCopyCode} />
            {copied && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                Code copied to clipboard!
              </div>
            )}
            <MembersList members={group.members} paymentHistory={group.paymentHistory} />
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLeave}
            >
              Leave Group
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
