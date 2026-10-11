import fs from 'node:fs/promises';
import path from 'node:path';

const outputPath = path.resolve(process.argv[2] || 'prices.json');
const old = await fs.readFile(outputPath, 'utf8').then(JSON.parse).catch(() => ({ instruments: [] }));
const oldById = new Map((old.instruments || []).map((item) => [item.id, item]));
const UCO_SPREAD_USD_MT = Number.isFinite(Number(process.env.UCO_DIESEL_SPREAD_USD_MT))
  && process.env.UCO_DIESEL_SPREAD_USD_MT !== ''
  ? Number(process.env.UCO_DIESEL_SPREAD_USD_MT)
  : 68; // Public cross-check on 2026-10-09: US UCO index $0.705/lb vs ULSD $4.7384/gal.

const definitions = [
  { id: 'soy_oil', name: 'Aceite de soya', symbol: 'ZL=F', stooq: 'zl.f', unit: '¢/lb', factor: 22.0462262185, decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'CBOT · futuro, cents/lb; USD/MT = ¢/lb × 22.046226', note: 'Futuro financiero, no oferta física FOB.' },
  { id: 'ulsd', name: 'Diésel ULSD', symbol: 'HO=F', stooq: 'ho.f', unit: 'USD/gal', factor: 313.7, decimals: 4, sourceUrl: 'https://finance.yahoo.com/quote/HO=F/', basis: 'NYMEX · USD/gal; referencia equivalente aproximada USD/MT = precio × 313.7', note: 'La conversión por masa es aproximada; depende de densidad.' },
  { id: 'canola', name: 'Canola', symbol: 'RS=F', stooq: 'rs.f', fx: 'USDCAD=X', unit: 'CAD/MT', factor: 1, decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/RS=F/', basis: 'ICE · CAD/MT convertido a USD/MT con USDCAD', note: 'Benchmark de canola; no se reutiliza el precio de soya si esta fuente falla.' },
  { id: 'palm_oil', name: 'Aceite de palma', symbol: 'FCPO=F', stooq: 'fcpo.f', fx: 'USDMYR=X', unit: 'MYR/MT', factor: 1, decimals: 2, sourceUrl: 'https://www.bursamalaysia.com/market_information/derivatives_prices', basis: 'Bursa Malaysia · MYR/MT convertido a USD/MT con USDMYR', note: 'Si el símbolo público no responde, se marca desactualizado; no se sustituye por otro aceite.' },
  { id: 'brent', name: 'Brent', symbol: 'BZ=F', stooq: 'bz.f', unit: 'USD/bbl', factor: 7.33, decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/BZ=F/', basis: 'ICE Brent · USD/bbl; conversión comparativa aproximada USD/MT = precio × 7.33', note: 'Equivalencia aproximada para comparación; no es una cotización de feedstock.' },
  { id: 'wti', name: 'WTI', symbol: 'CL=F', stooq: 'cl.f', unit: 'USD/bbl', factor: 7.33, decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/CL=F/', basis: 'NYMEX WTI · USD/bbl; conversión comparativa aproximada USD/MT = precio × 7.33', note: 'Equivalencia aproximada para comparación; no es una cotización de feedstock.' },
];

async function yahoo(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=5d&interval=1d';
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('Yahoo HTTP ' + response.status + ' ' + symbol);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo sin resultado ' + symbol);
  const quote = result.indicators?.quote?.[0];
  const price = Number(result.meta?.regularMarketPrice ?? quote?.close?.filter(Number.isFinite).at(-1));
  const prevClose = Number(result.meta?.previousClose ?? result.meta?.chartPreviousClose);
  const timestamp = Number(result.meta?.regularMarketTime ?? result.timestamp?.at(-1));
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) throw new Error('Cotización inválida ' + symbol);
  return { price, prevClose: Number.isFinite(prevClose) && prevClose > 0 ? prevClose : null, timestamp, currency: result.meta?.currency || '', provider: 'Yahoo Finance' };
}

async function stooq(symbol) {
  const url = 'https://stooq.com/q/l/?s=' + encodeURIComponent(symbol) + '&f=sd2t2c&h&e=csv';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Stooq HTTP ' + response.status + ' ' + symbol);
  const rows = (await response.text()).trim().split(/\r?\n/);
  const fields = rows[1]?.split(',');
  const price = Number(fields?.[3]);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Stooq sin cotización ' + symbol);
  const parsed = fields?.[1] ? Date.parse(fields[1] + 'T' + (fields[2] || '00:00') + 'Z') : Date.now();
  return { price, prevClose: null, timestamp: Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000), currency: '', provider: 'Stooq' };
}

const cache = new Map();
async function quote(symbol, stooqSymbol) {
  const key = symbol + '|' + stooqSymbol;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      try { return await yahoo(symbol); }
      catch (first) {
        if (!stooqSymbol) throw first;
        return stooq(stooqSymbol);
      }
    })());
  }
  return cache.get(key);
}

async function fxRate(symbol) {
  const q = await yahoo(symbol);
  if (!Number.isFinite(q.price) || q.price <= 0) throw new Error('FX inválido ' + symbol);
  return q.price;
}

const instruments = [];
const byId = {};
for (const def of definitions) {
  const previous = oldById.get(def.id);
  let q = null;
  try { q = await quote(def.symbol, def.stooq); } catch {}

  if (!q) {
    if (previous) {
      let preserved = { ...previous, stale: true, status: 'Último dato conservado; fuente automática sin respuesta.' };
      if (typeof previous.price === 'number' && def.fx) {
        try {
          const fx = await fxRate(def.fx);
          preserved.usdPerMt = previous.price / fx;
        } catch {}
      }
      instruments.push(preserved);
      byId[def.id] = preserved;
    } else {
      const item = {
        id: def.id, name: def.name, symbol: def.symbol, price: null, prevClose: null,
        changePct: null, unit: def.unit, decimals: def.decimals, usdPerMt: null,
        marketTime: null, source: 'Fuente no disponible', sourceUrl: def.sourceUrl,
        basis: def.basis, note: 'Sin cotización verificable; no se inventa ni se sustituye por otro producto.',
        stale: true, status: 'Cotización no disponible'
      };
      instruments.push(item);
      byId[def.id] = item;
    }
    continue;
  }

  let usdPerMt = null;
  if (def.id === 'soy_oil') usdPerMt = q.price * def.factor;
  else if (def.id === 'ulsd') usdPerMt = q.price * def.factor;
  else if (def.id === 'brent' || def.id === 'wti') usdPerMt = q.price * def.factor;
  else if (def.fx) {
    try { usdPerMt = q.price / await fxRate(def.fx); } catch { usdPerMt = null; }
  }

  let prevUsdPerMt = null;
  if (q.prevClose != null) {
    if (def.id === 'soy_oil' || def.id === 'ulsd' || def.id === 'brent' || def.id === 'wti') prevUsdPerMt = q.prevClose * def.factor;
    else if (def.fx) {
      try { prevUsdPerMt = q.prevClose / await fxRate(def.fx); } catch { prevUsdPerMt = null; }
    }
  }
  const item = {
    id: def.id, name: def.name, symbol: def.symbol, price: q.price,
    prevClose: q.prevClose, changePct: q.prevClose != null ? ((q.price - q.prevClose) / q.prevClose) * 100 : null,
    unit: def.unit, decimals: def.decimals, usdPerMt, prevUsdPerMt,
    marketTime: q.timestamp, source: q.provider, sourceUrl: def.sourceUrl,
    basis: def.basis, note: def.note, stale: false, status: 'Actualizado'
  };
  instruments.push(item);
  byId[def.id] = item;
}

const ulsd = byId.ulsd;
let uco;
if (typeof ulsd?.usdPerMt === 'number' && Number.isFinite(ulsd.usdPerMt)) {
  const usdPerMt = ulsd.usdPerMt + UCO_SPREAD_USD_MT;
  uco = {
    id: 'uco', name: 'UCO / AVU indicativo', symbol: 'HO=F + spread', price: usdPerMt,
    prevClose: null, changePct: null, unit: 'USD/MT', decimals: 0,
    usdPerMt, marketTime: ulsd.marketTime, source: 'Modelo indicativo: ULSD + diferencial UCO',
    sourceUrl: 'https://www.fastmarkets.com/insights/european-uco-and-animal-fat-prices-jump-on-strong-demand-and-geopolitical-tensions/',
    basis: 'ULSD convertido a USD/MT + diferencial indicativo de US$' + UCO_SPREAD_USD_MT + '/MT',
    note: 'Diferencial de referencia estimado a partir de índices públicos de UCO EE.UU. y ULSD del 9-oct-2026; no es una cotización directa ni equivale a FOB Brasil.',
    stale: Boolean(ulsd.stale), status: 'Estimación indicativa, no oferta física'
  };
} else {
  const previous = oldById.get('uco');
  uco = previous
    ? { ...previous, stale: true, status: 'ULSD no disponible; último indicativo conservado.' }
    : { id: 'uco', name: 'UCO / AVU indicativo', symbol: 'ULSD + spread', price: null, usdPerMt: null, unit: 'USD/MT', decimals: 0, marketTime: null, source: 'Modelo indicativo', sourceUrl: 'https://www.fastmarkets.com/insights/fastmarkets-launches-used-cooking-oil-fob-amsterdam-rotterdam-antwerp-ghent/', basis: 'ULSD + diferencial de referencia', note: 'Sin ULSD actualizado; no se inventa el valor.', stale: true, status: 'Cotización no disponible' };
}
instruments.splice(1, 0, uco);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  delayMinutes: 15,
  instruments
}, null, 2) + '\n');
const fresh = instruments.filter((x) => x.price != null && !x.stale).length;
console.log('Actualizados ' + fresh + ' de ' + instruments.length + ' marcadores; precios nativos conservados y USD/MT convertidos cuando corresponde.');
