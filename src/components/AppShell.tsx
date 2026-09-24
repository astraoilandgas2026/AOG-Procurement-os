import { type ReactNode } from 'react';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import type { PageKey } from '@/types';
import {
  Building2, Users, Package, FlaskConical, DollarSign, Award, FileText,
  ShieldCheck, Truck, Clock, CheckSquare, Network, Droplets, Fuel, ChevronLeft,
} from 'lucide-react';

interface NavItem { key: PageKey; label: string; icon: ReactNode; group: string; }

const NAV_ITEMS: NavItem[] = [
  { key: 'suppliers', label: 'Proveedores', icon: <Building2 size={17} />, group: 'Inteligencia' },
  { key: 'contacts', label: 'Contactos', icon: <Users size={17} />, group: 'Inteligencia' },
  { key: 'products', label: 'Productos', icon: <Package size={17} />, group: 'Inteligencia' },
  { key: 'technical', label: 'Técnico', icon: <FlaskConical size={17} />, group: 'Inteligencia' },
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
  products: { title: 'Productos', subtitle: 'Registro de materias primas y productos' },
  technical: { title: 'Técnico', subtitle: 'Especificaciones técnicas y parámetros de calidad' },
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
};

function AstraLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-2.5' : 'flex items-center gap-2.5 sm:gap-3'}>
      <img
        src="/AOG-Procurement-os/astra-mark.svg"
        alt="Astra Oil and Gas"
        className={compact ? 'h-9 w-9 shrink-0' : 'h-9 w-9 sm:h-11 sm:w-11 shrink-0'}
      />
      <span className="leading-none whitespace-nowrap">
        <span className={compact
          ? 'block text-[16px] font-normal tracking-[0.08em] text-black'
          : 'block text-[17px] sm:text-[19px] font-normal tracking-[0.08em] text-black'
        }>ASTRA</span>
        <span className={compact
          ? 'block mt-1 text-[9px] font-normal tracking-[0.01em] text-[var(--astra-gray)]'
          : 'block mt-1 text-[9px] sm:text-[10px] font-normal tracking-[0.01em] text-[var(--astra-gray)]'
        }>Oil and Gas</span>
      </span>
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate, procurementDomain, goToOverview } = useNav();
  const pageInfo = PAGE_TITLES[currentPage];
  const groups = ['Inteligencia', 'Actividad'];

  return (
    <div className="flex min-h-screen bg-white">
      <aside className={`hidden md:flex w-64 flex-shrink-0 flex-col bg-white text-[var(--astra-dark)] border-r border-[var(--astra-border)] ${procurementDomain ? '' : 'hidden'}`}>
        {procurementDomain && (
          <nav className="flex-1 overflow-y-auto py-4">
            <button
              onClick={goToOverview}
              className="mb-4 flex w-full items-center gap-2 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--astra-muted)] hover:text-[var(--astra-dark)]"
            >
              <ChevronLeft size={15} /> Dominios
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
        )}

        <div className={`border-t border-[var(--astra-border)] px-5 py-4 ${procurementDomain ? '' : 'hidden'}`}>
          {procurementDomain && <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[var(--astra-muted)] border border-[var(--astra-border)]">{DOMAIN_META[procurementDomain].icon}<span>{DOMAIN_META[procurementDomain].label}</span></div>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--astra-border)] bg-white px-4 py-3 sm:px-8 sm:py-4">
          <div>
            {!procurementDomain ? (
              <button onClick={goToOverview} className="text-left" aria-label="Astra home">
                <AstraLogo />
              </button>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-[var(--astra-dark)]">{pageInfo.title}</h1>
                <p className="text-sm text-[var(--astra-muted)]">{pageInfo.subtitle}</p>
                <button onClick={goToOverview} className="mt-1 text-xs font-semibold text-[var(--astra-blue)] hover:underline">
                  Volver a Feedstock / Energy Commodities
                </button>
              </>
            )}
          </div>
          {procurementDomain && <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--astra-dark)]">{DOMAIN_META[procurementDomain].icon}{DOMAIN_META[procurementDomain].label}</div>}
        </header>
        {procurementDomain && (
          <nav className="flex md:hidden min-w-0 overflow-x-auto border-b border-[var(--astra-border)] bg-white px-3 py-2">
            <div className="flex min-w-max items-center gap-1">
              <button onClick={goToOverview} className="mr-1 shrink-0 rounded-md px-2.5 py-2 text-xs font-semibold text-[var(--astra-muted)]">Dominios</button>
              {NAV_ITEMS.map((item) => (
                <button key={item.key} onClick={() => navigate(item.key)}
                  className={`shrink-0 rounded-md px-2.5 py-2 text-xs font-medium ${currentPage === item.key ? 'bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'text-[var(--astra-muted)] hover:bg-slate-50'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
