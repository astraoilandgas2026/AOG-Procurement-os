import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type MarkerQuote = {
  id: string;
  name: string;
  price?: number | null;
  usdPerMt?: number | null;
  unit?: string;
  decimals?: number;
  changePct?: number | null;\n  relativePct?: number | null;
  marketTime?: number | null;
  source?: string;
  sourceUrl?: string;
  basis?: string;
  note?: string;
  stale?: boolean;
  status?: string;
};
type PricesFile = { generatedAt?: string | null; delayMinutes?: number; instruments?: MarkerQuote[] };

const ORDER = ['vegetable-oils', 'uco', 'fatty-acids', 'acid-oils', 'degummed-oils', 'oleins', 'off-spec'];
const LABELS: Record<string, string> = {
  'vegetable-oils': 'Aceites vegetales',
  uco: 'UCO / AVU · indicativo',
  'fatty-acids': 'Ácidos grasos',
  'acid-oils': 'Aceites ácidos',
  'degummed-oils': 'Aceites desgomados',
  oleins: 'Oleínas · RBD palm',
  'off-spec': 'Fuera de especificación',
};
const PRICES_URL = 'https://raw.githubusercontent.com/astraoilandgas2026/AOG-Procurement-os/data/prices.json';
const POLL_MS = 60 * 1000;

function formatNative(value: number, unit: string, decimals = 2) {
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  return unit === 'USD/MT' ? '$' + formatted : formatted + ' ' + unit;
}
function formatUSDPerMt(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) + '/MT';
}
function formatTime(timestamp: number) {
  const ms = timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
}

export function FeedstockPriceTicker() {
  const [quotes, setQuotes] = useState<Record<string, MarkerQuote>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(15);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(PRICES_URL + '?t=' + Math.floor(Date.now() / 30000), { cache: 'no-store' });
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json() as PricesFile;
      if (!Array.isArray(payload.instruments)) throw new Error('Invalid feed');
      const next: Record<string, MarkerQuote> = {};
      payload.instruments.forEach((item) => { next[item.id] = item; });
      setQuotes(next);
      setGeneratedAt(payload.generatedAt || null);
      setDelayMinutes(payload.delayMinutes ?? 15);
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

  const ordered = ORDER.map((id) => quotes[id]).filter((item): item is MarkerQuote => Boolean(item));
  const feedAgeMinutes = generatedAt ? (Date.now() - new Date(generatedAt).getTime()) / 60000 : null;

  return (
    <section aria-label="Marcadores de precios y referencias de mercado" className="shrink-0 border-t border-[var(--astra-border)] bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={13} className="shrink-0 text-[var(--astra-red)]" />
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-[var(--astra-dark)]">Market ticker</span>
          <span className="hidden whitespace-nowrap text-[10px] text-slate-500 sm:inline">7 categorías · variación vs benchmark soya</span>
          {feedAgeMinutes != null && feedAgeMinutes > 60 && <span className="whitespace-nowrap text-[10px] text-amber-700">Feed antiguo</span>}
          {hasError && <span className="whitespace-nowrap text-[10px] text-amber-700">Sin conexión al feed</span>}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar referencias de mercado">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 sm:px-5" style={{ scrollbarWidth: 'thin' }}>
        {ordered.map((quote) => {
          const value = quote.price;
          const unit = quote.unit || 'USD/MT';
          const comparison = quote.relativePct;\n          const change = quote.changePct;
          const ChangeIcon = change == null ? Minus : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
          const changeClass = change == null || change === 0 ? 'text-slate-400' : change > 0 ? 'text-emerald-700' : 'text-rose-700';
          const timestamp = quote.marketTime;
          return (
            <a key={quote.id} href={quote.sourceUrl || '#'} target="_blank" rel="noreferrer" title={quote.note || quote.basis || quote.name}
              className="group min-w-[155px] max-w-[205px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 transition-colors hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-semibold text-slate-600">{LABELS[quote.id] || quote.name}</span>
                <span className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold ${changeClass}`}>
                  <ChangeIcon size={10} />{quote.id === 'vegetable-oils' ? 'BASE' : shownChange == null ? (quote.stale ? 'ref. antigua' : 'N/D') : Math.abs(shownChange).toFixed(1) + '% vs soya'}
                </span>
              </div>
              <div className="mt-0.5 whitespace-nowrap text-[14px] font-bold leading-tight tabular-nums text-[var(--astra-dark)]">
                {typeof value === 'number' && Number.isFinite(value) ? formatNative(value, unit, quote.decimals ?? 2) : 'N/D'}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] text-slate-500">
                <span className="truncate">{typeof quote.usdPerMt === 'number' && Number.isFinite(quote.usdPerMt) ? formatUSDPerMt(quote.usdPerMt) : quote.stale ? 'Último dato' : 'Sin equivalente USD/MT'}</span>
                <span className="shrink-0">{timestamp ? (quote.stale ? 'ref. ' : '') + formatTime(timestamp) : ''}</span>
              </div>
            </a>
          );
        })}
        {ordered.length === 0 && <div className="py-2 text-xs text-slate-500">Cargando referencias de mercado…</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 pb-1.5 text-[9px] text-slate-500 sm:px-5">
        <span>{generatedAt ? 'Feed: ' + new Date(generatedAt).toLocaleString('es-CL') + ' · actualización cada 15 min; lectura de app cada 1 min.' : 'Esperando el primer feed de precios.'}</span>
        <span>UCO es indicativo (ULSD + spread de referencia), no oferta física. Valores en unidades originales y equivalencia aproximada USD/MT.</span>
      </div>
    </section>
  );
}
