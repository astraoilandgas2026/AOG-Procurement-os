import { type ReactNode } from 'react';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import type { PageKey } from '@/types';
import {
  LayoutDashboard, Building2, Users, Package, FlaskConical, DollarSign, Award, FileText,
  ShieldCheck, Truck, Clock, CheckSquare, Network, Droplets, Fuel, ChevronLeft, LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem { key: PageKey; label: string; icon: ReactNode; group: string; }

const NAV_ITEMS: NavItem[] = [
  { key: 'suppliers', label: 'Suppliers', icon: <Building2 size={17} />, group: 'Intelligence' },
  { key: 'contacts', label: 'Contacts', icon: <Users size={17} />, group: 'Intelligence' },
  { key: 'products', label: 'Products', icon: <Package size={17} />, group: 'Intelligence' },
  { key: 'technical', label: 'Technical', icon: <FlaskConical size={17} />, group: 'Intelligence' },
  { key: 'commercial', label: 'Commercial', icon: <DollarSign size={17} />, group: 'Intelligence' },
  { key: 'certifications', label: 'Certifications', icon: <Award size={17} />, group: 'Intelligence' },
  { key: 'documents', label: 'Documents', icon: <FileText size={17} />, group: 'Intelligence' },
  { key: 'due_diligence', label: 'Due Diligence', icon: <ShieldCheck size={17} />, group: 'Intelligence' },
  { key: 'logistics', label: 'Logistics', icon: <Truck size={17} />, group: 'Intelligence' },
  { key: 'timeline', label: 'Timeline', icon: <Clock size={17} />, group: 'Activity' },
  { key: 'follow_ups', label: 'Follow-ups', icon: <CheckSquare size={17} />, group: 'Activity' },
  { key: 'intelligence', label: 'Intelligence Map', icon: <Network size={17} />, group: 'Activity' },
];

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'Procurement intelligence overview' },
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

const DOMAIN_META: Record<ProcurementDomain, { label: string; icon: ReactNode }> = {
  feedstock: { label: 'Feedstock', icon: <Droplets size={16} /> },
  energy_commodities: { label: 'Energy Commodities', icon: <Fuel size={16} /> },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate, procurementDomain, selectDomain } = useNav();
  const { signOut } = useAuth();
  const pageInfo = PAGE_TITLES[currentPage];
  const groups = ['Intelligence', 'Activity'];

  return (
    <div className="flex h-screen bg-[var(--astra-surface)]">
      <aside className="flex w-64 flex-shrink-0 flex-col bg-[var(--astra-navy)] text-slate-300">
        <div className="border-b border-white/10 px-5 py-5">
          <button onClick={() => { selectDomain(procurementDomain ?? 'feedstock'); navigate('dashboard'); }} className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--astra-orange)] text-white shadow-sm">
              <span className="text-lg font-black">A</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">ASTRA OIL AND GAS</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Procurement OS</div>
            </div>
          </button>
        </div>

        {procurementDomain && (
          <nav className="flex-1 overflow-y-auto py-4">
            <button onClick={() => { selectDomain(procurementDomain); navigate('dashboard'); }} className="mb-4 flex w-full items-center gap-2 px-5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white">
              <ChevronLeft size={15} /> Overview
            </button>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group}</div>
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
                  <button key={item.key} onClick={() => navigate(item.key)} className={`w-full flex items-center gap-3 border-l-2 px-5 py-2.5 text-sm transition-colors ${currentPage === item.key ? 'border-[var(--astra-orange)] bg-white/10 text-white' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}

        <div className="border-t border-white/10 px-5 py-4">
          {procurementDomain && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
              {DOMAIN_META[procurementDomain].icon}<span>{DOMAIN_META[procurementDomain].label}</span>
            </div>
          )}
          <button onClick={() => void signOut()} className="flex items-center gap-2 text-xs text-slate-500 hover:text-white"><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--astra-navy)]">{pageInfo.title}</h1>
            <p className="text-sm text-slate-500">{pageInfo.subtitle}</p>
          </div>
          {procurementDomain && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {DOMAIN_META[procurementDomain].icon}{DOMAIN_META[procurementDomain].label}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
