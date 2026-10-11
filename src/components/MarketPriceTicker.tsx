import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

type MarketQuote = {
  id: string;
  name: string;
  price?: number | null;
  usdPerMt?: number | null;
  unit?: string;
  decimals?: number;
  changePct?: number | null;
  marketTime?: number | null;
  source?: string;
  sourceUrl?: string;
  basis?: string;
  note?: string;
  stale?: boolean;
  status?: string;
};
type PricesFile = { generatedAt?: string | null; delayMinutes?: number; instruments?: MarketQuote[] };
type MarketSector = 'energy' | 'mining';

const CONFIG: Record<MarketSector, { title: string; file: string; label: string }> = {
  energy: { title: 'Precios Energy', file: 'energy-prices.json', label: 'referencias de precios de Energy' },
  mining: { title: 'Precios Metals & Mining', file: 'mining-prices.json', label: 'referencias de precios de Metals & Mining' },
};
const DATA_BASE = 'https://raw.githubusercontent.com/astraoilandgas2026/AOG-Procurement-os/data/';
const POLL_MS = 60 * 1000;

function formatPrice(value: number, unit: string, decimals = 2) {
  const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  if (unit.startsWith('USD/')) return '$' + formatted + '/' + unit.slice(4);
  return formatted + ' ' + unit;
}
function formatUSDPerMt(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value) + '/MT';
}
function formatTime(timestamp: number) {
  const ms = timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
}

export function MarketPriceTicker({ sector }: { sector: MarketSector }) {
  const config = CONFIG[sector];
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(DATA_BASE + config.file + '?t=' + Math.floor(Date.now() / 30000), { cache: 'no-store' });
      if (!response.ok) throw new Error('Market feed unavailable');
      const payload = await response.json() as PricesFile;
      if (!Array.isArray(payload.instruments)) throw new Error('Invalid market feed');
      setQuotes(payload.instruments);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [config.file]);

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
    <section aria-label={config.label} className="shrink-0 border-t border-[var(--astra-border)] bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={13} className="shrink-0 text-[var(--astra-red)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--astra-dark)]">{config.title}</span>
          {hasError && <span className="text-[10px] text-amber-700">Sin conexión</span>}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar referencias de mercado">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 sm:px-5" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
        {quotes.map((quote) => {
          const value = quote.price;
          const unit = quote.unit || 'USD/MT';
          const change = quote.changePct;
          const ChangeIcon = change == null ? Minus : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
          const changeClass = change == null || change === 0 ? 'text-slate-500' : change > 0 ? 'text-emerald-700' : 'text-rose-700';
          const timestamp = quote.marketTime;
          const content = (
            <>
              <div className="flex items-start justify-between gap-1.5">
                <span className="min-w-0 whitespace-normal break-words text-[11px] font-semibold leading-tight text-slate-700 sm:text-[10px]">{quote.name}</span>
                <span className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold ${changeClass}`}>
                  <ChangeIcon size={10} />
                  {change == null ? (quote.stale ? 'Ref. antigua' : 'N/D') : Math.abs(change).toFixed(1) + '%'}
                </span>
              </div>
              <div className="mt-1 whitespace-nowrap text-[15px] font-bold leading-tight tabular-nums text-[var(--astra-dark)] sm:text-[14px]">
                {typeof value === 'number' && Number.isFinite(value) ? formatPrice(value, unit, quote.decimals ?? 2) : 'N/D'}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                <span>{typeof quote.usdPerMt === 'number' && Number.isFinite(quote.usdPerMt) ? formatUSDPerMt(quote.usdPerMt) : quote.stale ? 'Último dato' : quote.status || 'Referencia de mercado'}</span>
                <span>{timestamp ? (quote.stale ? 'Ref. ' : '') + formatTime(timestamp) : ''}</span>
              </div>
            </>
          );
          return quote.sourceUrl ? (
            <a key={quote.id} href={quote.sourceUrl} target="_blank" rel="noreferrer" title={quote.note || quote.basis || quote.name}
              className="w-[205px] min-w-[205px] shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-[210px] sm:min-w-[210px] sm:py-1.5">
              {content}
            </a>
          ) : (
            <div key={quote.id} title={quote.note || quote.basis || quote.name}
              className="w-[205px] min-w-[205px] shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-2 sm:w-[210px] sm:min-w-[210px] sm:py-1.5">
              {content}
            </div>
          );
        })}
        {quotes.length === 0 && <div className="py-2 text-xs text-slate-500">Cargando referencias de mercado…</div>}
      </div>
    </section>
  );
}
