import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import { Building2, DollarSign, FileText, Package, ShieldAlert, ArrowRight, Target, Layers3 } from 'lucide-react';
import type { AppData } from '@/types';
import { getProductFamily, PRODUCT_FAMILY_LABELS } from '@/utils/productFamilies';

const DOMAIN_LABELS: Record<ProcurementDomain, string> = {
  feedstock: 'Feedstock',
  energy_commodities: 'Energy',
  mining_commodities: 'Metals & Mining',
  fertilizers_chemicals: 'Fertilizers & Chemicals',
  agricultural_commodities: 'Agricultural',
};

const DOMAIN_ICONS: Record<ProcurementDomain, typeof Package> = {
  feedstock: Package,
  energy_commodities: Package,
  mining_commodities: Package,
  fertilizers_chemicals: Package,
  agricultural_commodities: Package,
};

export function DashboardPage() {
  const { navigate, procurementDomain, selectDomain } = useNav();
  const { data, loading, error } = useAsync<AppData>(async () => {
    if (!procurementDomain) return {
      suppliers: [], contacts: [], products: [], technical_specs: [], commercial_offers: [],
      certifications: [], documents: [], due_diligence: [], logistics: [], timeline: [], follow_ups: [], red_flags: [],
    };
    const store = getStore();
    const [suppliers, contacts, products, documents, due_diligence, commercial_offers] = await Promise.all([
      store.suppliers.getByDomainKey(procurementDomain),
      store.contacts.getByDomainKey(procurementDomain),
      store.products.getByDomainKey(procurementDomain),
      store.documents.getByDomainKey(procurementDomain),
      store.dueDiligence.getByDomainKey(procurementDomain),
      store.commercialOffers.getByDomainKey(procurementDomain),
    ]);
    return { suppliers, contacts, products, technical_specs: [], commercial_offers, certifications: [], documents, due_diligence, logistics: [], timeline: [], follow_ups: [], red_flags: [] };
  }, [procurementDomain]);

  if (!procurementDomain) {
    return (
      <div className="space-y-8">
        <div><h2 className="text-3xl font-bold tracking-tight text-[var(--astra-dark)]">AOG Command Center</h2><p className="mt-2 text-sm text-slate-500">Selecciona el universo de commodities que quieres operar.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(Object.keys(DOMAIN_LABELS) as ProcurementDomain[]).map((key) => {
            const Icon = DOMAIN_ICONS[key];
            return <button key={key} onClick={() => selectDomain(key)} className="text-left"><Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg"><CardBody className="flex min-h-[118px] flex-col justify-between p-4"><div className="flex items-center justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]"><Icon size={18}/></div><ArrowRight size={16} className="text-slate-300"/></div><span className="text-sm font-bold text-[var(--astra-dark)]">{DOMAIN_LABELS[key]}</span></CardBody></Card></button>;
          })}
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const suppliers = data.suppliers;
  const products = data.products.filter(p => p.feedstock_type !== 'soapstock' && !/\bsoapstock\b|\bborra\b/i.test(p.name));
  const activeDeals = suppliers.filter(s => ['active', 'trial', 'recurring'].includes(s.lifecycle)).length;
  const openOpportunities = suppliers.filter(s => s.lifecycle === 'prospect').length;
  const supplyPipeline = new Set(products.map(getProductFamily)).size;
  const commodityExposure = new Set(products.map(p => p.commodity_category || p.feedstock_type)).size;
  const documentsMissing = Math.max(0, data.due_diligence.filter(d => d.status === 'pending').length);
  const alerts = data.due_diligence.filter(d => ['rejected'].includes(d.status)).length;

  const metrics = [
    { label: 'Active Deals', value: activeDeals, icon: <Target size={20}/>, onClick: () => navigate('suppliers') },
    { label: 'Open Opportunities', value: openOpportunities, icon: <Building2 size={20}/>, onClick: () => navigate('suppliers') },
    { label: 'Supply Pipeline', value: supplyPipeline, suffix: 'familias', icon: <Layers3 size={20}/>, onClick: () => navigate('products') },
    { label: 'Commodity Exposure', value: commodityExposure, suffix: 'categorías', icon: <Package size={20}/>, onClick: () => navigate('products') },
    { label: 'Documents Missing', value: documentsMissing, icon: <FileText size={20}/>, onClick: () => navigate('documents') },
    { label: 'Alerts', value: alerts, icon: <ShieldAlert size={20}/>, onClick: () => navigate('due_diligence') },
  ];

  const familyCounts = new Map<string, number>();
  products.forEach(p => {
    const family = getProductFamily(p);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  });
  const topFamilies = Array.from(familyCounts.entries()).sort((a,b) => b[1]-a[1]).slice(0, 6);


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--astra-orange)]">{DOMAIN_LABELS[procurementDomain]}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--astra-dark)]">Command Center</h2><p className="mt-1 text-sm text-slate-500">Estado comercial y supply intelligence de {DOMAIN_LABELS[procurementDomain]}.</p></div>
        <button onClick={() => navigate('commercial')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ver ofertas <ArrowRight size={14}/></button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(m => <button key={m.label} onClick={m.onClick} className="text-left"><Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md"><CardBody className="min-h-[132px] p-4"><div className="flex items-start justify-between text-[var(--astra-orange)]">{m.icon}<ArrowRight size={14} className="text-slate-300"/></div><div className="mt-5 text-3xl font-semibold tracking-tight text-[var(--astra-dark)]">{m.value}</div><div className="mt-1 text-xs font-semibold text-slate-600">{m.label}</div>{m.suffix && <div className="text-[10px] text-slate-400">{m.suffix}</div>}</CardBody></Card></button>)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Supply Pipeline</h3><p className="text-xs text-slate-500">Familias comerciales activas</p></div><button onClick={() => navigate('products')} className="text-xs font-semibold text-[var(--astra-orange)]">Productos</button></div>
          {topFamilies.length ? <div className="space-y-2">{topFamilies.map(([family,count]) => <div key={family} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span className="text-sm text-slate-700">{PRODUCT_FAMILY_LABELS[family as keyof typeof PRODUCT_FAMILY_LABELS] || family}</span><span className="text-xs font-semibold text-slate-500">{count} proveedores/productos</span></div>)}</div> : <EmptyState icon={<Package size={24}/>} title="Sin supply registrado" message="Agrega productos para construir el pipeline." />}
        </CardBody></Card>

        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Commercial Control</h3><p className="text-xs text-slate-500">Lo que requiere atención comercial</p></div><button onClick={() => navigate('commercial')} className="text-xs font-semibold text-[var(--astra-orange)]">Comercial</button></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3"><DollarSign size={17} className="text-[var(--astra-orange)]"/><div className="mt-2 text-2xl font-semibold">{data.commercial_offers.length}</div><div className="text-xs text-slate-500">Ofertas registradas</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><ShieldAlert size={17} className="text-[var(--astra-orange)]"/><div className="mt-2 text-2xl font-semibold">{alerts}</div><div className="text-xs text-slate-500">Alertas DD</div></div>
          </div>
          <div className="mt-4 text-xs text-slate-500">{suppliers.length} proveedores · {products.length} registros de producto · {data.documents.length} documentos.</div>
        </CardBody></Card>
      </div>
    </div>
  );
}
