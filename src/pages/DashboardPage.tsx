import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Modal } from '@/components/ui';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import { Building2, DollarSign, Package, ArrowRight, Target, Layers3, Plus, Award } from 'lucide-react';
import type { AppData, Supplier, Product } from '@/types';
import { getProductFamily, PRODUCT_FAMILY_LABELS, displayProductName } from '@/utils/productFamilies';

const DOMAIN_LABELS: Record<ProcurementDomain, string> = {
  feedstock: 'Materias primas',
  energy_commodities: 'Energía',
  mining_commodities: 'Metales y minería',
  fertilizers_chemicals: 'Fertilizantes y químicos',
  agricultural_commodities: 'Agrícola',
};

type Drilldown = 'active' | 'opportunities' | 'supply' | 'exposure' | 'iscc' | null;

function supplierName(s: Supplier) {
  return s.legal_name || s.trading_name || 'Proveedor sin nombre';
}

export function DashboardPage() {
  const { navigate, procurementDomain, selectDomain, selectSupplier } = useNav();
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  const { data, loading, error } = useAsync<AppData>(async () => {
    if (!procurementDomain) return {
      suppliers: [], contacts: [], products: [], technical_specs: [], commercial_offers: [],
      certifications: [], documents: [], due_diligence: [], logistics: [], timeline: [], follow_ups: [], red_flags: [],
    };
    const store = getStore();
    const [suppliers, contacts, products, documents, due_diligence, commercial_offers, certifications] = await Promise.all([
      store.suppliers.getByDomainKey(procurementDomain),
      store.contacts.getByDomainKey(procurementDomain),
      store.products.getByDomainKey(procurementDomain),
      store.documents.getByDomainKey(procurementDomain),
      store.dueDiligence.getByDomainKey(procurementDomain),
      store.commercialOffers.getByDomainKey(procurementDomain),
      store.certifications.getByDomainKey(procurementDomain),
    ]);
    return { suppliers, contacts, products, technical_specs: [], commercial_offers, certifications, documents, due_diligence, logistics: [], timeline: [], follow_ups: [], red_flags: [] };
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

  const numericPrice = (price?: string | null) => {
    if (!price) return null;
    const normalized = Number.parseFloat(String(price).replace(/,/g, '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(normalized) ? normalized : null;
  };

  const prioritySupplier = (name: string) => {
    const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (n.includes('renovar')) return 0;
    if (n.includes('fl oleos')) return 1;
    if (n.includes('olam')) return 2;
    return 10;
  };

  const isPrioritySupplier = (name: string) => prioritySupplier(name) < 10;
  const isBerisSupplier = (name: string) => name.toLowerCase().includes('beris');

  const offersBySupplier = new Map<string, typeof data.commercial_offers[number]>();
  data.commercial_offers.forEach(offer => {
    const current = offersBySupplier.get(offer.supplier_id);
    if (!current || (numericPrice(offer.price) ?? Number.POSITIVE_INFINITY) < (numericPrice(current.price) ?? Number.POSITIVE_INFINITY)) {
      offersBySupplier.set(offer.supplier_id, offer);
    }
  });

  const rankedOffers = Array.from(offersBySupplier.values()).sort((a, b) => {
    const supplierA = supplierName(suppliers.find(s => s.id === a.supplier_id) || {} as Supplier);
    const supplierB = supplierName(suppliers.find(s => s.id === b.supplier_id) || {} as Supplier);
    const priorityDiff = prioritySupplier(supplierA) - prioritySupplier(supplierB);
    if (priorityDiff !== 0) return priorityDiff;
    return (numericPrice(a.price) ?? Number.POSITIVE_INFINITY) - (numericPrice(b.price) ?? Number.POSITIVE_INFINITY);
  });

  const offerSupplierIds = new Set(data.commercial_offers.map(o => o.supplier_id));
  const opportunityCandidates = suppliers.filter(s => s.lifecycle === 'prospect' || offerSupplierIds.has(s.id));
  const openOpportunities = opportunityCandidates.sort((a, b) => {
    const priorityDiff = prioritySupplier(supplierName(a)) - prioritySupplier(supplierName(b));
    if (priorityDiff !== 0) return priorityDiff;
    const priceA = numericPrice(offersBySupplier.get(a.id)?.price);
    const priceB = numericPrice(offersBySupplier.get(b.id)?.price);
    if (priceA !== null || priceB !== null) return (priceA ?? Number.POSITIVE_INFINITY) - (priceB ?? Number.POSITIVE_INFINITY);
    return supplierName(a).localeCompare(supplierName(b));
  }).slice(0, 12);

  const supplyBySupplier = Array.from(new Map(
    products.map(product => [product.supplier_id, {
      supplier: suppliers.find(s => s.id === product.supplier_id),
      products: products.filter(p => p.supplier_id === product.supplier_id),
    }])
  ).values()).filter(item => item.supplier);

  const supplyPipeline = products;
  const commodityExposure = Array.from(new Map(
    products.map(p => [displayProductName(p.name).trim().toLowerCase(), p])
  ).values());
  const documentsMissing = Math.max(0, data.due_diligence.filter(d => d.status === 'pending').length);
  const isccCertifications = data.certifications.filter(c => /iscc/i.test(c.cert_type) && c.status === 'active');

  const metrics = [
    { key: 'active' as Drilldown, label: 'Operaciones activas', value: activeDeals.length, icon: <Target size={20}/> },
    { key: 'opportunities' as Drilldown, label: 'Oportunidades abiertas', value: openOpportunities.length, icon: <Building2 size={20}/> },
    { key: 'supply' as Drilldown, label: 'Suministro', value: supplyBySupplier.length, suffix: 'proveedores', icon: <Layers3 size={20}/> },
    { key: 'exposure' as Drilldown, label: 'Productos', value: commodityExposure.length, suffix: 'productos únicos', icon: <Package size={20}/> },
  ];

  const drilldownTitle: Record<Exclude<Drilldown, null>, string> = {
    active: 'Operaciones activas',
    opportunities: 'Oportunidades abiertas',
    supply: 'Suministro registrado',
    exposure: 'Productos registrados',
    iscc: 'Certificaciones ISCC',
  };

  const renderDrilldown = () => {
    if (!drilldown) return null;
    if (drilldown === 'active' && activeDeals.length === 0) {
      return <EmptyState icon={<Target size={28}/>} title="Todavía no hay operaciones activas" message="Agrega una operación cuando exista un acuerdo activo, una operación en prueba o un suministro recurrente." action={<Button onClick={() => { setDrilldown(null); navigate('commercial'); }}><Plus size={16}/> Agregar operación</Button>} />;
    }
    if (drilldown === 'opportunities' && openOpportunities.length === 0) {
      return <EmptyState icon={<Building2 size={28}/>} title="No hay oportunidades abiertas" message="Registra proveedores u ofertas comerciales para construir el ranking." action={<Button onClick={() => { setDrilldown(null); navigate('commercial'); }}><Plus size={16}/> Agregar oferta</Button>} />;
    }
    if (drilldown === 'supply' && supplyBySupplier.length === 0) {
      return <EmptyState icon={<Package size={28}/>} title="No hay suministro registrado" message="Agrega productos reales de proveedores para construir el suministro." action={<Button onClick={() => { setDrilldown(null); navigate('products'); }}><Plus size={16}/> Agregar producto</Button>} />;
    }
    if (drilldown === 'exposure' && commodityExposure.length === 0) {
      return <EmptyState icon={<Package size={28}/>} title="Sin exposición registrada" message="La exposición se calcula únicamente sobre productos registrados." />;
    }

    if (drilldown === 'active') return <div className="space-y-2">{activeDeals.map(s => <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><div><div className="text-sm font-semibold">{supplierName(s)}</div><div className="text-xs text-slate-500">Estado: {s.lifecycle === 'active' ? 'Activo' : s.lifecycle === 'trial' ? 'Prueba' : 'Recurrente'}</div></div><Button size="sm" variant="ghost" onClick={() => { setDrilldown(null); navigate('suppliers'); }}>Ver proveedor</Button></div>)}</div>;
    if (drilldown === 'opportunities') return <div className="space-y-2">{openOpportunities.map(s => {
      const offer = offersBySupplier.get(s.id);
      const price = numericPrice(offer?.price);
      const inTarget = price !== null && price >= 750 && price <= 790;
      const priority = isPrioritySupplier(supplierName(s));
      const beris = isBerisSupplier(supplierName(s));
      const highlight = inTarget || priority;
      return <button key={s.id} onClick={() => selectSupplier(s.id)} className={`w-full text-left rounded-lg border p-3 transition-shadow hover:shadow-md ${highlight ? 'border-red-300 bg-red-50/40' : beris ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-semibold">{supplierName(s)}</div><div className="text-xs text-slate-500">{offer ? displayProductName(products.find(p => p.id === offer.product_id)?.name || 'Oferta comercial') : (s.country || 'País no informado')}</div></div>
          <div className="text-right">{offer ? <div className={`text-sm font-bold ${highlight ? 'text-red-600' : beris ? 'text-amber-700' : 'text-[var(--astra-dark)]'}`}>{offer.price} {offer.currency || 'USD'} / {offer.price_unit || 'MT'}</div> : <div className="text-xs text-slate-400">Precio no informado</div>}{offer && <div className="text-[10px] text-slate-500">{offer.incoterm || 'Incoterm N/D'}</div>}</div>
        </div>
      </button>;
    })}</div>;
    if (drilldown === 'supply') return <div className="space-y-2">{supplyBySupplier.map(({supplier, products: supplierProducts}) => <div key={supplier!.id} className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{supplierName(supplier!)}</div><div className="mt-1 text-xs text-slate-500">{supplierProducts.length} producto{supplierProducts.length === 1 ? '' : 's'} registrado{supplierProducts.length === 1 ? '' : 's'}</div></div><span className="text-xs font-semibold text-slate-500">{supplierProducts.map(p => p.available_volume).filter(Boolean).join(' · ') || 'Volumen no informado'}</span></div>
      <div className="mt-2 text-xs text-slate-600">{supplierProducts.map(p => displayProductName(p.name)).join(' · ')}</div>
    </div>)}</div>;
    if (drilldown === 'iscc') return <div className="space-y-2">{isccCertifications.map(cert => <div key={cert.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">ISCC</div><div className="text-xs text-slate-500">{supplierName(suppliers.find(s => s.id === cert.supplier_id) || {} as Supplier)}</div></div><div className="text-right"><div className="text-xs font-semibold">{cert.cert_number || 'Número no informado'}</div><div className="text-[10px] text-slate-400">Vence: {cert.expiration_date || '—'}</div></div></div></div>)}</div>;
    if (drilldown === 'exposure') return <div className="space-y-2">{commodityExposure.map(p => {
      const productSuppliers = suppliers.filter(s => products.some(sp => sp.id === p.id && sp.supplier_id === s.id));
      return <div key={p.id} className="rounded-lg border border-slate-200 p-3"><div className="text-sm font-semibold">{displayProductName(p.name)}</div><div className="text-xs text-slate-500">{p.available_volume || 'Volumen no informado'} · {productSuppliers.map(s => supplierName(s)).join(', ') || 'Proveedor no informado'}</div></div>;
    })}</div>;
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

      <Card>
        <CardBody>
          <div className="mb-4 flex items-center justify-between">
            <div><h3 className="font-semibold text-[var(--astra-dark)]">Ofertas comerciales</h3><p className="text-xs text-slate-500">Ofertas definidas, precios y productos disponibles</p></div>
            <button onClick={() => navigate('commercial')} className="text-xs font-semibold text-[var(--astra-orange)]">Ver todas</button>
          </div>
          {rankedOffers.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{rankedOffers.slice(0,6).map(o => {
            const supplier = suppliers.find(s => s.id === o.supplier_id);
            const price = numericPrice(o.price);
            const inTarget = price !== null && price >= 750 && price <= 790;
            const priority = isPrioritySupplier(supplierName(supplier || {} as Supplier));
            const beris = isBerisSupplier(supplierName(supplier || {} as Supplier));
            const highlight = inTarget || priority;
            return <div key={o.id} onClick={() => supplier && selectSupplier(supplier.id)} className={`cursor-pointer rounded-xl border bg-white p-4 hover:shadow-md ${highlight ? 'border-red-300 bg-red-50/30' : beris ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3"><div><div className={`text-base font-bold ${highlight ? 'text-red-600' : beris ? 'text-amber-700' : 'text-[var(--astra-dark)]'}`}>{o.price || 'N/D'} {o.currency || ''}{o.price_unit ? ` / ${o.price_unit}` : ''}</div><div className="mt-1 text-sm font-semibold text-slate-700">{supplierName(supplier || {} as Supplier)}</div><div className="mt-0.5 text-xs text-slate-500">{displayProductName(products.find(p => p.id === o.product_id)?.name || 'Producto no informado')}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${inTarget ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{inTarget ? 'Dentro del target' : o.incoterm}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><div>Volumen: <span className="font-semibold text-slate-700">{o.offered_volume || '—'}</span></div><div>{/iscc/i.test(o.certification_premium || '') || /olam/i.test(supplierName(supplier || {} as Supplier)) ? <span className="font-semibold text-[var(--astra-orange)]">ISCC</span> : 'Certificación N/D'}</div></div>
            </div>;
          })}</div> : <EmptyState icon={<DollarSign size={24}/>} title="No hay ofertas comerciales registradas" message="Agrega una oferta comercial para comenzar." action={<Button onClick={() => navigate('commercial')}><Plus size={16}/> Agregar oferta</Button>} />}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Suministro</h3><p className="text-xs text-slate-500">Proveedores y productos registrados, sin repetir familias</p></div><button onClick={() => setDrilldown('supply')} className="text-xs font-semibold text-[var(--astra-orange)]">Ver detalle</button></div>
          {supplyBySupplier.length ? <div className="space-y-2">{supplyBySupplier.slice(0,6).map(({supplier, products: supplierProducts}) => <div key={supplier!.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><div><span className="text-sm font-semibold text-slate-700">{supplierName(supplier!)}</span><div className="text-xs text-slate-500">{supplierProducts.map(p => displayProductName(p.name)).join(' · ')}</div></div><span className="text-xs font-semibold text-slate-500">{supplierProducts.length} producto{supplierProducts.length === 1 ? '' : 's'}</span></div>)}</div> : <EmptyState icon={<Package size={24}/>} title="Sin suministro registrado" message="Agrega productos para construir el suministro." />}
        </CardBody></Card>
        <Card><CardBody><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[var(--astra-dark)]">Certificaciones ISCC</h3><p className="text-xs text-slate-500">Proveedores con ISCC activa</p></div><button onClick={() => setDrilldown('iscc')} className="text-xs font-semibold text-[var(--astra-orange)]">Ver ISCC</button></div>
          {isccCertifications.length ? <div className="space-y-2">{isccCertifications.slice(0,5).map(cert => <div key={cert.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"><span className="text-sm font-semibold">{supplierName(suppliers.find(s => s.id === cert.supplier_id) || {} as Supplier)}</span><span className="text-xs text-slate-500">ISCC · {cert.cert_number || 'N/D'}</span></div>)}</div> : <EmptyState icon={<Award size={24}/>} title="Sin ISCC activa registrada" message="Registra certificaciones ISCC para mostrarlas aquí." />}
        </CardBody></Card>
      </div>

      <Modal open={Boolean(drilldown)} onClose={() => setDrilldown(null)} title={drilldown ? drilldownTitle[drilldown] : ''} footer={<Button variant="secondary" onClick={() => setDrilldown(null)}>Cerrar</Button>}>
        {renderDrilldown()}
      </Modal>
    </div>
  );
}
