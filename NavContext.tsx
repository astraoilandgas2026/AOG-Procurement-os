import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PageKey } from '@/types';

interface NavContextValue {
  currentPage: PageKey;
  selectedSupplierId: string | null;
  navigate: (page: PageKey) => void;
  selectSupplier: (id: string | null) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const navigate = (page: PageKey) => {
    setCurrentPage(page);
    if (page === 'suppliers') {
      setSelectedSupplierId(null);
    }
  };

  const selectSupplier = (id: string | null) => {
    setSelectedSupplierId(id);
    if (id) {
      setCurrentPage('suppliers');
    }
  };

  return (
    <NavContext.Provider value={{ currentPage, selectedSupplierId, navigate, selectSupplier }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
