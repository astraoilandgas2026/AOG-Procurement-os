import fs from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[2] || 'prices.json';
const outputPath = path.resolve(output);
const old = await fs.readFile(outputPath, 'utf8').then(JSON.parse).catch(() => ({ instruments: [] }));
const oldById = new Map((old.instruments || []).map((item) => [item.id, item]));

const definitions = [
  { id: 'uco', name: 'UCO / AVU', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite vegetal · USD/MT', note: 'No existe un futuro gratuito y líquido para UCO; no equivale a una oferta física de UCO.' },
  { id: 'fatty-acids', name: 'Ácidos grasos', symbol: 'RS=F', fallbackSymbol: 'ZL=F', factor: 1, source: 'ICE Canola Futures', url: 'https://finance.yahoo.com/quote/RS=F/', basis: 'Proxy bursátil de canola convertido a USD/MT', note: 'Benchmark de aceite vegetal; no es una cotización específica de ácidos grasos.' },
  { id: 'acid-oils', name: 'Aceites ácidos', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite de soya · USD/MT', note: 'No representa el descuento por FFA, humedad, impurezas ni calidad del aceite ácido.' },
  { id: 'vegetable-oils', name: 'Aceites vegetales', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Futuro de aceite de soya CBOT convertido a USD/MT', note: 'Benchmark financiero; no equivale a aceite físico FOB.' },
  { id: 'degummed-oils', name: 'Aceites desgomados', symbol: 'RS=F', fallbackSymbol: 'ZL=F', factor: 1, source: 'ICE Canola Futures', url: 'https://finance.yahoo.com/quote/RS=F/', basis: 'Proxy bursátil de canola convertido a USD/MT', note: 'No incluye prima por desgomado, origen, calidad ni Incoterm.' },
  { id: 'oleins', name: 'Oleínas', symbol: 'FCPO=F', fallbackSymbol: 'RS=F', factor: 1, source: 'Bursa Malaysia Palm Oil Futures', url: 'https://finance.yahoo.com/quote/FCPO=F/', basis: 'Futuro de aceite de palma convertido a USD/MT', note: 'Si la fuente de palma no está disponible, se identifica el benchmark alternativo; no equivale a oleína física FOB.' },
  { id: 'off-spec', name: 'Fuera de especificación / otros', symbol: 'HO=F', factor: 313.7, source: 'NYMEX ULSD Futures', url: 'https://finance.yahoo.com/quote/HO=F/', basis: 'Benchmark downstream de diésel ULSD convertido a USD/MT', note: 'Referencia energética para comparación, no precio de compra de un residuo fuera de especificación.' },
];

async function yahoo(symbol) {
  const endpoint = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=5d&interval=1d';
  const response = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('Yahoo HTTP ' + response.status + ' para ' + symbol);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const price = Number(result?.meta?.regularMarketPrice);
  const timestamp = Number(result?.meta?.regularMarketTime);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp)) throw new Error('Cotización no válida para ' + symbol);
  return { price, timestamp, currency: result.meta.currency || '', provider: 'Yahoo Finance' };
}

async function stooq(symbol) {
  const endpoint = 'https://stooq.com/q/l/?s=' + encodeURIComponent(symbol) + '&f=sd2t2c&h&e=csv';
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Stooq HTTP ' + response.status + ' para ' + symbol);
  const rows = (await response.text()).trim().split(/\r?\n/);
  const fields = rows[1]?.split(',');
  const price = Number(fields?.[3]);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Stooq sin cotización para ' + symbol);
  const parsed = fields?.[1] ? Date.parse(fields[1] + 'T' + (fields[2] || '00:00') + 'Z') : Date.now();
  return { price, timestamp: Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000), currency: '', provider: 'Stooq' };
}

const STOOQ_SYMBOLS = { 'ZL=F': 'zl.f', 'RS=F': 'rs.f', 'FCPO=F': 'fcpo.f', 'HO=F': 'ho.f', 'BZ=F': 'bz.f', 'CL=F': 'cl.f' };
const quoteCache = new Map();
async function getQuote(symbol) {
  if (!quoteCache.has(symbol)) {
    quoteCache.set(symbol, (async () => {
      try { return await yahoo(symbol); }
      catch (yahooError) {
        const stooqSymbol = STOOQ_SYMBOLS[symbol];
        if (!stooqSymbol) throw yahooError;
        return stooq(stooqSymbol);
      }
    })());
  }
  return quoteCache.get(symbol);
}

const instruments = [];
for (const def of definitions) {
  const previous = oldById.get(def.id);
  let symbol = def.symbol;
  let quote;
  try {
    quote = await getQuote(symbol);
  } catch (firstError) {
    if (def.fallbackSymbol) {
      symbol = def.fallbackSymbol;
      try { quote = await getQuote(symbol); } catch {}
    }
  }

  if (!quote) {
    if (previous) instruments.push({ ...previous, stale: true, status: 'Último dato conservado; actualización fallida.' });
    else instruments.push({
      id: def.id, name: def.name, price: null, usdPerMt: null, unit: 'USD/MT',
      marketTime: null, source: def.source, sourceUrl: def.url, symbol: def.symbol,
      basis: def.basis, note: def.note, stale: true, status: 'Cotización no disponible'
    });
    continue;
  }

  if (symbol === 'FCPO=F' || symbol === 'RS=F') {
    try {
      const fx = await getQuote(symbol === 'FCPO=F' ? 'USDMYR=X' : 'USDCAD=X');
      quote = { ...quote, price: quote.price / fx.price };
    } catch {
      if (def.fallbackSymbol) {
        symbol = def.fallbackSymbol;
        try {
          quote = await getQuote(symbol);
          if (symbol === 'RS=F') {
            const fx = await getQuote('USDCAD=X');
            quote = { ...quote, price: quote.price / fx.price };
          }
        } catch { quote = null; }
      }
    }
  }
  if (!quote) {
    if (previous) instruments.push({ ...previous, stale: true, status: 'Último dato conservado; actualización fallida.' });
    else instruments.push({ id: def.id, name: def.name, price: null, usdPerMt: null, unit: 'USD/MT', marketTime: null, source: def.source, sourceUrl: def.url, symbol: def.symbol, basis: def.basis, note: def.note, stale: true, status: 'Cotización no disponible' });
    continue;
  }

  let usdPerMt = quote.price * def.factor;
  let basis = def.basis;
  let source = def.source;
  let sourceUrl = def.url;
  let note = def.note;
  if (symbol === 'FCPO=F') {
    usdPerMt = quote.price;
    basis = 'Futuro de aceite de palma convertido de MYR/MT a USD/MT';
    source = 'Bursa Malaysia Palm Oil Futures via ' + quote.provider;
    sourceUrl = 'https://finance.yahoo.com/quote/FCPO=F/';
  } else if (symbol === 'RS=F') {
    usdPerMt = quote.price;
    basis = 'Futuro de canola convertido de CAD/MT a USD/MT · proxy oleaginoso';
    source = 'ICE Canola Futures via ' + quote.provider;
    sourceUrl = 'https://finance.yahoo.com/quote/RS=F/';
    if (def.id === 'oleins') note = 'La fuente de palma no respondió; se muestra canola como proxy alternativo, no como precio de oleína.';
  } else if (symbol === 'ZL=F') {
    usdPerMt = quote.price * 22.0462262185;
    if (def.symbol !== 'ZL=F') {
      basis = 'Proxy alternativo: futuro de aceite de soya convertido a USD/MT';
      source = 'CME Soybean Oil Futures (proxy alternativo) via ' + quote.provider;
      sourceUrl = 'https://finance.yahoo.com/quote/ZL=F/';
      note = def.id === 'oleins'
        ? 'Las fuentes de palma y canola no respondieron; se muestra aceite de soya como proxy, no como precio de oleína.'
        : 'No respondió el benchmark específico; se muestra aceite de soya como proxy alternativo, no una cotización específica del producto.';
    }
  } else if (symbol === 'HO=F') {
    usdPerMt = quote.price * 313.7;
    source = 'NYMEX ULSD Futures via ' + quote.provider;
  } else if (symbol === 'BZ=F' || symbol === 'CL=F') {
    usdPerMt = quote.price * 7.33;
  }

  instruments.push({
    id: def.id, name: def.name, price: usdPerMt, usdPerMt,
    unit: 'USD/MT', decimals: 0, marketTime: quote.timestamp,
    source, sourceUrl, symbol, basis, note, stale: false,
    status: symbol === def.symbol ? 'Proxy de mercado actualizado' : 'Proxy alternativo actualizado'
  });
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  delayMinutes: 15,
  instruments
}, null, 2) + '\n');
console.log('Actualizados ' + instruments.filter((x) => x.price != null && !x.stale).length + ' de ' + instruments.length + ' marcadores.');
