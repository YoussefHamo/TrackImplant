import type { AuthUser } from '../types';

export interface BranchScope {
  branchId: string | null;
  isAdmin: boolean;
}

export function getBranchScope(user: AuthUser | null): BranchScope {
  if (!user) return { branchId: null, isAdmin: false };
  if (user.role === 'Admin') return { branchId: null, isAdmin: true };
  return { branchId: user.branch_id || null, isAdmin: false };
}

export function canAccessBranch(user: AuthUser | null, branchId: string): boolean {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return user.branch_id === branchId;
}

export function isAdminUser(user: AuthUser | null): boolean {
  return user?.role === 'Admin';
}

export function isManagerUser(user: AuthUser | null): boolean {
  return user?.role === 'Manager';
}
