import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import {
  Building2,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
  Package,
  FileText,
  TrendingUp,
  Clock,
  Droplets,
  Fuel,
  ArrowRight,
} from 'lucide-react';
import type { AppData } from '@/types';

const DOMAIN_CONTENT: Record<Exclude<ProcurementDomain, never>, {
  title: string;
  description: string;
  icon: typeof Droplets;
  products: string;
}> = {
  feedstock: {
    title: 'Feedstock',
    description: 'Sourcing intelligence for biodiesel and biofuel feedstocks across LATAM.',
    icon: Droplets,
    products: 'UCO / AVU · vegetable oils · degummed · off-spec · oleins · fatty acids · acid oils · soapstock · industrial returns · oilseed residues',
  },
  energy_commodities: {
    title: 'Energy Commodities',
    description: 'Trading intelligence for conventional energy commodities and physical supply.',
    icon: Fuel,
    products: 'Gas · fuel oil · petcoke · diesel · crude oil · other energy commodities',
  },
};

export function DashboardPage() {
  const { navigate, procurementDomain, selectDomain } = useNav();
  const { data, loading, error } = useAsync<AppData>(() => getStore().getAll(), []);

  if (!procurementDomain) {
    return (
      <div className="space-y-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--astra-orange)]">Procurement Intelligence OS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--astra-navy)]">Select your business domain</h2>
          <p className="mt-2 text-sm text-slate-500">Choose the sourcing universe you want to work with. The intelligence workspace will adapt to the selected domain.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
          {(Object.keys(DOMAIN_CONTENT) as ProcurementDomain[]).map((key) => {
            const domain = DOMAIN_CONTENT[key];
            const Icon = domain.icon;
            return (
              <button key={key} onClick={() => selectDomain(key)} className="group text-left">
                <Card className="h-full border-slate-200 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--astra-orange)] group-hover:shadow-lg">
                  <CardBody className="p-7">
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astra-orange-soft)] text-[var(--astra-orange-dark)]">
                        <Icon size={25} />
                      </div>
                      <ArrowRight size={20} className="mt-1 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[var(--astra-orange)]" />
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-[var(--astra-navy)]">{domain.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{domain.description}</p>
                    <div className="mt-5 rounded-lg bg-slate-50 p-4 text-xs leading-5 text-slate-600">{domain.products}</div>
                  </CardBody>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const totalSuppliers = data.suppliers.length;
  const activeSuppliers = data.suppliers.filter((s) => s.lifecycle === 'active').length;
  const ddPending = data.suppliers.filter((s) => s.lifecycle === 'dd_pending').length;
  const qualified = data.suppliers.filter((s) => s.lifecycle === 'qualified').length;
  const trial = data.suppliers.filter((s) => s.lifecycle === 'trial').length;
  const recurring = data.suppliers.filter((s) => s.lifecycle === 'recurring').length;
  const pausedRejectedArchived = data.suppliers.filter((s) => ['paused', 'rejected', 'archived'].includes(s.lifecycle)).length;
  const followUpsDue = data.follow_ups.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const openRedFlags = data.red_flags.filter((r) => r.status === 'open' || r.status === 'investigating').length;
  const totalProducts = data.products.length;
  const totalDocuments = data.documents.length;
  const isEmpty = totalSuppliers === 0 && totalProducts === 0 && totalDocuments === 0;

  const metrics = [
    { label: 'Total Suppliers', value: totalSuppliers, icon: <Building2 size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Active', value: activeSuppliers, icon: <TrendingUp size={20} />, onClick: () => navigate('suppliers') },
    { label: 'DD Pending', value: ddPending, icon: <ShieldCheck size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Qualified', value: qualified, icon: <ShieldCheck size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Trial', value: trial, icon: <Package size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Recurring', value: recurring, icon: <TrendingUp size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Paused / Rejected / Archived', value: pausedRejectedArchived, icon: <Building2 size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Follow-ups Due', value: followUpsDue, icon: <CheckSquare size={20} />, onClick: () => navigate('follow_ups') },
    { label: 'Open Red Flags', value: openRedFlags, icon: <AlertTriangle size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Products / Feedstocks', value: totalProducts, icon: <Package size={20} />, onClick: () => navigate('products') },
    { label: 'Documents', value: totalDocuments, icon: <FileText size={20} />, onClick: () => navigate('documents') },
    { label: 'Timeline Events', value: data.timeline.length, icon: <Clock size={20} />, onClick: () => navigate('timeline') },
  ];

  if (isEmpty) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 size={28} />}
          title="No procurement intelligence yet"
          message="Start by registering your first supplier. The dashboard will populate with metrics as you add suppliers, products, commercial offers, and due diligence records."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--astra-orange)]">{DOMAIN_CONTENT[procurementDomain].title}</p>
        <p className="mt-1 text-sm text-slate-500">{DOMAIN_CONTENT[procurementDomain].description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <button key={m.label} onClick={m.onClick} className="text-left">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-[var(--astra-navy)]">{m.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{m.label}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--astra-orange-soft)] text-[var(--astra-orange-dark)]">{m.icon}</div>
                </div>
              </CardBody>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold text-[var(--astra-navy)]">Action Required</h3>
            {followUpsDue === 0 && openRedFlags === 0 ? (
              <p className="text-sm text-slate-500">No outstanding actions or open red flags.</p>
            ) : (
              <ul className="space-y-2">
                {followUpsDue > 0 && <li className="flex items-center gap-2 text-sm text-slate-700"><CheckSquare size={16} className="text-[var(--astra-orange)]" />{followUpsDue} follow-up(s) require attention</li>}
                {openRedFlags > 0 && <li className="flex items-center gap-2 text-sm text-slate-700"><AlertTriangle size={16} className="text-red-600" />{openRedFlags} open red flag(s) need investigation</li>}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold text-[var(--astra-navy)]">Supplier Lifecycle Breakdown</h3>
            {totalSuppliers === 0 ? (
              <p className="text-sm text-slate-500">No suppliers registered.</p>
            ) : (
              <div className="space-y-1.5">
                {[
                  { label: 'Prospect', count: data.suppliers.filter((s) => s.lifecycle === 'prospect').length },
                  { label: 'Active', count: activeSuppliers },
                  { label: 'DD Pending', count: ddPending },
                  { label: 'Qualified', count: qualified },
                  { label: 'Trial', count: trial },
                  { label: 'Recurring', count: recurring },
                  { label: 'Paused / Rejected / Archived', count: pausedRejectedArchived },
                ].map((row) => <div key={row.label} className="flex items-center justify-between text-sm"><span className="text-slate-600">{row.label}</span><span className="font-medium text-[var(--astra-navy)]">{row.count}</span></div>)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
