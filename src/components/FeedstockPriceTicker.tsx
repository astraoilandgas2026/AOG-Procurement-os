import { useCallback, useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';

type Marker = {
  id: string; label: string; basis: string; source: string; url: string;
  status: 'live-proxy' | 'commercial' | 'no-public-benchmark'; symbol?: string;
};
type Quote = { price: number; timestamp: number };

const MARKERS: Marker[] = [
  { id: 'uco', label: 'UCO / AVU', basis: 'Cotización física directa', source: 'Argus UCO assessments', url: 'https://www.argusmedia.com/en/methodology/key-commodity-prices/argus-us-uco-price-assessments', status: 'commercial' },
  { id: 'fatty-acids', label: 'Ácidos grasos', basis: 'Sin benchmark público abierto comparable', source: 'Expana — vegetable oils market data', url: 'https://www.expanamarkets.com/markets/grains-oilseeds-fats/vegetable-oil-prices/', status: 'commercial' },
  { id: 'acid-oils', label: 'Aceites ácidos', basis: 'Cotización física según TFA / calidad', source: 'Expana — vegetable oils market data', url: 'https://www.expanamarkets.com/markets/grains-oilseeds-fats/vegetable-oil-prices/', status: 'commercial' },
  { id: 'vegetable-oils', label: 'Aceites vegetales', basis: 'Proxy de futuros de aceite de soya; no es oferta física', source: 'CME soybean oil futures (ZL=F via Yahoo Finance)', url: 'https://finance.yahoo.com/quote/ZL=F/', status: 'live-proxy', symbol: 'ZL=F' },
  { id: 'degummed-oils', label: 'Aceites desgomados', basis: 'La referencia física requiere especificación y datos licenciados', source: 'Expana — vegetable oils market data', url: 'https://www.expanamarkets.com/markets/grains-oilseeds-fats/vegetable-oil-prices/', status: 'commercial' },
  { id: 'oleins', label: 'Oleínas', basis: 'Benchmark directo abierto no disponible', source: 'Expana — vegetable oils market data', url: 'https://www.expanamarkets.com/markets/grains-oilseeds-fats/vegetable-oil-prices/', status: 'commercial' },
  { id: 'off-spec', label: 'Fuera de especificación / otros', basis: 'No existe un precio único comparable sin especificación', source: 'Requiere composición, FFA/TFA, MIU y origen', url: 'https://www.argusmedia.com/en/', status: 'no-public-benchmark' },
];

const POLL_MS = 5 * 60 * 1000;
function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp * 1000));
}

export function FeedstockPriceTicker() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const symbols = Array.from(new Set(MARKERS.flatMap((marker) => marker.symbol ? [marker.symbol] : [])));
      const results = await Promise.all(symbols.map(async (symbol) => {
        const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=5d&interval=5m', { cache: 'no-store' });
        if (!response.ok) throw new Error('Fuente de mercado no disponible (' + response.status + ')');
        const payload = await response.json();
        const meta = payload?.chart?.result?.[0]?.meta;
        const price = Number(meta?.regularMarketPrice);
        const timestamp = Number(meta?.regularMarketTime);
        if (!Number.isFinite(price) || !Number.isFinite(timestamp)) throw new Error('La fuente no devolvió precio y hora válidos.');
        // CME soybean oil futures are quoted in US cents per pound; convert to USD/metric tonne.
        return [symbol, { price: price * 22.0462262185, timestamp }] as const;
      }));
      setQuotes((previous) => ({ ...previous, ...Object.fromEntries(results) }));
      setUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el marcador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section aria-label="Marcadores de precios feedstock" className="border-b border-[var(--astra-border)] bg-slate-50/80">
      <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={15} className="shrink-0 text-[var(--astra-orange)]" />
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--astra-dark)]">Feedstock price markers</span>
          <span className="hidden text-[10px] text-slate-500 sm:inline">7 familias · USD/MT cuando la fuente lo permite</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar precios">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-8">
        {MARKERS.map((marker) => {
          const quote = marker.symbol ? quotes[marker.symbol] : undefined;
          return (
            <article key={marker.id} className="min-w-[190px] max-w-[230px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-700">{marker.label}</div>
              {quote ? (
                <>
                  <div className="mt-1 text-lg font-bold tabular-nums text-[var(--astra-dark)]">{formatUSD(quote.price)}<span className="ml-1 text-[10px] font-medium text-slate-500">/MT</span></div>
                  <div className="text-[10px] font-semibold text-amber-700">PROXY · aceite de soya</div>
                  <div className="mt-1 text-[10px] text-slate-500">Dato fuente: {formatTime(quote.timestamp)}</div>
                </>
              ) : (
                <>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{marker.status === 'commercial' ? 'Acceso comercial' : 'Sin benchmark único'}</div>
                  <div className="mt-1 text-[10px] leading-snug text-slate-500">{marker.basis}</div>
                </>
              )}
              <a href={marker.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--astra-orange)] hover:underline">
                {marker.source} <ExternalLink size={10} />
              </a>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-slate-500 sm:px-8">
        <span>{error ? 'Actualización fallida: ' + error + '. Se conservan los últimos datos cargados si existen.' : updatedAt ? 'Consulta actualizada: ' + new Date(updatedAt).toLocaleTimeString('es-CL') + '. Refresco automático cada 5 min mientras la app está abierta.' : 'Consultando fuente de mercado…'}</span>
        <span>Los proxies no son ofertas físicas ni precios de compra Astra.</span>
      </div>
    </section>
  );
}
