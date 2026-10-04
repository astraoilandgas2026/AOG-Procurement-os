import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Modal } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import { Building2, DollarSign, FileText, Package, ShieldAlert, ArrowRight, Target, Layers3, Plus } from 'lucide-react';
import type { AppData, Supplier, Product } from '@/types';
import { getProductFamily, PRODUCT_FAMILY_LABELS, displayProductName } from '@/utils/productFamilies';

const DOMAIN_LABELS: Record<ProcurementDomain, string> = {
  feedstock: 'Materias primas',
  energy_commodities: 'Energía',
  mining_commodities: 'Metales y minería',
  fertilizers_chemicals: 'Fertilizantes y químicos',
  agricultural_commodities: 'Agrícola',
};

type Drilldown = 'active' | 'opportunities' | 'supply' | 'exposure' | 'documents' | 'alerts' | null;

function supplierName(s: Supplier) {
  return s.legal_name || s.trading_name || 'Proveedor sin nombre';
}

export function DashboardPage() {
  const { navigate, procurementDomain, selectDomain } = useNav();
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

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
          {(Object.keys(DOMAIN_LABELS) as ProcurementDomain[]).map((key) => (
            <button key={key} onClick={() => selectDomain(key)} className="text-left"><Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg"><CardBody className="flex min-h-[118px] flex-col justify-between p-4"><div className="flex items-center justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]"><Package size={18}/></div><ArrowRight size={16} className="text-slate-300"/></div><span className="text-sm font-bold text-[var(--astra-dark)]">{DOMAIN_LABELS[key]}</span></CardBody></Card></button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const suppliers = data.suppliers;
  const products = data.products.filter(p => p.feedstock_type !== 'soapstock' && !/\bsoapstock\b|\bborra\b/i.test(p.name));

  // Una oferta no se convierte automáticamente en operación activa.
  // Para el Command Center usamos el estado operativo del proveedor como señal
  // existente hasta que exista una entidad Deal independiente.
  const activeDeals = suppliers.filter(s => ['active', 'trial', 'recurring'].includes(s.lifecycle));
  const openOpportunities = suppliers.filter(s => s.lifecycle === 'prospect');
  const supplyPipeline = products;
  const commodityExposure = Array.from(new Map(products.map(p => [p.commodity_category || p.feedstock_type, p])).values());
  const documentsMissing = Math.max(0, data.due_diligence.filter(d => d.status === 'pending').length);
  const alerts = data.due_diligence.filter(d => d.status === 'rejected').length;

  const metrics = [
    { key: 'active' as Drilldown, label: 'Operaciones activas', value: activeDeals.length, icon: <Target size={20}/> },
    { key: 'opportunities' as Drilldown, label: 'Oportunidades abiertas', value: openOpportunities.length, icon: <Building2 size={20}/> },
    { key: 'supply' as Drilldown, label: 'Suministro', value: supplyPipeline.length, suffix: 'productos', icon: <Layers3 size={20}/> },
    { key: 'exposure' as Drilldown, label: 'Exposición por materia prima', value: commodityExposure.length, suffix: 'categorías', icon: <Package size={20}/> },
    { key: 'documents' as Drilldown, label: 'Documentos pendientes', value: documentsMissing, icon: <FileText size={20}/> },
    { key: 'alerts' as Drilldown, label: 'Alertas', value: alerts, icon: <ShieldAlert size={20}/> },
  ];

  const familyCounts = new Map<string, number>();
  products.forEach(p => {
    const family = getProductFamily(p);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  });
  const topFamilies = Array.from(familyCounts.entries()).sort((a,b) => b[1]-a[1]).slice(0, 6);

  const drilldownTitle: Record<Exclude<Drilldown, null>, string> = {
    active: 'Operaciones activas',
    opportunities: 'Oportunidades abiertas',
    supply: 'Suministro registrado',
    exposure: 'Exposición por materia prima',
    documents: 'Documentos pendientes',
    alerts: 'Alertas de debida diligencia',
  };

  const renderDrilldown = () => {
    if (!drilldown) return null;
    if (drilldown === 'active' && activeDeals.length === 0) {
      return <EmptyState icon={<Target size={28}/>} title="Todavía no hay operaciones activas" message="Aquí aparecerán las operaciones que estén realmente activas, en prueba o recurrentes. No se deben inventar operaciones a partir de proveedores u ofertas." action={<Button onClick={() => { setDrilldown(null); navigate('commercial'); }}><Plus size={16}/> Agregar oferta comercial</Button>} />;
    }
    if (drilldown === 'opportunities' && openOpportunities.length === 0) {
      return <EmptyState icon={<Building2 size={28}/>} title="No hay oportunidades abiertas" message="Registra un proveedor como prospecto para que aparezca aquí." action={<Button onClick={() => { setDrilldown(null); navigate('suppliers'); }}><Plus size={16}/> Agregar proveedor</Button>} />;
    }
    if (drilldown === 'supply' && supplyPipeline.length === 0) {
      return <EmptyState icon={<Package size={28}/>} title="No hay suministro registrado" message="Agrega productos reales de proveedores para construir el suministro." action={<Button onClick={() => { setDrilldown(null); navigate('products'); }}><Plus size={16}/> Agregar producto</Button>} />;
    }
    if (drilldown === 'exposure' && commodityExposure.length === 0) {
      return <EmptyState icon={<Package size={28}/>} title="Sin exposición registrada" message="La exposición se calcula únicamente sobre productos registrados." />;
    }
    if (drilldown === 'documents' && documentsMissing === 0) {
      return <EmptyState icon={<FileText size={28}/>} title="No hay documentos pendientes" message="No hay elementos de debida diligencia marcados como pendientes." />;
    }
    if (drilldown === 'alerts' && alerts === 0) {
      return <EmptyState icon={<ShieldAlert size={28}/>} title="Sin alertas" message="No hay alertas de debida diligencia rechazadas en este universo." />;
    }

    if (drilldown === 'active') return <div className="space-y-2">{activeDeals.map(s => <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><div className="text-sm font-semibold">{supplierName(s)}</div><div className="text-xs text-slate-500">Estado: {s.lifecycle === 'active' ? 'Activo' : s.lifecycle === 'trial' ? 'Prueba' : 'Recurrente'}</div></div><Button size="sm" variant="ghost" onClick={() => { setDrilldown(null); navigate('suppliers'); }}>Ver proveedor</Button></div>)}</div>;
    if (drilldown === 'opportunities') return <div className="space-y-2">{openOpportunities.map(s => <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><div className="text-sm font-semibold">{supplierName(s)}</div><div className="text-xs text-slate-500">{s.country || 'País no informado'} · Prospecto</div></div><Button size="sm" variant="ghost" onClick={() => { setDrilldown(null); navigate('suppliers'); }}>Ver proveedor</Button></div>)}</div>;
    if (drilldown === 'supply') return <div className="space-y-2">{supplyPipeline.map(p => <div key={p.id} className="rounded-lg border border-slate-200 p-3"><div className="text-sm font-semibold">{displayProductName(p.name)}</div><div className="mt-1 text-xs text-slate-500">{p.commodity_category || p.feedstock_type} · {p.available_volume || 'Volumen no informado'}</div></div>)}</div>;
    if (drilldown === 'exposure') return <div className="space-y-2">{commodityExposure.map(p => <div key={p.id} className="rounded-lg border border-slate-200 p-3"><div className="text-sm font-semibold">{p.commodity_category || p.feedstock_type}</div><div className="text-xs text-slate-500">Representado por: {displayProductName(p.name)}</div></div>)}</div>;
    if (drilldown === 'documents') return <div className="space-y-2">{data.due_diligence.filter(d => d.status === 'pending').map(d => <div key={d.id} className="rounded-lg border border-slate-200 p-3"><div className="text-sm font-semibold">{d.category}</div><div className="text-xs text-slate-500">Proveedor: {supplierName(suppliers.find(s => s.id === d.supplier_id) ?? { legal_name: '', trading_name: '', id: '', country: '', city: '', address: '', tax_id: '', cnae: '', administrator: '', legal_status: '', facility: '', operation_status: '', theoretical_capacity: '', real_production: '', available_volume: '', volume_to_astra: '', trial_volume: '', recurring_volume: '', infrastructure: '', lifecycle: 'prospect', created_at: '', updated_at: '' })}</div></div>)}</div>;
    return <div className="space-y-2">{data.due_diligence.filter(d => d.status === 'rejected').map(d => <div key={d.id} className="rounded-lg border border-red-200 bg-red-50/30 p-3"><div className="text-sm font-semibold">{d.category}</div><div className="text-xs text-slate-600">{d.findings || 'Sin detalle registrado'}</div></div>)}</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--astra-orange)]">{DOMAIN_LABELS[procurementDomain]}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--astra-dark)]">Command Center</h2><p className="mt-1 text-sm text-slate-500">Estado comercial y de suministro de {DOMAIN_LABELS[procurementDomain]}.</p></div>
        <button onClick={() => navigate('commercial')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ver ofertas comerciales <ArrowRight size={14}/></button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(m => <button key={m.key} onClick={() => setDrilldown(m.key)} className="text-left"><Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md"><CardBody className="min-h-[132px] p-4"><div className="flex items-start justify-between text-[var(--astra-orange)]">{m.icon}<ArrowRight size={14} className="text-slate-300"/></div><div className="mt-5 text-3xl font-semibold tracking-tight text-[var(--astra-dark)]">{m.value}</div><div className="mt-1 text-xs font-semibold text-slate-600">{m.label}</div>{m.suffix && <div className="text-[10px] text-slate-400">{m.suffix}</div>}</CardBody></Card></button>)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Suministro</h3><p className="text-xs text-slate-500">Familias comerciales registradas</p></div><button onClick={() => setDrilldown('supply')} className="text-xs font-semibold text-[var(--astra-orange)]">Ver detalle</button></div>
          {topFamilies.length ? <div className="space-y-2">{topFamilies.map(([family,count]) => <div key={family} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span className="text-sm text-slate-700">{PRODUCT_FAMILY_LABELS[family as keyof typeof PRODUCT_FAMILY_LABELS] || family}</span><span className="text-xs font-semibold text-slate-500">{count} registros</span></div>)}</div> : <EmptyState icon={<Package size={24}/>} title="Sin suministro registrado" message="Agrega productos para construir el suministro." />}
        </CardBody></Card>

        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Control comercial</h3><p className="text-xs text-slate-500">Lo que requiere atención comercial</p></div><button onClick={() => navigate('commercial')} className="text-xs font-semibold text-[var(--astra-orange)]">Ver ofertas</button></div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('commercial')} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100"><DollarSign size={17} className="text-[var(--astra-orange)]"/><div className="mt-2 text-2xl font-semibold">{data.commercial_offers.length}</div><div className="text-xs text-slate-500">Ofertas registradas</div></button>
            <button onClick={() => setDrilldown('alerts')} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100"><ShieldAlert size={17} className="text-[var(--astra-orange)]"/><div className="mt-2 text-2xl font-semibold">{alerts}</div><div className="text-xs text-slate-500">Alertas de DD</div></button>
          </div>
          <div className="mt-4 text-xs text-slate-500">{suppliers.length} proveedores · {products.length} productos · {data.documents.length} documentos.</div>
        </CardBody></Card>
      </div>

      <Modal open={Boolean(drilldown)} onClose={() => setDrilldown(null)} title={drilldown ? drilldownTitle[drilldown] : ''} footer={<Button variant="secondary" onClick={() => setDrilldown(null)}>Cerrar</Button>}>
        {renderDrilldown()}
      </Modal>
    </div>
  );
}
