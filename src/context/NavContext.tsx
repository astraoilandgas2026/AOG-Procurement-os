import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PageKey, ProcurementDomain } from '@/types';

interface NavigationState {
  currentPage: PageKey;
  selectedSupplierId: string | null;
  procurementDomain: ProcurementDomain | null;
}

interface NavContextValue extends NavigationState {
  navigate: (page: PageKey) => void;
  selectSupplier: (id: string | null) => void;
  selectDomain: (domain: ProcurementDomain) => void;
  goToOverview: () => void;
}

const NavContext = createContext<NavContextValue | null>(null);

const INITIAL_STATE: NavigationState = {
  currentPage: 'dashboard',
  selectedSupplierId: null,
  procurementDomain: null,
};

function readHistoryState(): NavigationState {
  const state = window.history.state?.astraProcurement as NavigationState | undefined;
  return state ?? INITIAL_STATE;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [navigation, setNavigation] = useState<NavigationState>(() => {
    if (typeof window === 'undefined') return INITIAL_STATE;
    return readHistoryState();
  });

  useEffect(() => {
    if (!window.history.state?.astraProcurement) {
      window.history.replaceState({ astraProcurement: navigation }, '');
    }

    const handlePopState = () => {
      setNavigation(readHistoryState());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const commitNavigation = (next: NavigationState) => {
    setNavigation(next);
    window.history.pushState({ astraProcurement: next }, '');
  };

  const navigate = (page: PageKey) => {
    commitNavigation({
      ...navigation,
      currentPage: page,
      selectedSupplierId: page === 'suppliers' ? null : navigation.selectedSupplierId,
    });
  };

  const selectSupplier = (id: string | null) => {
    commitNavigation({
      ...navigation,
      selectedSupplierId: id,
      currentPage: id ? 'suppliers' : navigation.currentPage,
    });
  };

  const selectDomain = (domain: ProcurementDomain) => {
    commitNavigation({
      currentPage: 'dashboard',
      selectedSupplierId: null,
      procurementDomain: domain,
    });
  };

  const goToOverview = () => {
    commitNavigation(INITIAL_STATE);
  };

  return (
    <NavContext.Provider value={{ ...navigation, navigate, selectSupplier, selectDomain, goToOverview }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
