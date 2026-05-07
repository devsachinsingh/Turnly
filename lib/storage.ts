import { User, Group } from './types';

const USER_KEY = 'turnly_user';
const GROUPS_KEY = 'turnly_groups';

export const storage = {
  // User operations
  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
  },

  // Group operations
  getGroups(): Group[] {
    if (typeof window === 'undefined') return [];
    const groups = localStorage.getItem(GROUPS_KEY);
    return groups ? JSON.parse(groups) : [];
  },

  getGroup(id: string): Group | null {
    const groups = this.getGroups();
    return groups.find((g) => g.id === id) || null;
  },

  addGroup(group: Group): void {
    if (typeof window === 'undefined') return;
    const groups = this.getGroups();
    groups.push(group);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  },

  updateGroup(updatedGroup: Group): void {
    if (typeof window === 'undefined') return;
    const groups = this.getGroups();
    const index = groups.findIndex((g) => g.id === updatedGroup.id);
    if (index !== -1) {
      groups[index] = updatedGroup;
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }
  },

  deleteGroup(id: string): void {
    if (typeof window === 'undefined') return;
    const groups = this.getGroups();
    const filtered = groups.filter((g) => g.id !== id);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(filtered));
  },

  findGroupByCode(code: string): Group | null {
    const groups = this.getGroups();
    return groups.find((g) => g.code.toUpperCase() === code.toUpperCase()) || null;
  },
};
