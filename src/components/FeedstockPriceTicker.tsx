import { useCallback, useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';

type MarkerQuote = {
  id: string;
  name: string;
  price?: number | null;
  usdPerMt?: number | null;
  marketTime?: number | null;
  source?: string;
  sourceUrl?: string;
  basis?: string;
  note?: string;
  stale?: boolean;
  status?: string;
};
type PricesFile = { generatedAt?: string | null; instruments?: MarkerQuote[] };

const MARKERS = [
  { id: 'uco', label: 'UCO / AVU', fallbackBasis: 'Proxy bursátil de aceite vegetal', fallbackNote: 'No hay futuro público líquido de UCO; no equivale a una oferta física.' },
  { id: 'fatty-acids', label: 'Ácidos grasos', fallbackBasis: 'Proxy de aceite de soya', fallbackNote: 'No es una cotización específica de ácidos grasos.' },
  { id: 'acid-oils', label: 'Aceites ácidos', fallbackBasis: 'Proxy de aceite de soya', fallbackNote: 'No refleja descuentos por FFA, humedad, impurezas ni calidad.' },
  { id: 'vegetable-oils', label: 'Aceites vegetales', fallbackBasis: 'Futuro de aceite de soya convertido a USD/MT', fallbackNote: 'Benchmark financiero; no equivale a aceite físico FOB.' },
  { id: 'degummed-oils', label: 'Aceites desgomados', fallbackBasis: 'Proxy de aceite de soya', fallbackNote: 'No incluye prima por proceso, origen ni Incoterm.' },
  { id: 'oleins', label: 'Oleínas', fallbackBasis: 'Futuro de palma o proxy alternativo claramente indicado', fallbackNote: 'El proxy no sustituye una cotización física de oleína.' },
  { id: 'off-spec', label: 'Fuera de especificación / otros', fallbackBasis: 'Proxy de aceite de soya', fallbackNote: 'La valoración final depende de especificación y análisis de laboratorio.' },
] as const;

const PRICES_URL = 'https://raw.githubusercontent.com/astraoilandgas2026/AOG-Procurement-os/data/prices.json';
const POLL_MS = 5 * 60 * 1000;

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp * 1000));
}

export function FeedstockPriceTicker() {
  const [quotes, setQuotes] = useState<Record<string, MarkerQuote>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(PRICES_URL + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
      if (!response.ok) throw new Error('Price feed unavailable');
      const payload = await response.json() as PricesFile;
      if (!Array.isArray(payload.instruments)) throw new Error('Invalid price feed');
      const next: Record<string, MarkerQuote> = {};
      payload.instruments.forEach((item) => { next[item.id] = item; });
      setQuotes((previous) => ({ ...previous, ...next }));
      setGeneratedAt(payload.generatedAt || null);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return (
    <section aria-label="Marcadores de precios feedstock" className="border-b border-[var(--astra-border)] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={15} className="shrink-0 text-[var(--astra-orange)]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--astra-dark)]">Feedstock price markers</span>
          <span className="hidden text-[10px] text-slate-500 sm:inline">7 referencias · USD/MT · proxies identificados</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar precios">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2 sm:px-8 xl:grid-cols-4">
        {MARKERS.map((marker) => {
          const quote = quotes[marker.id];
          const value = quote?.usdPerMt ?? quote?.price;
          const timestamp = quote?.marketTime;
          const sourceUrl = quote?.sourceUrl || 'https://finance.yahoo.com/quote/ZL=F/';
          return (
            <article key={marker.id} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-700">{marker.label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-[var(--astra-dark)]">
                {typeof value === 'number' && Number.isFinite(value) ? formatUSD(value) : 'N/D'}
                <span className="ml-1 text-[10px] font-medium text-slate-500">/MT</span>
              </div>
              <div className="mt-1 text-[10px] font-medium leading-snug text-slate-600">{quote?.basis || marker.fallbackBasis}</div>
              <div className="mt-1 text-[10px] text-slate-500">
                {quote?.stale ? 'Último dato conservado · desactualizado' : timestamp ? 'Mercado: ' + formatTime(timestamp) : 'Esperando primera cotización'}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-slate-500">{quote?.note || marker.fallbackNote}</div>
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--astra-orange)] hover:underline">
                {quote?.source || 'Fuente de referencia'} <ExternalLink size={10} />
              </a>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-slate-500 sm:px-8">
        <span>{hasError ? 'No se pudo refrescar el feed; se mantiene el último dato disponible.' : generatedAt ? 'Feed generado: ' + new Date(generatedAt).toLocaleString('es-CL') + ' · consulta cada 5 min.' : 'Consultando el feed de mercado…'}</span>
        <span>Referencia indicativa, no oferta de proveedor. Validar producto, especificación, origen e Incoterm.</span>
      </div>
    </section>
  );
}
