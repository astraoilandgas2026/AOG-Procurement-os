import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import { Building2, ShieldCheck, CheckSquare, DollarSign, FileText, Droplets, Fuel, Pickaxe, ArrowRight } from 'lucide-react';
import type { AppData } from '@/types';
import { getProductFamily } from '@/utils/productFamilies';

const DOMAIN_CONTENT: Record<Exclude<ProcurementDomain, never>, {
  title: string;
  description: string;
  icon: typeof Droplets;
  products: string;
}> = {
  feedstock: {
    title: 'Feedstock',
    description: 'Inteligencia de abastecimiento de materias primas para biodiésel y biocombustibles en LATAM.',
    icon: Droplets,
    products: 'UCO / AVU · aceites vegetales · desgomados · off-spec · oleínas · ácidos grasos · acid oils · soapstock · retornos industriales · residuos oleaginosos',
  },
  energy_commodities: {
    title: 'Energy Commodities',
    description: 'Inteligencia comercial para commodities energéticos convencionales y suministro físico.',
    icon: Fuel,
    products: 'Gas · fuel oil · petcoke · diésel · crudo · otros commodities energéticos',
  },
  mining_commodities: {
    title: 'Mining Commodities',
    description: 'Inteligencia de abastecimiento para commodities mineros, minerales y corrientes de carbón.',
    icon: Pickaxe,
    products: 'Carbón · minerales · concentrados · commodities mineros y subproductos',
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
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--astra-dark)]">Resumen</h2>
          <p className="mt-2 text-sm text-slate-500">Elige el área de commodities con la que quieres trabajar.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-7xl">
          {(Object.keys(DOMAIN_CONTENT) as ProcurementDomain[]).map((key) => {
            const domain = DOMAIN_CONTENT[key];
            const Icon = domain.icon;
            return (
              <button key={key} onClick={() => selectDomain(key)} className="group text-left">
                <Card className="h-full border-slate-200 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--astra-orange)] group-hover:shadow-lg">
                  <CardBody className="p-7">
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]"><Icon size={25} /></div>
                      <ArrowRight size={20} className="mt-1 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[var(--astra-orange)]" />
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-[var(--astra-dark)]">{domain.title}</h3>
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
  const totalContacts = data.contacts.length;
  const totalProducts = new Set(data.products.map((p) => getProductFamily(p))).size;
  const totalDocuments = data.documents.length;
  const totalDueDiligence = data.due_diligence.length;
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
