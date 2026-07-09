import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { branchService } from '../services/branchService';
import type { Branch } from '../types';

interface BranchContextType {
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  availableBranches: Branch[];
  branchLoading: boolean;
  isBranchRequired: boolean;
  currentBranchName: string;
}

const BranchContext = createContext<BranchContextType>({
  activeBranchId: null,
  setActiveBranchId: () => {},
  availableBranches: [],
  branchLoading: true,
  isBranchRequired: false,
  currentBranchName: '',
});

const STORAGE_KEY = 'trackimplant_active_branch';

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const isAdmin = user?.role === 'Admin';

  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() => {
    if (!isAdmin && user?.branch_id) return user.branch_id;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || null;
  });

  const setActiveBranchId = useCallback((id: string | null) => {
    setActiveBranchIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Load branches
  useEffect(() => {
    branchService.getAll()
      .then(branches => {
        setAvailableBranches(branches);
        // For Admin: if no active branch and branches exist, set first
        if (isAdmin && !activeBranchId && branches.length > 0) {
          setActiveBranchId(branches[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setBranchLoading(false));
  }, []);

  // For non-admin users, always follow their user.branch_id
  useEffect(() => {
    if (!isAdmin && user?.branch_id) {
      setActiveBranchIdState(user.branch_id);
    }
  }, [isAdmin, user?.branch_id]);

  const isBranchRequired = isAdmin;
  const currentBranchName = availableBranches.find(b => b.id === activeBranchId)?.name || '';

  return (
    <BranchContext.Provider value={{
      activeBranchId,
      setActiveBranchId,
      availableBranches,
      branchLoading,
      isBranchRequired,
      currentBranchName,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
