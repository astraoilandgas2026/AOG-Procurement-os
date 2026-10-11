import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type MarkerQuote = {
  id: string;
  name: string;
  price?: number | null;
  usdPerMt?: number | null;
  unit?: string;
  decimals?: number;
  changePct?: number | null;
  relativePct?: number | null;
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
  'vegetable-oils': 'Aceite de soya · FOB Paranaguá',
  uco: 'Aceite usado de cocina (UCO/AVU, indicativo)',
  'fatty-acids': 'Ácido oleico 75% mínimo (FOB Malasia)',
  'acid-oils': 'Destilado de ácidos grasos de palma (PFAD)',
  'degummed-oils': 'Aceite crudo de soya desgomado (FOB Argentina)',
  oleins: 'Oleína de palma RBD (FOB Malasia)',
  'off-spec': 'Producto fuera de especificación (sin precio único)',
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

  return (
    <section aria-label="Marcadores de precios de feedstock" className="shrink-0 border-t border-[var(--astra-border)] bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={13} className="shrink-0 text-[var(--astra-red)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--astra-dark)]">Referencias de mercado · Feedstock</span>
          {hasError && <span className="text-[10px] text-amber-700">Sin conexión</span>}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar referencias de mercado">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 sm:gap-2 sm:px-5" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
        {ordered.map((quote) => {
          const value = quote.price;
          const unit = quote.unit || 'USD/MT';
          const comparison = quote.relativePct;
          const change = quote.changePct;
          const shownChange = typeof comparison === 'number' ? comparison : change;
          const ChangeIcon = shownChange == null ? Minus : shownChange > 0 ? TrendingUp : shownChange < 0 ? TrendingDown : Minus;
          const changeClass = shownChange == null || shownChange === 0 ? 'text-slate-500' : shownChange > 0 ? 'text-emerald-700' : 'text-rose-700';
          const timestamp = quote.marketTime;
          const label = LABELS[quote.id] || quote.name;
          return (
            <a key={quote.id} href={quote.sourceUrl || '#'} target="_blank" rel="noreferrer" title={quote.note || quote.basis || label}
              className="w-[205px] min-w-[205px] shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-[210px] sm:min-w-[210px] sm:py-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <span className="min-w-0 whitespace-normal break-words text-[11px] font-semibold leading-tight text-slate-700 sm:text-[10px]">{label}</span>
                <span className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold ${changeClass}`}>
                  <ChangeIcon size={10} />
                  {quote.id === 'vegetable-oils' ? 'FOB' : shownChange == null ? (quote.stale ? 'Ref.' : 'N/D') : Math.abs(shownChange).toFixed(1) + '%'}
                </span>
              </div>
              <div className="mt-1 whitespace-nowrap text-[15px] font-bold leading-tight tabular-nums text-[var(--astra-dark)] sm:text-[14px]">
                {typeof value === 'number' && Number.isFinite(value) ? formatNative(value, unit, quote.decimals ?? 2) : 'N/D'}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                <span>{typeof quote.usdPerMt === 'number' && Number.isFinite(quote.usdPerMt) ? formatUSDPerMt(quote.usdPerMt) : quote.stale ? 'Último dato' : 'Sin equivalente USD/MT'}</span>
                <span>{timestamp ? (quote.stale ? 'Ref. ' : '') + formatTime(timestamp) : ''}</span>
              </div>
            </a>
          );
        })}
        {ordered.length === 0 && <div className="py-2 text-xs text-slate-500">Cargando referencias de mercado…</div>}
      </div>
    </section>
  );
}
