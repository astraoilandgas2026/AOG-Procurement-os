import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import { Building2, ShieldCheck, CheckSquare, DollarSign, FileText, Droplets, Fuel, Pickaxe, FlaskConical, Wheat, ArrowRight } from 'lucide-react';
import type { AppData } from '@/types';
import { getProductFamily } from '@/utils/productFamilies';

const DOMAIN_CONTENT: Record<Exclude<ProcurementDomain, never>, {
  title: string;
  icon: typeof Droplets;
}> = {
  feedstock: {
    title: 'Feedstock',
    icon: Droplets,
  },
  energy_commodities: {
    title: 'Energy Commodities',
    icon: Fuel,
  },
  mining_commodities: {
    title: 'Mining Commodities',
    icon: Pickaxe,
  },
  fertilizers_chemicals: {
    title: 'Fertilizers & Chemicals',
    icon: FlaskConical,
  },
  agricultural_commodities: {
    title: 'Agricultural Commodities',
    icon: Wheat,
  },
};

const METRIC_ACCENTS = [
  { key: 'red', line: 'bg-[var(--astra-red)]', soft: 'bg-red-50', text: 'text-[var(--astra-red)]' },
  { key: 'blue', line: 'bg-[var(--astra-blue)]', soft: 'bg-blue-50', text: 'text-[var(--astra-blue)]' },
  { key: 'green', line: 'bg-[var(--astra-green)]', soft: 'bg-green-50', text: 'text-[var(--astra-green)]' },
  { key: 'orange', line: 'bg-[var(--astra-orange)]', soft: 'bg-orange-50', text: 'text-[var(--astra-orange)]' },
  { key: 'yellow', line: 'bg-[var(--astra-yellow)]', soft: 'bg-yellow-50', text: 'text-[var(--astra-yellow)]' },
] as const;

export function DashboardPage() {
  const { navigate, procurementDomain, selectDomain } = useNav();
  const { data, loading, error } = useAsync<AppData>(async () => {
    if (!procurementDomain) return {
      suppliers: [], contacts: [], products: [], technical_specs: [], commercial_offers: [],
      certifications: [], documents: [], due_diligence: [], logistics: [], timeline: [], follow_ups: [], red_flags: [],
    };
    const store = getStore();
    const suppliers = await store.suppliers.getByDomainKey(procurementDomain);
    const all = await store.getAll();
    const supplierIds = new Set(suppliers.map((s) => s.id));
    const scoped = <T extends { supplier_id?: string }>(rows: T[]) => rows.filter((row) => !row.supplier_id || supplierIds.has(row.supplier_id));
    return {
      ...all,
      suppliers,
      contacts: scoped(all.contacts),
      products: scoped(all.products),
      commercial_offers: scoped(all.commercial_offers),
      certifications: scoped(all.certifications),
      documents: scoped(all.documents),
      due_diligence: scoped(all.due_diligence),
      logistics: scoped(all.logistics),
      timeline: scoped(all.timeline),
      follow_ups: scoped(all.follow_ups),
      red_flags: scoped(all.red_flags),
    };
  }, [procurementDomain]);

  if (!procurementDomain) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-start gap-5 max-w-3xl">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--astra-dark)]">Resumen</h2>
            <p className="mt-2 text-sm text-slate-500">Elige el área de commodities con la que quieres trabajar.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-3xl mx-auto w-full">
          {(Object.keys(DOMAIN_CONTENT) as ProcurementDomain[]).map((key) => {
            const domain = DOMAIN_CONTENT[key];
            const Icon = domain.icon;
            return (
              <button key={key} onClick={() => selectDomain(key)} className="group min-w-0 text-left">
                <Card className="h-[118px] w-full border-slate-200 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--astra-orange)] group-hover:shadow-lg">
                  <CardBody className="flex h-full flex-col justify-between p-3">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]">
                        <Icon size={17} />
                      </div>
                      <ArrowRight size={15} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[var(--astra-orange)]" />
                    </div>
                    <h3 className="text-[13px] font-bold leading-4 text-[var(--astra-dark)]">{domain.title}</h3>
                  </CardBody>
                </Card>
              </button>
            );
          })}
        </div>   </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const totalSuppliers = data.suppliers.length;
  const totalContacts = data.contacts.length;
  const totalProducts = new Set(data.products.map((p) => getProductFamily(p))).size;
  const totalDocuments = data.documents.length;
  const totalDueDiligence = new Set(data.due_diligence.map((d) => d.supplier_id)).size;
  const totalCommercialOffers = data.commercial_offers.length;
  const isEmpty = totalSuppliers === 0 && totalProducts === 0 && totalDocuments === 0;

  const metrics = [
    { label: 'Commercial Offers', value: totalCommercialOffers, icon: <DollarSign size={21} />, onClick: () => navigate('commercial') },
    { label: 'Proveedores', value: totalSuppliers, icon: <Building2 size={21} />, onClick: () => navigate('suppliers') },
    { label: 'Contactos', value: totalContacts, icon: <CheckSquare size={21} />, onClick: () => navigate('contacts') },
    { label: 'Documentos', value: totalDocuments, icon: <FileText size={21} />, onClick: () => navigate('documents') },
    { label: 'Debida diligencia', value: totalDueDiligence, icon: <ShieldCheck size={21} />, onClick: () => navigate('due_diligence') },
  ];

  if (isEmpty) {
    return (
      <Card>
        <EmptyState icon={<Building2 size={28} />} title="Aún no hay inteligencia de procurement" message="Registra el primer proveedor. El resumen se completará a medida que incorpores proveedores, productos, ofertas comerciales y debida diligencia." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--astra-orange)]">{DOMAIN_CONTENT[procurementDomain].title}</p>
        
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metrics.map((m, index) => {
          const accent = METRIC_ACCENTS[index];
          return (
            <button key={m.label} onClick={m.onClick} className="group text-left">
              <Card className="relative h-full overflow-hidden border-slate-200 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-slate-300 group-hover:shadow-lg">
                <div className={`absolute inset-x-0 top-0 h-1 ${accent.line}`} />
                <CardBody className="flex h-full min-h-[148px] flex-col justify-between p-5 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent.soft} ${accent.text}`}>
                      {m.icon}
                    </div>
                    <ArrowRight size={17} className="mt-1 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-slate-500" />
                  </div>
                  <div className="mt-7">
                    <div className="text-4xl font-semibold tracking-tight text-[var(--astra-dark)]">{m.value}</div>
                    <div className="mt-1 text-sm font-medium text-slate-600">{m.label}</div>
                  </div>
                </CardBody>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
