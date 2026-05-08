'use client';

import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GroupSummary } from '@/lib/types';
import { GroupCreator } from '@/components/GroupCreator';
import { GroupJoiner } from '@/components/GroupJoiner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Redirect to onboarding if user has no display name yet.
  useEffect(() => {
    if (session && !session.user?.name) {
      router.replace('/onboarding');
    }
  }, [session, router]);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, []);

  const refreshGroups = () =>
    fetch('/api/groups')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {});

  const handleGroupCreated = (newGroup: GroupSummary) => {
    setGroups((prev) => [newGroup, ...prev]);
    setShowCreate(false);
  };

  const handleGroupJoined = () => {
    refreshGroups();
    setShowJoin(false);
  };

  const displayName = session?.user?.name || session?.user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Turnly</h1>
            <p className="text-sm text-gray-600">Welcome, {displayName}</p>
          </div>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: '/' })}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button onClick={() => setShowCreate(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
            + Create Group
          </Button>
          <Button onClick={() => setShowJoin(true)} variant="outline" size="lg">
            Join Group
          </Button>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create a Group</DialogTitle>
            </DialogHeader>
            <GroupCreator onGroupCreated={handleGroupCreated} />
          </DialogContent>
        </Dialog>

        <Dialog open={showJoin} onOpenChange={setShowJoin}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Group</DialogTitle>
            </DialogHeader>
            <GroupJoiner onGroupJoined={handleGroupJoined} />
          </DialogContent>
        </Dialog>

        {loadingGroups ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl font-semibold text-gray-900 mb-2">No groups yet</p>
            <p className="text-gray-600 mb-8">Create a new group or join an existing one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => router.push(`/group/${group.id}`)}
                className="relative bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 cursor-pointer h-full text-left hover:bg-gray-50"
              >
                {group.pendingCount > 0 && (
                  <div
                    className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
                    title={`${group.pendingCount} payment${group.pendingCount !== 1 ? 's' : ''} need your approval`}
                  >
                    {group.pendingCount}
                  </div>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{group.emoji}</span>
                  <h3 className="text-xl font-bold text-gray-900 flex-1">{group.name}</h3>
                </div>
                {group.description && (
                  <p className="text-gray-600 text-sm mb-4">{group.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</span>
                  <span>{group.paymentCount} payment{group.paymentCount !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
