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

function AstraMark({ size = 80 }: { size?: number }) {
  const petals = [
    ['red', '#E31E24', '#A6191D'],
    ['orange', '#F58220', '#D95B10'],
    ['yellow', '#FDB913', '#E5A00D'],
    ['green', '#00A651', '#007A3D'],
    ['blue', '#00AEEF', '#0072BC'],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <defs>
        {petals.map(([id, a, b]) => (
          <linearGradient key={id} id={`astra-mark-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} />
          </linearGradient>
        ))}
      </defs>
      <g transform="translate(50 50)">
        {[0, 72, 144, 216, 288].map((rotation, i) => (
          <g key={rotation} transform={`rotate(${rotation})`}>
            <path d="M0 0 C-7 -7 -15 -17 -14 -29 C-13 -39 -6 -46 0 -50 C6 -46 13 -39 14 -29 C15 -17 7 -7 0 0Z" fill={`url(#astra-mark-${petals[i][0]})`} />
            <path d="M0 -7 C-4 -15 -7 -24 -4 -35" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}
function AstraLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'flex items-center gap-2.5' : 'flex items-center gap-3.5'}>
      <AstraMark size={compact ? 38 : 50} />
      <span className="leading-none whitespace-nowrap">
        <span className={compact
          ? 'block text-[16px] font-medium tracking-[0.12em] text-black [font-family:Arial_Narrow,Roboto_Condensed,Arial,sans-serif]'
          : 'block text-[19px] font-medium tracking-[0.12em] text-black [font-family:Arial_Narrow,Roboto_Condensed,Arial,sans-serif]'
        }>ASTRA</span>
        <span className={compact
          ? 'block mt-0.5 text-[8px] font-serif font-normal tracking-[0.02em] text-black'
          : 'block mt-0.5 text-[9px] font-serif font-normal tracking-[0.02em] text-black'
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
      <aside className={`flex w-64 flex-shrink-0 flex-col bg-white text-[var(--astra-dark)] border-r border-[var(--astra-border)] ${procurementDomain ? '' : 'hidden'}`}>
        <div className="border-b border-[var(--astra-border)] px-5 py-5">
          <button onClick={goToOverview} className="text-left" aria-label="Volver a dominios">
            <AstraLogo compact />
          </button>
        </div>

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
        <header className="flex flex-shrink-0 items-center justify-between border-b border-[var(--astra-border)] bg-white px-5 py-4 sm:px-8">
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
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
