'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Group } from '@/lib/types';
import { storage } from '@/lib/storage';
import { GroupCreator } from '@/components/GroupCreator';
import { GroupJoiner } from '@/components/GroupJoiner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = storage.getUser();
    if (!savedUser) {
      router.push('/');
      return;
    }
    setUser(savedUser);
    const userGroups = storage.getGroups().filter((g) => g.members.some((m) => m.id === savedUser.id));
    setGroups(userGroups);
    setIsLoading(false);
  }, [router]);

  const handleGroupCreated = (newGroup: Group) => {
    // Add current user as first member
    if (user) {
      newGroup.members.push({
        id: user.id,
        name: user.name,
        joinedDate: new Date().toISOString(),
      });
    }
    storage.addGroup(newGroup);
    setGroups([...groups, newGroup]);
    setShowCreate(false);
  };

  const handleGroupJoined = (joinedGroup: Group) => {
    const updatedGroups = groups.map((g) => (g.id === joinedGroup.id ? joinedGroup : g));
    if (!updatedGroups.find((g) => g.id === joinedGroup.id)) {
      updatedGroups.push(joinedGroup);
    }
    setGroups(updatedGroups);
    setShowJoin(false);
  };

  const handleLogout = () => {
    storage.clearUser();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Turnly</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Button
            onClick={() => setShowCreate(true)}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          >
            + Create Group
          </Button>
          <Button
            onClick={() => setShowJoin(true)}
            variant="outline"
            size="lg"
          >
            Join Group
          </Button>
        </div>

        {/* Modals */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <GroupCreator onGroupCreated={handleGroupCreated} />
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {showJoin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                {user && <GroupJoiner currentUser={user} onGroupJoined={handleGroupJoined} />}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowJoin(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Groups Grid */}
        {groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl font-semibold text-gray-900 mb-2">No groups yet</p>
            <p className="text-gray-600 mb-8">Create a new group or join an existing one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link key={group.id} href={`/group/${group.id}`}>
                <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow p-6 cursor-pointer h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{group.emoji}</span>
                    <h3 className="text-xl font-bold text-gray-900 flex-1">{group.name}</h3>
                  </div>
                  {group.description && (
                    <p className="text-gray-600 text-sm mb-4">{group.description}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                    <span>{group.paymentHistory.length} payment{group.paymentHistory.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
