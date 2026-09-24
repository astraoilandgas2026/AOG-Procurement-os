import { NavProvider, useNav } from '@/context/NavContext';
import { AppShell } from '@/components/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DashboardPage } from '@/pages/DashboardPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { TechnicalPage } from '@/pages/TechnicalPage';
import { CommercialPage } from '@/pages/CommercialPage';
import { CertificationsPage } from '@/pages/CertificationsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DueDiligencePage } from '@/pages/DueDiligencePage';
import { LogisticsPage } from '@/pages/LogisticsPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { IntelligencePage } from '@/pages/IntelligencePage';
import type { PageKey } from '@/types';

const PAGES: Record<PageKey, React.ComponentType> = {dashboard:DashboardPage,suppliers:SuppliersPage,contacts:ContactsPage,products:ProductsPage,technical:TechnicalPage,commercial:CommercialPage,certifications:CertificationsPage,documents:DocumentsPage,due_diligence:DueDiligencePage,logistics:LogisticsPage,timeline:TimelinePage,follow_ups:FollowUpsPage,intelligence:IntelligencePage};
function PageRenderer(){const {currentPage}=useNav();const Page=PAGES[currentPage];return <Page/>;}
function ProtectedApp(){const {user,loading}=useAuth();if(loading)return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading…</div>;if(!user)return <LoginPage/>;return <NavProvider><AppShell><PageRenderer/></AppShell></NavProvider>;}
export default function App(){return <AuthProvider><ProtectedApp/></AuthProvider>;}
