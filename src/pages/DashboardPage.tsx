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
};

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
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[var(--astra-dark)]">Overview</h2>
          <p className="mt-2 text-sm text-slate-500">Selecciona el universo de abastecimiento con el que quieres trabajar. El espacio de inteligencia se adaptará al dominio seleccionado.</p>
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]">
                        <Icon size={25} />
                      </div>
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
  const activeSuppliers = data.suppliers.filter((s) => s.lifecycle === 'active').length;
  const ddPending = data.suppliers.filter((s) => s.lifecycle === 'dd_pending').length;
  const qualified = data.suppliers.filter((s) => s.lifecycle === 'qualified').length;
  const trial = data.suppliers.filter((s) => s.lifecycle === 'trial').length;
  const recurring = data.suppliers.filter((s) => s.lifecycle === 'recurring').length;
  const pausedRejectedArchived = data.suppliers.filter((s) => ['paused', 'rejected', 'archived'].includes(s.lifecycle)).length;
  const followUpsDue = data.follow_ups.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const openRedFlags = data.red_flags.filter((r) => r.status === 'open' || r.status === 'investigating').length;
  const totalProducts = new Set(data.products.map((p) => getProductFamily(p))).size;
  const totalDocuments = data.documents.length;
  const isEmpty = totalSuppliers === 0 && totalProducts === 0 && totalDocuments === 0;

  const metrics = [
    { label: 'Total de Proveedores', value: totalSuppliers, icon: <Building2 size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Activos', value: activeSuppliers, icon: <TrendingUp size={20} />, onClick: () => navigate('suppliers') },
    { label: 'DD Pendiente', value: ddPending, icon: <ShieldCheck size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Calificado', value: qualified, icon: <ShieldCheck size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Prueba', value: trial, icon: <Package size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Recurrente', value: recurring, icon: <TrendingUp size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Pausados / Rechazados / Archivados', value: pausedRejectedArchived, icon: <Building2 size={20} />, onClick: () => navigate('suppliers') },
    { label: 'Seguimientos Pendientes', value: followUpsDue, icon: <CheckSquare size={20} />, onClick: () => navigate('follow_ups') },
    { label: 'Alertas Abiertas', value: openRedFlags, icon: <AlertTriangle size={20} />, onClick: () => navigate('due_diligence') },
    { label: 'Familias de Productos', value: totalProducts, icon: <Package size={20} />, onClick: () => navigate('products') },
    { label: 'Documentos', value: totalDocuments, icon: <FileText size={20} />, onClick: () => navigate('documents') },
    { label: 'Eventos de Cronología', value: data.timeline.length, icon: <Clock size={20} />, onClick: () => navigate('timeline') },
  ];

  if (isEmpty) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 size={28} />}
          title="Aún no hay inteligencia de procurement"
          message="Registra el primer proveedor. El resumen se completará a medida que incorpores proveedores, productos, ofertas comerciales y debida diligencia."
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
                    <div className="text-2xl font-bold text-[var(--astra-dark)]">{m.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{m.label}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--astra-orange-soft)] text-[var(--astra-orange)]">{m.icon}</div>
                </div>
              </CardBody>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold text-[var(--astra-dark)]">Acciones Requeridas</h3>
            {followUpsDue === 0 && openRedFlags === 0 ? (
              <p className="text-sm text-slate-500">No hay acciones pendientes ni alertas abiertas.</p>
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
            <h3 className="mb-3 text-sm font-semibold text-[var(--astra-dark)]">Desglose del Ciclo de Vida de Proveedores</h3>
            {totalSuppliers === 0 ? (
              <p className="text-sm text-slate-500">No hay proveedores registrados.</p>
            ) : (
              <div className="space-y-1.5">
                {[
                  { label: 'Prospecto', count: data.suppliers.filter((s) => s.lifecycle === 'prospect').length },
                  { label: 'Activo', count: activeSuppliers },
                  { label: 'DD pendiente', count: ddPending },
                  { label: 'Calificado', count: qualified },
                  { label: 'Prueba', count: trial },
                  { label: 'Recurrente', count: recurring },
                  { label: 'Paused / Rejected / Archived', count: pausedRejectedArchived },
                ].map((row) => <div key={row.label} className="flex items-center justify-between text-sm"><span className="text-slate-600">{row.label}</span><span className="font-medium text-[var(--astra-dark)]">{row.count}</span></div>)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
