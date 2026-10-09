import { useEffect, useState, type FormEvent } from 'react';
import { NavProvider, useNav } from '@/context/NavContext';
import { AppShell } from '@/components/AppShell';
import { lazy, Suspense, type ComponentType } from 'react';
import { getSupabaseClient } from '@/data/supabase-client';
import type { PageKey } from '@/types';
import type { Session } from '@supabase/supabase-js';

const PAGES: Record<PageKey, ComponentType> = {
  dashboard: lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))),
  suppliers: lazy(() => import('@/pages/SuppliersPage').then(m => ({ default: m.SuppliersPage }))),
  contacts: lazy(() => import('@/pages/ContactsPage').then(m => ({ default: m.ContactsPage }))),
  products: lazy(() => import('@/pages/ProductsPage').then(m => ({ default: m.ProductsPage }))),
  commercial: lazy(() => import('@/pages/CommercialPage').then(m => ({ default: m.CommercialPage }))),
  certifications: lazy(() => import('@/pages/CertificationsPage').then(m => ({ default: m.CertificationsPage }))),
  documents: lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage }))),
  due_diligence: lazy(() => import('@/pages/DueDiligencePage').then(m => ({ default: m.DueDiligencePage }))),
  logistics: lazy(() => import('@/pages/LogisticsPage').then(m => ({ default: m.LogisticsPage }))),
  timeline: lazy(() => import('@/pages/TimelinePage').then(m => ({ default: m.TimelinePage }))),
  follow_ups: lazy(() => import('@/pages/FollowUpsPage').then(m => ({ default: m.FollowUpsPage }))),
  intelligence: lazy(() => import('@/pages/IntelligencePage').then(m => ({ default: m.IntelligencePage }))),
  astra_documentation: lazy(() => import('@/pages/AstraDocumentationPage').then(m => ({ default: m.AstraDocumentationPage }))),
};

function PageRenderer() {
  const { currentPage } = useNav();
  const Page = PAGES[currentPage];
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Cargando…</div>}>
      <Page />
    </Suspense>
  );
}

function AccessGate() {
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('astraoilandgas9@gmail.com');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) {
      setError('Supabase no está configurado. La aplicación no puede cargar datos.');
      setCheckingSession(false);
      return;
    }
    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setCheckingSession(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : 'No se pudo comprobar la sesión.');
      setCheckingSession(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSent(false);
      setError('');
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !email.trim()) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.href.split('#')[0],
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo enviar el enlace de acceso.');
    } finally {
      setSending(false);
    }
  }

  if (checkingSession) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">Comprobando acceso seguro…</div>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex justify-center">
            <img src={`${import.meta.env.BASE_URL}astra-logo.svg?v=20261009b`} alt="Astra Oil and Gas" className="h-auto w-52" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Acceso seguro a Procurement OS</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La base de datos conserva la información. Para proteger proveedores, contactos, ofertas y debida diligencia, inicia sesión con el correo autorizado de Astra.
          </p>
          <form onSubmit={sendLink} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Correo autorizado
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </label>
            <button type="submit" disabled={sending || !email.trim()} className="w-full rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {sending ? 'Enviando enlace…' : 'Enviar enlace de acceso'}
            </button>
          </form>
          {sent && <p role="status" className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">Solicitud enviada. Abre el enlace recibido en este mismo navegador para recuperar el acceso a todos los módulos.</p>}
          {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-500">No se borraron los registros. El acceso a los datos exige una sesión autorizada; no se habilitará acceso público a información comercial sensible.</p>
        </section>
      </main>
    );
  }

  return (
    <NavProvider>
      <AppShell>
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => { void client?.auth.signOut(); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
        <PageRenderer />
      </AppShell>
    </NavProvider>
  );
}

export default function App() {
  return <AccessGate />;
}
