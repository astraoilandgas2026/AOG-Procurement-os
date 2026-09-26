import { type ReactNode } from 'react';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import type { PageKey } from '@/types';
import {
  Building2, Users, Package, DollarSign, Award, FileText,
  ShieldCheck, Truck, Clock, CheckSquare, Network, Droplets, Fuel, Pickaxe,
} from 'lucide-react';

interface NavItem { key: PageKey; label: string; icon: ReactNode; group: string; }

const NAV_ITEMS: NavItem[] = [
  { key: 'suppliers', label: 'Proveedores', icon: <Building2 size={17} />, group: 'Inteligencia' },
  { key: 'contacts', label: 'Contactos', icon: <Users size={17} />, group: 'Inteligencia' },
  { key: 'products', label: 'Productos', icon: <Package size={17} />, group: 'Inteligencia' },
  { key: 'commercial', label: 'Comercial', icon: <DollarSign size={17} />, group: 'Inteligencia' },
  { key: 'certifications', label: 'Certificaciones', icon: <Award size={17} />, group: 'Inteligencia' },
  { key: 'documents', label: 'Documentos', icon: <FileText size={17} />, group: 'Inteligencia' },
  { key: 'due_diligence', label: 'Debida Diligencia', icon: <ShieldCheck size={17} />, group: 'Inteligencia' },
  { key: 'logistics', label: 'Logística', icon: <Truck size={17} />, group: 'Inteligencia' },
  { key: 'timeline', label: 'Cronología', icon: <Clock size={17} />, group: 'Actividad' },
  { key: 'follow_ups', label: 'Seguimientos', icon: <CheckSquare size={17} />, group: 'Actividad' },
  { key: 'intelligence', label: 'Mapa de Inteligencia', icon: <Network size={17} />, group: 'Actividad' },
];

const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Resumen', subtitle: 'Visión general de inteligencia de procurement' },
  suppliers: { title: 'Proveedores', subtitle: 'Perfiles de inteligencia de proveedores' },
  contacts: { title: 'Contactos', subtitle: 'Directorio de contactos de proveedores' },
  products: { title: 'Productos', subtitle: '' },
  commercial: { title: 'Comercial', subtitle: 'Ofertas comerciales y precios' },
  certifications: { title: 'Certificaciones', subtitle: 'Seguimiento de certificaciones y evidencia' },
  documents: { title: 'Documentos', subtitle: 'Gestión de evidencia y documentos' },
  due_diligence: { title: 'Debida Diligencia', subtitle: 'Verificación y riesgos' },
  logistics: { title: 'Logística', subtitle: 'Preparación logística y exportación' },
  timeline: { title: 'Cronología', subtitle: 'Historial de interacciones con proveedores' },
  follow_ups: { title: 'Seguimientos', subtitle: 'Acciones pendientes y próximos pasos' },
  intelligence: { title: 'Mapa de Inteligencia', subtitle: 'Mapa de relaciones e inteligencia' },
};

const DOMAIN_META: Record<ProcurementDomain, { label: string; icon: ReactNode }> = {
  feedstock: { label: 'Feedstock', icon: <Droplets size={16} /> },
  energy_commodities: { label: 'Energy Commodities', icon: <Fuel size={16} /> },
  mining_commodities: { label: 'Mining Commodities', icon: <Pickaxe size={16} /> },
};

function AstraMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}astra-mark.svg`}
      alt="Astra Oil and Gas"
      width={size}
      height={size}
      className="shrink-0 object-contain"
    />
  );
}
function AstraLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? 'h-10' : 'h-12'}`}>
      <AstraMark size={compact ? 30 : 40} />
      <div className="flex flex-col justify-center leading-none whitespace-nowrap">
        <div
          className={`font-bold text-black ${compact ? 'text-[18px] tracking-[0.09em]' : 'text-[23px] sm:text-[24px] tracking-[0.08em]'}`}
          style={{ fontFamily: 'Arial Narrow, Helvetica Neue, Arial, sans-serif', transform: 'scaleX(1.02)', transformOrigin: 'left center' }}
        >
          ASTRA
        </div>
        <div
          className={`mt-1 text-[#808080] ${compact ? 'text-[7px] tracking-[0.08em]' : 'text-[8px] sm:text-[9px] tracking-[0.07em]'}`}
          style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
        >
          Oil and Gas
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate, procurementDomain, goToOverview, selectDomain } = useNav();
  const pageInfo = PAGE_TITLES[currentPage];
  const groups = ['Inteligencia', 'Actividad'];

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
          {procurementDomain && <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--astra-dark)]">{DOMAIN_META[procurementDomain].icon}{DOMAIN_META[procurementDomain].label}</div>}
        </header>
        {procurementDomain && (
          <nav className="flex md:hidden min-w-0 overflow-x-auto border-b border-[var(--astra-border)] bg-white px-3 py-2">
            <div className="flex min-w-max items-center gap-1">
              <button onClick={() => navigate('dashboard')} className={`mr-1 shrink-0 rounded-md px-2.5 py-2 text-xs font-semibold ${currentPage === 'dashboard' ? 'bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'text-[var(--astra-muted)]'}`}>Resumen</button>
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
