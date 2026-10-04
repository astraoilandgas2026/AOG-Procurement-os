import { NavProvider, useNav } from '@/context/NavContext';
import { AppShell } from '@/components/AppShell';
import { lazy, Suspense, type ComponentType } from 'react';
import type { PageKey } from '@/types';

const PAGES: Record<PageKey, ComponentType> = {
  dashboard: lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))),
  suppliers: lazy(() => import('@/pages/SuppliersPage').then(m => ({ default: m.SuppliersPage }))),
  contacts: lazy(() => import('@/pages/ContactsPage').then(m => ({ default: m.ContactsPage }))),
  products: lazy(() => import('@/pages/ProductsPage').then(m => ({ default: m.ProductsPage }))),
  commercial: lazy(() => import('@/pages/CommercialPage').then(m => ({ default: m.CommercialPage }))),
  certifications: lazy(() => import('@/pages/CertificationsPage').then(m => ({ default: m.CertificationsPage }))),
  documents: lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage }))),
  due_diligence: lazy(() => import('@/pages/DueDiligencePage').then(m => ({ default: m.DueDiligencePage }))),
  logistics: lazy(() => import('@/pages/LogisticsPage').then(m => ({ default: m.LogisticsPage }))),
  timeline: lazy(() => import('@/pages/TimelinePage').then(m => ({ default: m.TimelinePage }))),
  follow_ups: lazy(() => import('@/pages/FollowUpsPage').then(m => ({ default: m.FollowUpsPage }))),
  intelligence: lazy(() => import('@/pages/IntelligencePage').then(m => ({ default: m.IntelligencePage }))),
};

function PageRenderer() {
  const { currentPage } = useNav();
  const Page = PAGES[currentPage];
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Cargando…</div>}>
      <Page />
    </Suspense>
  );
}

export default function App() {
  return (
    <NavProvider>
      <AppShell>
        <PageRenderer />
      </AppShell>
    </NavProvider>
  );
}
