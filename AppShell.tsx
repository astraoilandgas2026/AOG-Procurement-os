import { type ReactNode } from 'react';
import { useNav } from '@/context/NavContext';
import type { PageKey } from '@/types';
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  FlaskConical,
  DollarSign,
  Award,
  FileText,
  ShieldCheck,
  Truck,
  Clock,
  CheckSquare,
  Network,
  Fuel,
} from 'lucide-react';

interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, group: 'Overview' },
  { key: 'suppliers', label: 'Suppliers', icon: <Building2 size={18} />, group: 'Intelligence' },
  { key: 'contacts', label: 'Contacts', icon: <Users size={18} />, group: 'Intelligence' },
  { key: 'products', label: 'Products', icon: <Package size={18} />, group: 'Intelligence' },
  { key: 'technical', label: 'Technical', icon: <FlaskConical size={18} />, group: 'Intelligence' },
  { key: 'commercial', label: 'Commercial', icon: <DollarSign size={18} />, group: 'Intelligence' },
  { key: 'certifications', label: 'Certifications', icon: <Award size={18} />, group: 'Intelligence' },
  { key: 'documents', label: 'Documents', icon: <FileText size={18} />, group: 'Intelligence' },
  { key: 'due_diligence', label: 'Due Diligence', icon: <ShieldCheck size={18} />, group: 'Intelligence' },
  { key: 'logistics', label: 'Logistics', icon: <Truck size={18} />, group: 'Intelligence' },
  { key: 'timeline', label: 'Timeline', icon: <Clock size={18} />, group: 'Activity' },
  { key: 'follow_ups', label: 'Follow-ups', icon: <CheckSquare size={18} />, group: 'Activity' },
  { key: 'intelligence', label: 'Intelligence Map', icon: <Network size={18} />, group: 'Activity' },
];

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Procurement intelligence overview' },
  suppliers: { title: 'Suppliers', subtitle: 'Supplier intelligence profiles' },
  contacts: { title: 'Contacts', subtitle: 'Supplier contact directory' },
  products: { title: 'Products', subtitle: 'Feedstock and product registry' },
  technical: { title: 'Technical', subtitle: 'Technical specifications and quality parameters' },
  commercial: { title: 'Commercial', subtitle: 'Commercial offers and pricing' },
  certifications: { title: 'Certifications', subtitle: 'Certification tracking and evidence' },
  documents: { title: 'Documents', subtitle: 'Evidence and document management' },
  due_diligence: { title: 'Due Diligence', subtitle: 'Verification and risk assessment' },
  logistics: { title: 'Logistics', subtitle: 'Export and logistics readiness' },
  timeline: { title: 'Timeline', subtitle: 'Supplier interaction history' },
  follow_ups: { title: 'Follow-ups', subtitle: 'Action items and next steps' },
  intelligence: { title: 'Intelligence Map', subtitle: 'Mental map and relationship overview' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate } = useNav();
  const groups = [...new Set(NAV_ITEMS.map((i) => i.group))];
  const pageInfo = PAGE_TITLES[currentPage];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Fuel size={20} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">ASTRA</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Procurement OS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {groups.map((group) => (
            <div key={group} className="mb-1">
              <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group}
              </div>
              {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  className={`w-full flex items-center gap-3 px-5 py-2 text-sm transition-colors ${
                    currentPage === item.key
                      ? 'bg-slate-800 text-white border-l-2 border-emerald-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border-l-2 border-transparent'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-500">
            Internal — Astra Oil and Gas
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            Procurement Intelligence OS
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">{pageInfo.title}</h1>
          <p className="text-sm text-gray-500">{pageInfo.subtitle}</p>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
