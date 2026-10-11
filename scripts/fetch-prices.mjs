import fs from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[2] || 'prices.json';
const outputPath = path.resolve(output);
const old = await fs.readFile(outputPath, 'utf8').then(JSON.parse).catch(() => ({ instruments: [] }));
const oldById = new Map((old.instruments || []).map((item) => [item.id, item]));

const definitions = [
  { id: 'uco', name: 'UCO / AVU', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite vegetal · USD/MT', note: 'No existe un futuro gratuito y líquido para UCO; no equivale a una oferta física de UCO.' },
  { id: 'fatty-acids', name: 'Ácidos grasos', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite de soya · USD/MT', note: 'Referencia comparativa; no es una cotización específica de ácidos grasos.' },
  { id: 'acid-oils', name: 'Aceites ácidos', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite de soya · USD/MT', note: 'No representa el descuento por FFA, humedad, impurezas ni calidad del aceite ácido.' },
  { id: 'vegetable-oils', name: 'Aceites vegetales', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Futuro de aceite de soya CBOT convertido a USD/MT', note: 'Benchmark financiero; no equivale a aceite físico FOB.' },
  { id: 'degummed-oils', name: 'Aceites desgomados', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite de soya · USD/MT', note: 'No incluye prima por desgomado, origen, calidad ni Incoterm.' },
  { id: 'oleins', name: 'Oleínas', symbol: 'FCPO=F', fallbackSymbol: 'ZL=F', factor: 1, source: 'Palm oil futures / proxy soybean oil', url: 'https://finance.yahoo.com/quote/FCPO=F/', basis: 'Futuro de aceite de palma si la fuente lo confirma; si no, proxy indicado', note: 'El símbolo de palma puede no estar disponible en Yahoo; si falla, se muestra explícitamente el proxy alternativo.' },
  { id: 'off-spec', name: 'Fuera de especificación / otros', symbol: 'ZL=F', factor: 22.0462262185, source: 'CME Soybean Oil Futures', url: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Proxy bursátil de aceite de soya · USD/MT', note: 'No sustituye la evaluación de especificación, análisis de laboratorio ni descuento comercial.' },
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
  return { price, timestamp, currency: result.meta.currency || '' };
}

const quoteCache = new Map();
async function getQuote(symbol) {
  if (!quoteCache.has(symbol)) quoteCache.set(symbol, yahoo(symbol));
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

  let usdPerMt = quote.price * (symbol === 'FCPO=F' ? 1 : def.factor);
  let basis = def.basis;
  let source = def.source;
  let sourceUrl = def.url;
  let note = def.note;
  if (symbol === 'FCPO=F') {
    basis = 'Cotización de contrato de palma · unidad reportada por la fuente; conversión pendiente de validar';
    note = 'La unidad y conversión del contrato deben validarse antes de usarlo para valoración comercial.';
  } else if (symbol === 'ZL=F') {
    usdPerMt = quote.price * 22.0462262185;
    if (def.id === 'oleins') {
      basis = 'Proxy alternativo: futuro de aceite de soya convertido a USD/MT';
      source = 'CME Soybean Oil Futures (proxy alternativo)';
      sourceUrl = 'https://finance.yahoo.com/quote/ZL=F/';
      note = 'La fuente de palma no respondió; se muestra aceite de soya como proxy, no como precio de oleína.';
    }
  } else if (symbol === 'HO=F') {
    usdPerMt = quote.price * 313.7;
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
