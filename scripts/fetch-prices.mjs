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


async function commodityScopeBrazilSoyOil() {
  const response = await fetch('https://commodityscope.com/prices', {
    headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' }
  });
  if (!response.ok) throw new Error('CommodityScope prices HTTP ' + response.status);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
  const markerIndex = text.search(/Soybean Oil\s*[—–-]\s*Brazil/i);
  const section = markerIndex >= 0 ? text.slice(markerIndex, markerIndex + 700) : '';
  const match = section.match(/\$([\d,]+(?:\.[\d]+)?)\s*\/mt[\s\S]{0,100}?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/i);
  if (!match) throw new Error('CommodityScope Brazil soybean oil physical assessment not found');
  const price = Number(match[1].replace(/,/g, ''));
  const timestamp = Math.floor(Date.parse(match[2] + ' 12:00:00 UTC') / 1000);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) throw new Error('CommodityScope Brazil soybean oil assessment invalid');
  return { price, timestamp, provider: 'CommodityScope indicative assessment', dateText: match[2] };
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
byId.uco = uco;

const soyBenchmark = byId.soy_oil;
const ulsdBenchmark = byId.ulsd;
const physicalSoyOil = await commodityScopeBrazilSoyOil().catch((error) => {
  console.log('Referencia física de soya no disponible; se conserva última observación verificada: ' + String(error).slice(0, 120));
  return { price: 1245.50, timestamp: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), provider: 'CommodityScope · último dato verificado 9-oct-2026', dateText: '9 Oct 2026', fallback: true };
});
const vegetableOilPrice = physicalSoyOil?.price ?? null;
const timestamp = (date) => Math.floor(Date.parse(date) / 1000);

const productMarkers = [
  {
    ...(soyBenchmark || {}),
    id: 'vegetable-oils', name: 'Aceite de soya · FOB Paranaguá', price: vegetableOilPrice,
    unit: 'USD/MT', decimals: 0, usdPerMt: vegetableOilPrice, relativePct: null,
    prevClose: null, changePct: null, prevUsdPerMt: null,
    marketTime: physicalSoyOil?.timestamp ?? null,
    source: physicalSoyOil?.provider || 'CommodityScope · sin dato físico actualizado',
    sourceUrl: 'https://commodityscope.com/prices/brazil-soybean-oil',
    symbol: 'CS-GRN-SBO-BRZ', basis: 'Aceite de soya · FOB Paranaguá, Brasil · USD/MT',
    note: physicalSoyOil?.fallback ? 'Última evaluación física pública verificada: US$1,245.50/MT FOB Paranaguá, 9-oct-2026. Se muestra como referencia fechada porque la fuente automática no respondió; no es oferta ejecutable. El futuro CBOT (~US$1,500/MT) es otra base.' : 'Evaluación indicativa de mercado físico; no es una oferta ejecutable. El futuro CBOT (~US$1.500/MT) es otra base y no debe confundirse con este precio.',
    status: physicalSoyOil?.fallback ? 'Último dato verificado' : physicalSoyOil ? 'Referencia física indicativa' : 'Cotización física no disponible', stale: !physicalSoyOil || Boolean(physicalSoyOil.fallback) || (Date.now() / 1000 - physicalSoyOil.timestamp > 3 * 86400)
  },
  {
    ...(byId.uco || {}),
    id: 'uco', name: 'UCO / AVU · indicativo',
    relativePct: null,
    note: 'Modelo indicativo ULSD + US$68/MT de diferencial de referencia observado al comparar índices públicos de UCO EE.UU. y ULSD el 9-oct-2026. No es cotización directa ni oferta FOB Brasil.',
    status: 'Indicativo modelado', stale: Boolean(ulsdBenchmark?.stale)
  },
  {
    id: 'fatty-acids', name: 'Ácidos grasos', price: 1280, usdPerMt: 1280, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-05T12:00:00Z'), source: 'MBLion Oleo Malaysia · oleic acid 75% min',
    sourceUrl: 'https://www.mblionoleo.com/', symbol: 'oleic acid 75% min',
    basis: 'US$1,280/MT · referencia publicada 5-oct-2026; FOB Malaysia',
    note: 'Referencia específica de ácido oleico 75% mínimo; no representa todas las mezclas de ácidos grasos.',
    relativePct: null, stale: true, status: 'Última referencia pública localizada'
  },
  {
    id: 'acid-oils', name: 'Aceites ácidos / PFAD', price: 1050, usdPerMt: 1050, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-09T12:00:00Z'), source: 'MBLion Oleo Malaysia · cierre publicado 9-oct-2026',
    sourceUrl: 'https://my.linkedin.com/company/mblion-oleochemicals', symbol: 'PFAD',
    basis: 'US$1,050/MT · FOB puertos de Malasia · 9-oct-2026',
    note: 'Precio publicado de PFAD (destilado de ácidos grasos de palma); no es equivalente a todo aceite ácido de soya o soapstock.',
    relativePct: null, stale: Date.now() / 1000 - timestamp('2026-10-09T12:00:00Z') > 3 * 86400, status: 'Última referencia pública localizada'
  },
  {
    id: 'degummed-oils', name: 'Aceite desgomado (proxy de soya)', price: 1233.25, usdPerMt: 1233.25, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-09T12:00:00Z'), source: 'CommodityScope · aceite de soya FOB Argentina',
    sourceUrl: 'https://commodityscope.com/prices/argentina-soybean-oil',
    symbol: 'CS-GRN-SBO-ARG', basis: 'US$1,233.25/MT · FOB Argentina · evaluación indicativa 9-oct-2026',
    note: 'Proxy físico de aceite de soya a granel porque no se encontró evaluación pública diaria específica para aceite desgomado. No es oferta de grado desgomado ni oferta FOB Brasil.',
    relativePct: null, stale: Date.now() / 1000 - timestamp('2026-10-09T12:00:00Z') > 3 * 86400, status: 'Proxy de mercado físico'
  },
  {
    id: 'oleins', name: 'Oleínas · RBD palm olein', price: 1137.5, usdPerMt: 1137.5, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-09T12:00:00Z'), source: 'MBLion Oleo Malaysia · cierre publicado 9-oct-2026',
    sourceUrl: 'https://my.linkedin.com/company/mblion-oleochemicals',
    symbol: 'RBD palm olein', basis: 'US$1,137.50/MT · FOB puertos de Malasia · 9-oct-2026',
    note: 'Referencia publicada para oleína de palma RBD; no es oferta FOB Brasil y no se calcula descuento frente a soya por diferencia de producto y origen.',
    relativePct: null, stale: Date.now() / 1000 - timestamp('2026-10-09T12:00:00Z') > 3 * 86400, status: 'Última referencia pública localizada'
  },
  {
    id: 'off-spec', name: 'Fuera de especificación', price: null, usdPerMt: null, unit: 'USD/MT', decimals: 0,
    marketTime: null, source: 'Sin benchmark universal', sourceUrl: 'https://www.fastmarkets.com/insights/european-biofuel-feedstock-prices-fluctuate-significantly-in-2025-market-expects-more-volatility-next-year-2026-preview/',
    symbol: null, basis: 'Precio depende del producto base y del análisis de laboratorio',
    note: 'No existe un precio único responsable sin identificar material, FFA, humedad, impurezas, azufre, origen y especificación. No se inventa una cifra.',
    relativePct: null, stale: true, status: 'Requiere especificación y análisis'
  }
];

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  delayMinutes: 15,
  instruments: productMarkers
}, null, 2) + '\n');
const fresh = productMarkers.filter((x) => x.price != null && !x.stale).length;
console.log('Marcadores de producto: ' + productMarkers.filter((x) => x.price != null).length + '/7 con referencia numérica; ' + fresh + ' con dato de mercado automático fresco.');
