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
    id: 'uco', name: 'UCO / AVU · FOB Brasil (estimación por paridad)', price: 0.705 * 2204.62262 * 0.90, usdPerMt: 0.705 * 2204.62262 * 0.90, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-09T12:00:00Z'), source: 'Benchmark público UCO EE.UU. 9-oct + ajuste de origen supuesto',
    sourceUrl: 'https://www.argusmedia.com/en/methodology/key-commodity-prices/argus-asian-uco-price-assessments',
    basis: 'US$0,705/lb × 2.204,62 lb/MT = US$1.554/MT; ajuste de modelización −10% = US$1.399/MT FOB Brasil indicativo.',
    note: 'ESTIMACIÓN, no cotización brasileña. El −10% es una hipótesis provisional de origen/calidad/logística, no un diferencial observado. Benchmark de EE.UU. no es equivalente directo a UCO RED/ISCC FOB Straits; confirmar FFA, MIU, azufre, trazabilidad e ISCC antes de usar comercialmente.',
    relativePct: null, stale: true, status: 'Estimación por benchmark · baja confianza'
  },
  {
    id: 'fatty-acids', name: 'Ácido graxo de palma · FOB Nordeste Brasil', price: 4200 / 4.99, usdPerMt: 4200 / 4.99, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-06T12:00:00Z'), source: 'ABISA · cotação brasileira publicada 6-oct-2026',
    sourceUrl: 'https://abisa.com.br/cotacoes/cotacoes-2026', symbol: 'Ácido graxo de palma',
    basis: 'R$4,20/kg = R$4.200/MT; FOB Nordeste, condição publicada 6-oct-2026. Conversão indicativa a US$1 = R$4,99.',
    note: 'Referencia brasileña de ácido graxo de palma FOB Nordeste; no es ácido oleico 75% ni PFAD. Conversión BRL/USD indicativa; confirmar tipo de cambio y condiciones fiscales con el proveedor.',
    relativePct: null, stale: true, status: 'Referencia Brasil FOB · 6 oct.'
  },
  {
    id: 'acid-oils', name: 'Aceites ácidos / soapstock · proxy FOB Brasil', price: ((4950 / 4.99) / 1.12) + 25, usdPerMt: ((4950 / 4.99) / 1.12) + 25, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-09-29T12:00:00Z'), source: 'ABISA · ácido graxo bruto de soja CIF-SP, 29-sep-2026; cálculo proxy',
    sourceUrl: 'https://abisa.com.br/cotacoes/cotacoes-2026', symbol: 'Ácido graxo bruto de soja',
    basis: 'R$4,95/kg = R$4.950/MT ÷ 4,99 BRL/USD ÷ 1,12 (retiro fiscal supuesto) + US$25/MT (manejo/puerto supuesto) ≈ US$912/MT.',
    note: 'ESTIMACIÓN PROXY, no precio observado de soapstock. ABISA publica ácido graxo bruto de soja CIF-SP con condición de 12% ICMS; el cálculo elimina 12% como hipótesis y añade US$25/MT de logística supuesta para aproximar FOB. No equivale necesariamente a aceite ácido/soapstock (FFA, MIU, P, S y proceso pueden diferir). Validar con análisis y oferta de planta.',
    relativePct: null, stale: true, status: 'Estimación proxy · baja confianza'
  },
  {
    id: 'degummed-oils', name: 'Aceite de soya desgomado · proxy FOB Paranaguá', price: vegetableOilPrice, usdPerMt: vegetableOilPrice, unit: 'USD/MT', decimals: 0,
    marketTime: physicalSoyOil?.timestamp ?? null, source: physicalSoyOil?.provider || 'Sin referencia física actualizada',
    sourceUrl: 'https://commodityscope.com/prices/brazil-soybean-oil', symbol: 'CS-GRN-SBO-BRZ',
    basis: 'Proxy: aceite de soya FOB Paranaguá, Brasil · USD/MT; sin prima/descuento de grado desgomado.',
    note: 'Se usa el benchmark FOB Brasil de aceite de soya sin añadir un ajuste de calidad no verificado. No es una evaluación específica de aceite desgomado.',
    relativePct: null, stale: !physicalSoyOil || Boolean(physicalSoyOil.fallback) || (Date.now() / 1000 - physicalSoyOil.timestamp > 3 * 86400), status: 'Proxy FOB Brasil · sin ajuste de grado'
  },
  {
    id: 'oleins', name: 'Oleína de palma RBD · paridad indicativa FOB Brasil', price: 1132.50 + 35, usdPerMt: 1132.50 + 35, unit: 'USD/MT', decimals: 0,
    marketTime: timestamp('2026-10-05T12:00:00Z'), source: 'MBLion Oleo · FOB Malasia 5-oct-2026 + diferencial logístico supuesto',
    sourceUrl: 'https://www.mblionoleo.com/', symbol: 'RBD Palm Olein',
    basis: 'Benchmark FOB Malasia US$1.132,50/MT + diferencial supuesto US$35/MT = US$1.167,50/MT de paridad comparativa.',
    note: 'ESTIMACIÓN DE PARIDAD, no cotización FOB Brasil. Los US$35/MT son una hipótesis de diferencial de flete entre orígenes hacia Rotterdam, no un flete confirmado; tampoco incluye coste de importar, impuestos, almacenaje o reexportar oleína a Brasil. Úsese solo como referencia comparativa, no como oferta brasileña ejecutable.',
    relativePct: null, stale: true, status: 'Paridad estimada · benchmark Malasia 5 oct.'
  },
  {
    id: 'off-spec', name: 'Fuera de especificación · escenario de descuento', price: vegetableOilPrice != null ? vegetableOilPrice * 0.85 : null, usdPerMt: vegetableOilPrice != null ? vegetableOilPrice * 0.85 : null, unit: 'USD/MT', decimals: 0,
    marketTime: physicalSoyOil?.timestamp ?? null, source: 'Modelo de escenario: aceite de soya FOB Brasil menos 15%', sourceUrl: 'https://commodityscope.com/prices/brazil-soybean-oil',
    symbol: null, basis: 'Precio de referencia de aceite de soya FOB Brasil × 0,85; descuento supuesto de 15%.',
    note: 'ESCENARIO ILUSTRATIVO, no benchmark universal ni precio de compra. Se aplica un descuento supuesto de 15% al aceite de soya de referencia solo para dar una cifra de trabajo; el descuento real puede ser menor, mayor o negativo según material, FFA, humedad, MIU, fósforo, azufre, color, trazabilidad y destino. Recalcular con ficha técnica y análisis de laboratorio.',
    relativePct: null, stale: true, status: 'Escenario −15% · baja confianza'
  }];

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  delayMinutes: 15,
  instruments: productMarkers
}, null, 2) + '\n');
const fresh = productMarkers.filter((x) => x.price != null && !x.stale).length;
console.log('Marcadores de producto: ' + productMarkers.filter((x) => x.price != null).length + '/7 con referencia numérica; ' + fresh + ' con dato de mercado automático fresco.');
