import { NavProvider, useNav } from '@/context/NavContext';
import { AppShell } from '@/components/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CommercialPage } from '@/pages/CommercialPage';
import { CertificationsPage } from '@/pages/CertificationsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DueDiligencePage } from '@/pages/DueDiligencePage';
import { LogisticsPage } from '@/pages/LogisticsPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { IntelligencePage } from '@/pages/IntelligencePage';
import type { ComponentType } from 'react';
import type { PageKey } from '@/types';

const PAGES: Record<PageKey, ComponentType> = {
  dashboard: DashboardPage,
  suppliers: SuppliersPage,
  contacts: ContactsPage,
  products: ProductsPage,
  commercial: CommercialPage,
  certifications: CertificationsPage,
  documents: DocumentsPage,
  due_diligence: DueDiligencePage,
  logistics: LogisticsPage,
  timeline: TimelinePage,
  follow_ups: FollowUpsPage,
  intelligence: IntelligencePage,
};

function PageRenderer() {
  const { currentPage } = useNav();
  const Page = PAGES[currentPage];
  return <Page />;
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
