import { useCallback, useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';

type Marker = {
  id: string; label: string; basis: string; source: string; url: string;
  price?: number; date?: string; note: string; symbol?: string;
};
type Quote = { price: number; timestamp: number };

const MARKERS: Marker[] = [
  { id: 'uco', label: 'UCO / AVU', price: 1554, date: '09 oct 2026', basis: 'EE. UU. · benchmark UCO, convertido a USD/MT', note: 'Referencia financiera; no es UCO FOB Brasil.', source: 'Cbonds / Fastmarkets UCO index', url: 'https://cbonds.com/indexes/194209/' },
  { id: 'fatty-acids', label: 'Ácidos grasos', price: 2757, date: 'Q2 2026', basis: 'Brasil · ácidos grasos, precio regional publicado', note: 'Dato trimestral publicado; no es necesariamente residuo ácido.', source: 'IMARC Group', url: 'https://www.imarcgroup.com/fatty-acid-pricing-report' },
  { id: 'acid-oils', label: 'Aceites ácidos', price: 782.4, date: 'oct 2023', basis: 'Chile · importación histórica de aceite ácido vegetal / olein mix', note: 'Operación histórica; NO usar como precio actual de compra.', source: 'Volza · registro comercial publicado', url: 'https://www.volza.com/p/vegetable-acid-oil/import-data/imports-in-chile/' },
  { id: 'vegetable-oils', label: 'Aceites vegetales', basis: 'Futuro de aceite de soya convertido a USD/MT', note: 'Proxy bursátil; no equivale a aceite físico FOB.', source: 'CME Soybean Oil Futures via Yahoo Finance', url: 'https://finance.yahoo.com/quote/ZL=F/', symbol: 'ZL=F' },
  { id: 'degummed-oils', label: 'Aceites desgomados', basis: 'Proxy de aceite de soya convertido a USD/MT', note: 'No es una cotización específica de aceite desgomado.', source: 'CME Soybean Oil Futures via Yahoo Finance', url: 'https://finance.yahoo.com/quote/ZL=F/', symbol: 'ZL=F' },
  { id: 'oleins', label: 'Oleínas', price: 1145.5, date: 'ago 2026', basis: 'Malasia · RBD palm olein FOB, USD/MT', note: 'Referencia mensual publicada; no es oleína ácida.', source: 'Procurement Resource', url: 'https://www.procurementresource.com/resource-center/rbd-palm-olein-price-trends' },
  { id: 'off-spec', label: 'Fuera de especificación / otros', price: 782.4, date: 'oct 2023', basis: 'Proxy histórico de aceite ácido vegetal / olein mix importado en Chile', note: 'Solo referencia histórica de transacción; requiere especificación para comparar.', source: 'Volza · registro comercial publicado', url: 'https://www.volza.com/p/vegetable-acid-oil/import-data/imports-in-chile/' },
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
        // Soybean oil futures are quoted in US cents per pound; conversion to USD/metric tonne.
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
          <span className="hidden text-[10px] text-slate-500 sm:inline">7 familias · USD/MT · fecha y base visibles</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 disabled:opacity-50" aria-label="Actualizar precios">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-8">
        {MARKERS.map((marker) => {
          const quote = marker.symbol ? quotes[marker.symbol] : undefined;
          const price = quote?.price ?? marker.price;
          return (
            <article key={marker.id} className="min-w-[210px] max-w-[250px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-700">{marker.label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-[var(--astra-dark)]">{price == null ? 'Sin dato numérico' : formatUSD(price)}<span className="ml-1 text-[10px] font-medium text-slate-500">/MT</span></div>
              <div className="mt-1 text-[10px] font-medium leading-snug text-slate-600">{marker.basis}</div>
              <div className="mt-1 text-[10px] font-semibold text-amber-700">{quote ? 'PROXY DE MERCADO · dinámico' : 'REFERENCIA PUBLICADA · no tiempo real'}</div>
              <div className="mt-1 text-[10px] text-slate-500">{quote ? 'Dato fuente: ' + formatTime(quote.timestamp) : 'Fecha de referencia: ' + marker.date}</div>
              <div className="mt-1 text-[10px] leading-snug text-slate-500">{marker.note}</div>
              <a href={marker.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--astra-orange)] hover:underline">
                {marker.source} <ExternalLink size={10} />
              </a>
            </article>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-[10px] text-slate-500 sm:px-8">
        <span>{error ? 'No se pudo actualizar el proxy: ' + error + '. Se conserva la última cotización si existe.' : updatedAt ? 'Proxy consultado: ' + new Date(updatedAt).toLocaleTimeString('es-CL') + '. Consulta cada 5 min mientras la app está abierta.' : 'Consultando proxy bursátil…'}</span>
        <span>Referencias con distinta calidad, región y fecha: comparar base, especificación e Incoterm antes de comprar.</span>
      </div>
    </section>
  );
}
