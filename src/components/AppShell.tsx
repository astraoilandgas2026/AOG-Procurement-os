import { type ReactNode } from 'react';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import type { PageKey } from '@/types';
import { InstallAppButton } from '@/components/InstallAppButton';
import {
  Building2, Users, Package, DollarSign, Award, FileText,
  ShieldCheck, Truck, Clock, CheckSquare, Network, Droplets, Fuel, Pickaxe, FlaskConical, Wheat, Archive,
} from 'lucide-react';

interface NavItem { key: PageKey; label: string; icon: ReactNode; group: string; }

const NAV_ITEMS: NavItem[] = [
  { key: 'suppliers', label: 'Proveedores', icon: <Building2 size={17} />, group: 'Procurement' },
  { key: 'contacts', label: 'Contactos', icon: <Users size={17} />, group: 'Procurement' },
  { key: 'products', label: 'Productos', icon: <Package size={17} />, group: 'Procurement' },
  { key: 'commercial', label: 'Comercial', icon: <DollarSign size={17} />, group: 'Comercial' },
  { key: 'certifications', label: 'Certificaciones', icon: <Award size={17} />, group: 'Evidence & DD' },
  { key: 'documents', label: 'Documentos', icon: <FileText size={17} />, group: 'Evidence & DD' },
  { key: 'due_diligence', label: 'Debida Diligencia', icon: <ShieldCheck size={17} />, group: 'Evidence & DD' },
  { key: 'astra_documentation', label: 'Documentación Astra', icon: <Archive size={17} />, group: 'Astra' },
];

const groups = ['Procurement', 'Comercial', 'Evidence & DD', 'Astra'];

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Command Center', subtitle: 'Visión operativa de procurement e inteligencia comercial' },
  suppliers: { title: 'Proveedores', subtitle: 'Perfiles de inteligencia de proveedores' },
  contacts: { title: 'Contactos', subtitle: 'Directorio de contactos de proveedores' },
  products: { title: 'Productos', subtitle: 'Familias y variantes comerciales normalizadas' },
  commercial: { title: 'Comercial', subtitle: 'Ofertas comerciales y precios' },
  certifications: { title: 'Certificaciones', subtitle: 'Seguimiento de certificaciones y evidencia' },
  documents: { title: 'Documentos', subtitle: 'Gestión de evidencia y documentos' },
  due_diligence: { title: 'Debida Diligencia', subtitle: 'Verificación y riesgos' },
  logistics: { title: 'Logística', subtitle: 'Preparación logística y exportación' },
  timeline: { title: 'Cronología', subtitle: 'Historial de interacciones con proveedores' },
  follow_ups: { title: 'Seguimientos', subtitle: 'Acciones pendientes y próximos pasos' },
  intelligence: { title: 'Mapa de Inteligencia', subtitle: 'Mapa de relaciones e inteligencia' },
  astra_documentation: { title: 'Documentación Astra', subtitle: 'Documentación corporativa oficial y versiones vigentes' },
};

const DOMAIN_META: Record<ProcurementDomain, { label: string; icon: ReactNode }> = {
  feedstock: { label: 'Feedstock', icon: <Droplets size={16} /> },
  energy_commodities: { label: 'Energy', icon: <Fuel size={16} /> },
  mining_commodities: { label: 'Metals & Mining', icon: <Pickaxe size={16} /> },
  fertilizers_chemicals: { label: 'Fertilizers & Chemicals', icon: <FlaskConical size={16} /> },
  agricultural_commodities: { label: 'Agricultural', icon: <Wheat size={16} /> },
};

/* Official Astra Oil and Gas logo asset */
// Responsive official Astra brand mark
function AstraLogo({ compact = false }: { compact?: boolean }) {
  const src = `${import.meta.env.BASE_URL}astra-logo.svg?v=20261004a`;
  return (
    <img
      src={src}
      alt="Astra Oil and Gas"
      className={compact ? 'block h-auto w-[150px]' : 'block h-auto w-[220px] sm:w-[240px]'}
      draggable={false}
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate, procurementDomain, goToOverview, selectDomain } = useNav();
  const pageInfo = PAGE_TITLES[currentPage];


  return (
    <div className="flex min-h-screen bg-white">
      {procurementDomain && (
        <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white text-[var(--astra-dark)] border-r border-[var(--astra-border)]">
          <div className="border-b border-[var(--astra-border)] px-5 py-5">
            <button onClick={goToOverview} className="flex w-full items-center text-left" aria-label="Astra home">
              <AstraLogo compact />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <button onClick={() => navigate('dashboard')}
              className={`mb-4 flex w-full items-center gap-2 px-5 text-xs font-semibold uppercase tracking-wider ${currentPage === 'dashboard' ? 'text-[var(--astra-red)]' : 'text-[var(--astra-muted)] hover:text-[var(--astra-dark)]'}`}>
              Resumen
            </button>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--astra-gray)]">{group}</div>
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                  <button key={item.key} onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-3 border-l-2 px-5 py-2.5 text-sm transition-colors ${currentPage === item.key ? 'border-[var(--astra-red)] bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'border-transparent text-[var(--astra-muted)] hover:bg-slate-50 hover:text-[var(--astra-dark)]'}`}>
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-[var(--astra-border)] px-5 py-4">
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[var(--astra-muted)] border border-[var(--astra-border)]">
              {DOMAIN_META[procurementDomain].icon}<span>{DOMAIN_META[procurementDomain].label}</span>
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className={`flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--astra-border)] bg-white px-4 py-3 sm:px-8 sm:py-4 ${procurementDomain ? 'justify-between' : 'justify-center'}`}>
          <div>
            {!procurementDomain ? (
              <button onClick={goToOverview} className="text-left" aria-label="Astra home">
                <AstraLogo />
              </button>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-[var(--astra-dark)]">{pageInfo.title}</h1>
                {pageInfo.subtitle && <p className="text-sm text-[var(--astra-muted)]">{pageInfo.subtitle}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(Object.keys(DOMAIN_META) as ProcurementDomain[]).map((domain) => (
                    <button
                      key={domain}
                      onClick={() => selectDomain(domain)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${domain === procurementDomain ? 'border-[var(--astra-red)] bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'border-slate-200 text-[var(--astra-muted)] hover:bg-slate-50'}`}
                    >
                      {DOMAIN_META[domain].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <InstallAppButton />
            {procurementDomain && <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--astra-dark)]">{DOMAIN_META[procurementDomain].icon}{DOMAIN_META[procurementDomain].label}</div>}
          </div>
        </header>
        {procurementDomain && (
          <nav className="flex md:hidden min-w-0 overflow-x-auto border-b border-[var(--astra-border)] bg-white px-3 py-2">
            <div className="flex min-w-max items-center gap-1">
              <button onClick={() => navigate('dashboard')} className={`mr-1 shrink-0 rounded-md px-2.5 py-2 text-xs font-semibold ${currentPage === 'dashboard' ? 'bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'text-[var(--astra-muted)]'}`}>Command Center</button>
              {NAV_ITEMS.map((item) => (
                <button key={item.key} onClick={() => navigate(item.key)}
                  className={`shrink-0 rounded-md px-2.5 py-2 text-xs font-medium ${currentPage === item.key ? 'bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'text-[var(--astra-muted)] hover:bg-slate-50'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          {procurementDomain ? children : <div className="mx-auto w-full max-w-7xl">{children}</div>}
        </main>
      </div>
    </div>
  );
}
