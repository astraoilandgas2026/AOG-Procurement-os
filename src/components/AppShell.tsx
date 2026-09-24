import { type ReactNode } from 'react';
import { useNav, type ProcurementDomain } from '@/context/NavContext';
import type { PageKey } from '@/types';
import {
  Building2, Users, Package, FlaskConical, DollarSign, Award, FileText,
  ShieldCheck, Truck, Clock, CheckSquare, Network, Droplets, Fuel, ChevronLeft,
} from 'lucide-react';

interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  group: string;
}

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

export function AppShell({ children }: { children: ReactNode }) {
  const { currentPage, navigate, procurementDomain, selectDomain } = useNav();
  const pageInfo = PAGE_TITLES[currentPage];
  const groups = ['Inteligencia', 'Actividad'];

  return (
    <div className="flex min-h-screen bg-white">
      <aside className={`flex w-64 flex-shrink-0 flex-col bg-white text-[var(--astra-dark)] border-r border-[var(--astra-border)] ${procurementDomain ? '' : 'hidden'}`}>
        <div className="border-b border-[var(--astra-border)] px-5 py-5">
          <button onClick={() => navigate('dashboard')} className="flex items-center gap-3 text-left">
            <img
              src="https://astraoilandgas.com/wp-content/uploads/2024/07/Astra_Logo_Horizontal_w-300x118.png"
              alt="Astra Oil and Gas"
              className="h-14 w-auto max-w-[210px] object-contain"
            />
          </button>
        </div>

        {procurementDomain && (
          <nav className="flex-1 overflow-y-auto py-4">
            <button
              onClick={() => { selectDomain(procurementDomain); navigate('dashboard'); }}
              className="mb-4 flex w-full items-center gap-2 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--astra-muted)] hover:text-[var(--astra-dark)]"
            >
              <ChevronLeft size={15} /> Resumen
            </button>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--astra-gray)]">{group}</div>
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-3 border-l-2 px-5 py-2.5 text-sm transition-colors ${currentPage === item.key ? 'border-[var(--astra-red)] bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'border-transparent text-[var(--astra-muted)] hover:bg-slate-50 hover:text-[var(--astra-dark)]'}`}
                  >
                    {item.icon}{item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}

        <div className={`border-t border-[var(--astra-border)] px-5 py-4 ${procurementDomain ? '' : 'hidden'}`}>
          {procurementDomain && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[var(--astra-muted)] border border-[var(--astra-border)]">
              {DOMAIN_META[procurementDomain].icon}
              <span>{DOMAIN_META[procurementDomain].label}</span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-[var(--astra-border)] bg-white px-5 py-4 sm:px-8">
          <div>
            {!procurementDomain ? (
              <button onClick={() => navigate('dashboard')} className="text-left" aria-label="Astra home">
                <img
                  src="https://astraoilandgas.com/wp-content/uploads/2024/07/Astra_Logo_Horizontal_w-300x118.png"
                  alt="Astra Oil and Gas"
                  className="h-16 w-auto max-w-[230px] object-contain"
                />
              </button>
            ) : (
              <>
                <h1 className="text-xl font-bold tracking-tight text-[var(--astra-dark)]">{pageInfo.title}</h1>
                <p className="text-sm text-[var(--astra-muted)]">{pageInfo.subtitle}</p>
              </>
            )}
          </div>
          {procurementDomain && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--astra-dark)]">
              {DOMAIN_META[procurementDomain].icon}{DOMAIN_META[procurementDomain].label}
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
