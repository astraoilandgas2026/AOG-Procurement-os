import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.dirname(path.resolve(process.argv[2] || 'energy-prices.json'));
const now = Math.floor(Date.now() / 1000);

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
  return { price, prevClose: Number.isFinite(prevClose) && prevClose > 0 ? prevClose : null, timestamp, currency: result.meta?.currency || '' };
}

async function iataJetFuel() {
  const response = await fetch('https://www.iata.org/en/publications/economics/fuel-monitor/', {
    headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' }
  });
  if (!response.ok) throw new Error('IATA Jet Fuel Monitor HTTP ' + response.status);
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
  const priceMatch = text.match(/global average jet fuel price last week.{0,350}?\$([\d,]+(?:\.\d+)?)\s*\/\s*bbl/i);
  if (!priceMatch) throw new Error('IATA weekly Jet Fuel USD/bbl quote not found');
  const price = Number(priceMatch[1].replace(/,/g, ''));
  const changeMatch = text.match(/global average jet fuel price last week.{0,180}?(rose|fell|increased|decreased)\s+([\d.]+)%/i);
  let changePct = null;
  let prevClose = null;
  if (changeMatch) {
    const magnitude = Number(changeMatch[2]);
    changePct = /fell|decreased/i.test(changeMatch[1]) ? -magnitude : magnitude;
    if (Number.isFinite(price) && Number.isFinite(changePct) && 1 + changePct / 100 > 0) prevClose = price / (1 + changePct / 100);
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error('IATA Jet Fuel quote invalid');
  return { price, prevClose, timestamp: null, currency: 'USD' };
}

async function eiaPropane() {
  const response = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DPROPANEMBTX', {
    headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' }
  });
  if (!response.ok) throw new Error('FRED/EIA propane HTTP ' + response.status);
  const csv = await response.text();
  const rows = csv.trim().split(/\r?\n/).slice(1);
  for (let i = rows.length - 1; i >= 0; i--) {
    const [date, raw] = rows[i].split(',');
    const price = Number(raw);
    const timestamp = Math.floor(Date.parse(date + 'T12:00:00Z') / 1000);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(timestamp)) {
      return { price, prevClose: null, timestamp, currency: 'USD' };
    }
  }
  throw new Error('FRED/EIA propane observation not found');
}

async function tradingViewButane() {
  const response = await fetch('https://scanner.tradingview.com/america/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' },
    body: JSON.stringify({
      symbols: { tickers: ['NYMEX:AD1!'], query: { types: [] } },
      columns: ['close', 'change', 'change_abs']
    })
  });
  if (!response.ok) throw new Error('TradingView OPIS butane HTTP ' + response.status);
  const payload = await response.json();
  const row = payload?.data?.find((item) => item.s === 'NYMEX:AD1!');
  const price = Number(row?.d?.[0]);
  const changePct = Number(row?.d?.[1]);
  if (!Number.isFinite(price) || price <= 0) throw new Error('TradingView OPIS butane quote unavailable');
  const prevClose = Number.isFinite(changePct) && 1 + changePct / 100 > 0 ? price / (1 + changePct / 100) : null;
  return { price, prevClose, timestamp: null, currency: 'USD' };
}

async function fertilizerPrice() {
  const response = await fetch('https://fertilizerprice.com/', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('FertilizerPrice HTTP ' + response.status);
  const html = await response.text();
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
    )
  );
  const result = {};
  for (const cells of rows) {
    const product = cells[0]?.trim();
    if (!product) continue;
    const priceCell = cells.find((cell) => /^\$?[\d,]+(?:\.[\d]+)?$/.test(cell.replace(/\s/g, '')));
    if (!priceCell) continue;
    const price = Number(priceCell.replace(/[$,\s]/g, ''));
    const weekCell = cells.find((cell) => /^[+-]\$?[\d,]+(?:\.[\d]+)?$/.test(cell.replace(/\s/g, '')));
    const weekDelta = weekCell ? Number(weekCell.replace(/[$,\s]/g, '')) : null;
    if (Number.isFinite(price) && price > 0) {
      const previous = weekDelta != null && Number.isFinite(weekDelta) ? price - weekDelta : null;
      result[product.toLowerCase()] = { price, prevClose: previous > 0 ? previous : null, timestamp: null, currency: 'USD' };
    }
  }
  return result;
}

async function methanexMethanol() {
  const response = await fetch('https://www.methanex.com/our-products/about-methanol/pricing/', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('Methanex pricing HTTP ' + response.status);
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  const match = text.match(/North America[\s\S]{0,500}?USD\s*([\d,]+(?:\.[\d]+)?)\s*\/\s*MT/i);
  if (!match) throw new Error('Methanex North America USD/MT price not found');
  const price = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Methanol quote invalid');
  return { price, prevClose: null, timestamp: null, currency: 'USD' };
}

async function freshdiCausticSoda() {
  const response = await fetch('https://freshdi.com/market-insight/Caustic-Soda', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('Freshdi caustic soda HTTP ' + response.status);
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  const match = text.match(/median USD\s*([\d,]+)(?:\s+per metric ton)?/i) || text.match(/\$\s*([\d,]+)\s+Caustic Soda price/i);
  if (!match) throw new Error('Freshdi caustic soda median not found');
  const price = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Freshdi caustic soda quote invalid');
  return { price, prevClose: null, timestamp: null, currency: 'USD' };
}

async function mblionOleicAcid() {
  const response = await fetch('https://www.mblionoleo.com/', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('MBLion Oleo HTTP ' + response.status);
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  const match = text.match(/Oleic Acid 75% Min\s*(?:➜|→|:|-)?\s*([\d,]+(?:\.[\d]+)?)/i);
  if (!match) throw new Error('MBLion oleic acid 75% price not found');
  const price = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) throw new Error('MBLion oleic acid quote invalid');
  return { price, prevClose: null, timestamp: null, currency: 'USD' };
}

async function chemPriceBenzene() {
  const response = await fetch('https://chempricehub.com/news/detail-market-trends-of-pure-benzene-in-asia-b7594.html', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('ChemPriceHub benzene HTTP ' + response.status);
  const html = await response.text();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  const match = text.match(/benzene prices in Asia were assessed at \$([\d,]+(?:\.[\d]+)?)\/mt FOB Korea on October 9/i);
  if (!match) throw new Error('Latest FOB Korea benzene assessment not found');
  const price = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Benzene quote invalid');
  return { price, prevClose: null, timestamp: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), currency: 'USD' };
}

async function bolsaSunflower() {
  const response = await fetch('https://www.bolsadecereales.com/precios-oficiales?lang=ingles', { headers: { 'User-Agent': 'Mozilla/5.0 AOG-ProcurementOS/1.0' } });
  if (!response.ok) throw new Error('Bolsa de Cereales HTTP ' + response.status);
  const html = await response.text();
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim()
    )
  );
  const header = rows.findIndex((row) => row.some((cell) => /Position/i.test(cell)) && row.some((cell) => /^Sunflower$/i.test(cell)));
  if (header < 0) throw new Error('Official sunflower header not found');
  const sunflowerIndex = rows[header].findIndex((cell) => /^Sunflower$/i.test(cell));
  const quoteRow = rows.slice(header + 1).find((row) => /^Oct26$/i.test(row[0] || ''));
  const price = Number((quoteRow?.[sunflowerIndex] || '').replace(/[$,]/g, ''));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Official October sunflower seed FOB quote not found');
  return { price, prevClose: null, timestamp: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), currency: 'USD' };
}

async function buildFile(fileName, definitions) {
  const filePath = path.join(outDir, fileName);
  const old = await fs.readFile(filePath, 'utf8').then(JSON.parse).catch(() => ({ instruments: [] }));
  const oldById = new Map((old.instruments || []).map((item) => [item.id, item]));
  const instruments = [];

  for (const def of definitions) {
    const previous = oldById.get(def.id);
    let q = null;
    if (def.fetcher === 'fertilizerprice') {
      try {
        const quotes = await fertilizerPrice();
        q = quotes[(def.sourceProduct || '').toLowerCase()] || null;
        if (!q) throw new Error('Product not found: ' + def.sourceProduct);
      } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'eia-propane') {
      try { q = await eiaPropane(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'methanex-methanol') {
      try { q = await methanexMethanol(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'freshdi-caustic') {
      try { q = await freshdiCausticSoda(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'mblion-oleic') {
      try { q = await mblionOleicAcid(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'chemprice-benzene') {
      try { q = await chemPriceBenzene(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'bolsa-sunflower') {
      try { q = await bolsaSunflower(); } catch (error) { console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140)); }
    } else if (def.fetcher === 'tradingview-butane') {
      try { q = await tradingViewButane(); } catch (error) {
        console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140));
      }
    } else if (def.fetcher === 'iata-jet-fuel') {
      try { q = await iataJetFuel(); } catch (error) {
        console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140));
      }
    } else if (def.symbol) {
      try { q = await yahoo(def.symbol); } catch (error) {
        console.log('Fuente no disponible para ' + def.id + ': ' + String(error).slice(0, 140));
      }
    }

    if (q) {
      const value = q.price * (def.factor || 1);
      const prior = q.prevClose != null ? q.prevClose * (def.factor || 1) : null;
      instruments.push({
        id: def.id, name: def.name, price: value, unit: def.unit, decimals: def.decimals ?? 2,
        usdPerMt: def.usdPerMtFactor ? value * def.usdPerMtFactor : (def.usdPerMt ? value : null),
        changePct: prior != null && prior > 0 ? ((value - prior) / prior) * 100 : null,
        relativePct: null, marketTime: q.timestamp, source: def.source || 'Yahoo Finance',
        sourceUrl: def.sourceUrl, basis: def.basis,
        note: def.note, stale: false, status: def.status || (def.fetcher === 'iata-jet-fuel' ? 'Promedio global semanal actualizado' : def.fetcher === 'fertilizerprice' ? 'Referencia minorista semanal actualizada' : 'Benchmark financiero actualizado'),
        symbol: def.symbol, currency: q.currency
      });
    } else if (!def.disablePrevious && def.fallbackPrice == null && previous && previous.unit === def.unit && previous.sourceUrl === def.sourceUrl && typeof previous.price === 'number') {
      instruments.push({ ...previous, stale: true, status: 'Última referencia conservada; fuente automática sin respuesta.' });
    } else {
      instruments.push({
        id: def.id, name: def.name, price: def.fallbackPrice ?? null, unit: def.unit,
        decimals: def.decimals ?? 2, usdPerMt: def.fallbackUsdPerMt ?? null,
        changePct: null, relativePct: null, marketTime: def.fallbackTime ?? null,
        source: def.fallbackSource || 'Sin benchmark público gratuito verificable',
        sourceUrl: def.fallbackUrl || def.sourceUrl || '',
        basis: def.fallbackBasis || def.basis || 'Sin referencia numérica comparable y verificable.',
        note: def.fallbackNote || def.note || 'No se muestra un precio inventado. Requiere cotización de proveedor o índice especializado.',
        stale: true, status: def.fallbackStatus || (def.fallbackPrice != null ? 'Última referencia pública localizada' : 'Sin cotización pública comparable')
      });
    }
  }

  await fs.writeFile(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), delayMinutes: 15, instruments }, null, 2) + '\n');
  const priced = instruments.filter((x) => typeof x.price === 'number').length;
  console.log(fileName + ': ' + priced + '/' + instruments.length + ' referencias numéricas; ' + instruments.filter((x) => !x.stale).length + ' actualizadas automáticamente.');
}

const energy = [
  { id: 'crude-oil', name: 'Petróleo crudo · Brent proxy (no FOB Brasil)', symbol: 'BZ=F', unit: 'USD/bbl', decimals: 2, fallbackPrice: 104.72, fallbackUsdPerMt: null, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'ICE Brent · último dato público 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Futuro Brent USD/bbl como referencia global. No representa el diferencial físico de crudos brasileños Tupi/Mero ni un precio FOB terminal Brasil.', fallbackNote: 'Comparador de mercado. Para negociación física, aplicar diferencial de calidad y terminal con evaluación Platts/Argus del grado brasileño.', fallbackStatus: 'Benchmark global · no oferta FOB Brasil', source: 'ICE Brent futures · proxy global', sourceUrl: 'https://finance.yahoo.com/quote/BZ=F/', basis: 'ICE Brent USD/bbl; comparador global, no precio FOB Brasil.', note: 'No confundir con precio físico de Tupi/Mero.' },
  { id: 'en590-distillates', name: 'Diésel S10 / EN590 · proxy ULSD', symbol: 'HO=F', factor: 313.7, unit: 'USD/MT', decimals: 0, fallbackPrice: 940, fallbackUsdPerMt: 940, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'NYMEX ULSD · conversión aproximada de futuros', fallbackUrl: 'https://finance.yahoo.com/quote/HO=F/', fallbackBasis: 'Futuro ULSD NYMEX USD/gal × 313,7 para equivalencia aproximada USD/MT. No es una evaluación física EN590 FOB Brasil.', fallbackNote: 'Proxy financiero mientras no se automatice la lectura de los valores PPI/Platts Brasil. Para oferta, usar Platts FCA/DAP Brasil por puerto y especificación.', fallbackStatus: 'Proxy financiero · validar contra Platts Brasil', source: 'NYMEX ULSD futures · proxy', sourceUrl: 'https://finance.yahoo.com/quote/HO=F/', basis: 'USD/gal convertido aproximadamente a USD/MT; no es EN590 FOB Brasil.', note: 'Contrastar con Platts Brasil FCA/DAP S10.' },
  { id: 'jet-a1', name: 'Jet A-1 · referencia Jet Fuel global', fetcher: 'iata-jet-fuel', unit: 'USD/bbl', decimals: 2, fallbackPrice: 172.06, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · Jet Kerosene FOB Singapur, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Benchmark FOB Singapur USD/bbl; referencia global, no precio físico Jet A-1 FOB Brasil.', fallbackNote: 'Comparador de mercado. Para Brasil, contrastar con PPI/Platts de QAV por puerto y ajustar especificación, origen y flete.', fallbackStatus: 'Benchmark global · no FOB Brasil', source: 'IATA / global jet fuel monitor', sourceUrl: 'https://www.iata.org/en/publications/economics/fuel-monitor/', basis: 'Promedio global semanal USD/bbl.', note: 'No representa cotización física Jet A-1 FOB Brasil.' },
  { id: 'lng-gas', name: 'Gas natural · Henry Hub proxy', symbol: 'NG=F', unit: 'USD/MMBtu', decimals: 3, fallbackPrice: 3.02, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · Henry Hub, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Henry Hub USD/MMBtu como referencia global estadounidense; no equivale al precio contractual brasileño de gas ni a GNL FOB.', fallbackNote: 'Para Eneva, cotizar punto de entrega en Brasil y fórmula contractual. Mostrar este benchmark solo para comparación internacional.', fallbackStatus: 'Benchmark global · no precio Eneva', source: 'NYMEX Henry Hub futures · proxy', sourceUrl: 'https://finance.yahoo.com/quote/NG=F/', basis: 'USD/MMBtu, referencia financiera de EE.UU.', note: 'No representa precio contractual de suministro a Eneva.' },
  { id: 'lpg-propane', name: 'Propano · Mont Belvieu proxy', fetcher: 'eia-propane', factor: 520.7, unit: 'USD/MT', decimals: 0, fallbackPrice: 580, fallbackTime: Math.floor(Date.parse('2026-07-01T12:00:00Z') / 1000), fallbackSource: 'Saudi Aramco OSP · julio 2026', fallbackUrl: 'https://www.reuters.com/business/energy/saudi-aramco-sonatrach-cut-lpg-prices-july-2026-07-01/', fallbackBasis: 'Último OSP público localizado: propano US$580/MT en julio de 2026. Es benchmark exportador internacional, no precio FOB Brasil.', fallbackNote: 'La fuente automática EIA/FRED devuelve Mont Belvieu en USD/gal y se convierte aproximadamente a USD/MT con 520,7 gal/MT. Confirmar con PPI de GLP ANP/Platts Brasil antes de negociar.', fallbackStatus: 'Proxy internacional · revisar vigencia', source: 'EIA/FRED Mont Belvieu propane · convertido aprox.', sourceUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DPROPANEMBTX', basis: 'USD/gal convertido aproximadamente a USD/MT; proxy de EE.UU., no FOB Brasil.', note: 'Contrastar con PPI GLP de ANP/Platts Brasil.' },
  { id: 'n-butane', name: 'n-Butano · OSP internacional de referencia', unit: 'USD/MT', decimals: 0, fallbackPrice: 600, fallbackUsdPerMt: 600, fallbackTime: Math.floor(Date.parse('2026-07-01T12:00:00Z') / 1000), fallbackSource: 'Saudi Aramco OSP · julio 2026', fallbackUrl: 'https://www.reuters.com/business/energy/saudi-aramco-sonatrach-cut-lpg-prices-july-2026-07-01/', fallbackBasis: 'Último OSP público localizado: butano US$600/MT en julio de 2026; benchmark exportador internacional, no precio brasileño.', fallbackNote: 'La referencia queda fechada como antigua y no debe usarse como oferta. Para Brasil, usar PPI GLP de ANP/Platts (mezcla 70% propano/30% butano) o cotización de butano puro.', fallbackStatus: 'Referencia anterior · julio 2026', sourceUrl: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-de-paridade-de-importacao', basis: 'OSP internacional USD/MT; no es cotización de n-butano FOB Brasil.', note: 'Confirmar composición y precio brasileño antes de usar comercialmente.' },
  { id: 'residual-fuel-oil', name: 'Fuel oil residual 3,5% · HSFO Singapur', unit: 'USD/MT', decimals: 0, fallbackPrice: 739.84, fallbackUsdPerMt: 739.84, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · HSFO 380 CST FOB Singapur, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'HSFO 380 CST FOB Singapur USD/MT; referencia física internacional comparable por familia, no FOB Brasil.', fallbackNote: 'Ajustar por azufre, viscosidad, puerto y flete. No usar como oferta de fuel oil brasileño sin diferencial regional.', fallbackStatus: 'Benchmark físico internacional · 9 Oct 2026', sourceUrl: 'https://commodityscope.com/prices', basis: 'HSFO 380 CST FOB Singapur USD/MT.', note: 'Referencia internacional; verificar azufre/viscosidad y diferencial Brasil.' },
];

const mining = [
  { id: 'metallurgical-coal', name: 'Carbón coquizable premium low-vol · FOB Australia', unit: 'USD/MT', decimals: 2, fallbackPrice: 271.10, fallbackUsdPerMt: 271.10, fallbackTime: Math.floor(Date.parse('2026-10-07T12:00:00Z') / 1000), fallbackSource: 'S&P Global Platts · TSI Raw Material Assessments · 7 Oct 2026', fallbackUrl: 'https://www.spglobal.com/energy/en', fallbackBasis: 'Platts TSI premium low-vol coking coal FOB Australia: USD 271.10/MT on 7 October 2026 (PLVHA00). This is a benchmark, not a physical Alabama-origin offer.', fallbackNote: 'Benchmark FOB Australia; adjust for origin, quality and delivery.' },
  { id: 'thermal-coal', name: 'Thermal Coal (Newcastle FOB)', unit: 'USD/MT', decimals: 0, fallbackPrice: 143, fallbackUsdPerMt: 143, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Reuters · LSEG market pricing', fallbackUrl: 'https://www.reuters.com/commentary/reuters-open-interest/cheap-coal-expensive-gas-set-stage-year-end-coal-export-surge-2026-10-09/', fallbackBasis: 'Carbón térmico australiano Newcastle alrededor de US$143/t según referencia publicada el 9-oct-2026.', fallbackNote: 'Referencia de mercado Newcastle, no oferta física de un origen/grado específico. Ajustar por poder calorífico, azufre, cenizas, puerto e Incoterm.' },
  { id: 'copper-concentrate', name: 'Concentrado de cobre (30% Cu)', symbol: 'HG=F', factor: 0.30 * 2204.62262185, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/HG=F/', basis: 'Futuro COMEX Copper convertido de USD/lb a USD/tonelada métrica de concentrado teórico al 30% Cu: precio del cobre × 2,204.6226 lb/MT × 30%.', note: 'Estimación del valor del cobre contenido, no precio neto comercial del concentrado; faltan pagabilidad, TC/RC, penalidades, humedad, flete y créditos por subproductos.' },
  { id: 'aluminium', name: 'Aluminium (benchmark aluminio)', symbol: 'ALI=F', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ALI=F/', basis: 'Futuro de aluminio USD/MT si el símbolo está disponible; verificar contrato y mercado de referencia.', note: 'Referencia financiera, no oferta física de aluminio con grado, forma, origen y entrega confirmados.' },
  { id: 'steel-scrap', name: 'Scrap HMS 1/2 80:20 · Platts CFR Turquía', unit: 'USD/MT', decimals: 0, fallbackPrice: 404, fallbackTime: Math.floor(Date.parse('2026-10-07T12:00:00Z') / 1000), fallbackSource: 'S&P Global Platts · SBB Steel Markets Daily · 7 Oct 2026', fallbackBasis: 'Platts assessed HMS 1/2 80:20 CFR Turkey at USD 404/MT on 7 October 2026 (TS01011). Internal report: SD_20261007_261008_112545.pdf.', fallbackNote: 'Benchmark de importación de chatarra HMS 1/2 80:20.', fallbackStatus: 'Platts · 07 Oct 2026' },
  { id: 'steel-scrap-steelradar', name: 'Scrap HMS 1/2 80:20 · SteelRadar CFR Turquía', unit: 'USD/MT', decimals: 0, fallbackPrice: 395, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'SteelRadar · 9 Oct 2026', fallbackUrl: 'https://www.steelradar.com/en/haber/low-trading-volumes-keep-turkish-imported-scrap-prices-flat/', fallbackBasis: 'Public market report put HMS 1/2 80:20 CFR Turkey at USD 395/MT on 9 October 2026. Secondary market reference, distinct from Platts assessment.', fallbackNote: 'Second source check for the same HMS grade and basis.', fallbackStatus: 'SteelRadar · 09 Oct 2026' },
];

const fertilizerChemicals = [
  { id: 'fert-tsp', name: 'TSP · referencia regional por validar', unit: 'USD/MT', decimals: 0, fallbackPrice: 628.3, fallbackTime: Math.floor(Date.parse('2026-10-02T12:00:00Z') / 1000), fallbackSource: 'Estimación indexada: Argus TSP CFR Brasil + World Bank TSP US Gulf', fallbackUrl: 'https://worldtradepro.com/blog/what-is-triple-super-phosphate/', fallbackBasis: 'Estimación regional: Argus TSP CFR Brasil US$605/MT (26 Sep 2025) × índice World Bank TSP US Gulf Sep-2026/Sep-2025 (690/664,4) = aprox. US$628,30/MT CFR Brasil. Modelo de indexación, no nueva evaluación Argus.', fallbackNote: 'La base regional de Argus es antigua y se actualiza mediante un índice global; baja confianza. Sustituir por la evaluación TSP CFR Brasil de Argus/Platts más reciente cuando esté disponible.', fallbackStatus: 'CFR Brasil estimado · índice global' },
  { id: 'fert-urea', name: 'Urea granular · CFR Brasil', unit: 'USD/MT', decimals: 0, fallbackPrice: 475, fallbackTime: Math.floor(Date.parse('2026-10-06T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · evaluación CFR Brasil, 6 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/granular-urea-brazil', fallbackBasis: 'Evaluación diaria indicativa CFR Brasil: US$475/MT, rango US$472,50–477,50; último dato público observado 6 Oct 2026.', fallbackNote: 'Evaluación indicativa, no oferta ejecutable. Contrastar con Argus Nitrogen y oferta por puerto/volumen.', fallbackStatus: 'CFR Brasil · 6 Oct 2026' },
  { id: 'fert-ammonium-sulphate', name: 'Sulfato de amonio estándar · CFR Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 242.5, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · CFR Brasil, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/ammonium-sulphate-standard-brazil', fallbackBasis: 'Evaluación diaria indicativa de sulfato de amonio estándar CFR Brasil: US$242,50/MT, rango US$241,50–243,50 el 9 Oct 2026.', fallbackNote: 'Indicativo, no oferta ejecutable; confirmar granulometría, contenido de N, volumen y puerto.', fallbackStatus: 'CFR Brasil · 9 Oct 2026' },
  { id: 'fert-ammonia', name: 'Amoníaco · CFR Tampa (comparador externo)', unit: 'USD/MT', decimals: 0, fallbackPrice: 545, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Green Markets · contrato CFR Tampa, 9 Oct 2026', fallbackUrl: 'https://fertilizerpricing.com/market-watch-posts/', fallbackBasis: 'Contrato CFR Tampa US$545/MT. No es una evaluación CFR Brasil/Argentina; se conserva únicamente como referencia externa.', fallbackNote: 'No usar como precio regional sin ajuste documentado de origen, flete, descarga, volumen y fecha.', fallbackStatus: 'Benchmark externo · CFR Tampa' },
  { id: 'fert-dap', name: 'DAP · CFR Argentina (indicativo)', unit: 'USD/MT', decimals: 0, fallbackPrice: 867.5, fallbackTime: Math.floor(Date.parse('2026-09-28T12:00:00Z') / 1000), fallbackSource: 'Safras & Mercado / referencia regional · 28 Sep 2026', fallbackUrl: 'https://safras.com.br/es/importacion-de-urea-de-argentina-mantiene-ritmo-firme/', fallbackBasis: 'Rango regional CFR Argentina reportado US$865–870/MT; midpoint indicativo US$867,50/MT. Fecha de referencia 28 Sep 2026.', fallbackNote: 'Valor de mercado indicativo, no oferta vinculante. Confirmar especificación DAP 18-46, puerto y fecha de descarga.', fallbackStatus: 'CFR Argentina · dato anterior' },
  { id: 'fert-map', name: 'MAP · CFR Brasil', unit: 'USD/MT', decimals: 0, fallbackPrice: 837, fallbackTime: Math.floor(Date.parse('2026-10-01T12:00:00Z') / 1000), fallbackSource: 'Safras & Mercado · MAP CFR Brasil, 1 Oct 2026', fallbackUrl: 'https://saladillocampo.com.ar/blog/2026/10/05/urea-mas-barata-en-el-mundo-por-que-el-alivio-todavia-no-llega-al-campo-argentino/', fallbackBasis: 'Referencia publicada MAP CFR Brasil US$837/MT el 1 Oct 2026; Argentina CFR US$859/MT. Se muestra Brasil como marcador principal.', fallbackNote: 'Comparar misma especificación, origen y puerto; no mezclar CFR con FOB o precio internado.', fallbackStatus: 'CFR Brasil · 1 Oct 2026' },
  { id: 'fert-mop', name: 'MOP · referencia externa para paridad regional', unit: 'USD/MT', decimals: 0, fallbackPrice: 355, fallbackTime: Math.floor(Date.parse('2026-09-22T12:00:00Z') / 1000), fallbackSource: 'IFDC Fertilizer Crisis Response Bulletin #30 · MOP CFR Brasil', fallbackUrl: 'https://ifdc.org/2026/09/22/fertilizer-crisis-response-bulletin-30/', fallbackBasis: 'Rango indicativo MOP Brasil CFR US$350–360/MT; midpoint US$355/MT, publicado 22 Sep 2026.', fallbackNote: 'Referencia regional indicativa, no oferta ejecutable. Confirmar grado granular 60–61% K2O, volumen y puerto.', fallbackStatus: 'CFR Brasil · 22 Sep 2026' },
  { id: 'chem-methanol', name: 'Metanol · contrato Methanex', fetcher: 'methanex-methanol', unit: 'USD/MT', decimals: 0, source: 'Methanex · octubre 2026', sourceUrl: 'https://www.methanex.com/our-products/about-methanol/pricing/', basis: 'Precio contractual mensual publicado por Methanex; no spot regional.', note: 'Referencia contractual, no cotización spot Brasil/Argentina.' },
  { id: 'chem-petrochemical-feedstock', name: 'Feedstock petroquímico · Brent proxy', symbol: 'BZ=F', unit: 'USD/bbl', decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/BZ=F/', basis: 'Futuro ICE Brent USD/bbl; proxy de coste de materia prima, no precio de producto petroquímico terminado.', note: 'Referencia global; aplicar diferencial regional.' },
  { id: 'chem-benzene', name: 'Benceno · FOB Corea (comparador)', fetcher: 'chemprice-benzene', unit: 'USD/MT', decimals: 0, source: 'Evaluación pública basada en Platts · 9 Oct 2026', sourceUrl: 'https://chempricehub.com/news/detail-market-trends-of-pure-benzene-in-asia-b7594.html', basis: 'Evaluación publicada FOB Corea: US$1.247/MT el 9 Oct 2026.', note: 'Referencia regional asiática, no Brasil/Argentina.', status: 'Platts · 09 Oct 2026', fallbackPrice: 1247, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Evaluación pública basada en Platts · 9 Oct 2026', fallbackUrl: 'https://chempricehub.com/news/detail-market-trends-of-pure-benzene-in-asia-b7594.html', fallbackBasis: 'US$1.247/MT FOB Corea, 9 Oct 2026.', fallbackNote: 'Referencia regional asiática, no Brasil/Argentina.', fallbackStatus: 'Comparador externo · 9 Oct 2026' },
  { id: 'chem-fatty-acids', name: 'Ácido oleico 75% mín. · FOB Malasia', fetcher: 'mblion-oleic', unit: 'USD/MT', decimals: 0, source: 'MBLion Oleo Malaysia', sourceUrl: 'https://www.mblionoleo.com/', basis: 'Precio indicativo FOB Malasia para ácido oleico 75% mínimo.', note: 'Benchmark externo; no confundir con ácido graso de palma FOB Brasil.', status: 'Referencia indicativa', fallbackPrice: 1280, fallbackTime: Math.floor(Date.parse('2026-10-05T12:00:00Z') / 1000), fallbackSource: 'MBLion Oleo Malaysia', fallbackUrl: 'https://www.mblionoleo.com/', fallbackBasis: 'US$1.280/MT, referencia indicativa FOB Malasia de 5 Oct 2026.', fallbackNote: 'Referencia externa; confirmar vigencia antes de negociar.', fallbackStatus: 'Comparador externo · 5 Oct 2026' },
];

const agriculture = [
  { id: 'ag-soybeans', name: 'Soja en grano · FOB Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 524.5, fallbackUsdPerMt: 524.5, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Brasil, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/soybeans-brazil-daily', fallbackBasis: 'Evaluación física indicativa FOB Brasil US$524,50/MT; rango US$518–531/MT.', fallbackNote: 'Indicativo, no oferta ejecutable. Contrastar con diferencial de puerto, calidad y ventana de carga.', fallbackStatus: 'FOB Brasil · 9 Oct 2026' },
  { id: 'ag-corn', name: 'Maíz · FOB Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 228.75, fallbackUsdPerMt: 228.75, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Brasil, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Evaluación física diaria indicativa FOB Brasil US$228,75/MT, 9 Oct 2026.', fallbackNote: 'Indicativo, no oferta ejecutable. Ajustar por humedad, calidad, terminal y ventana de embarque.', fallbackStatus: 'FOB Brasil · 9 Oct 2026' },
  { id: 'ag-wheat', name: 'Trigo molienda · FOB Argentina Upriver', unit: 'USD/MT', decimals: 1, fallbackPrice: 247.5, fallbackUsdPerMt: 247.5, fallbackTime: Math.floor(Date.parse('2026-10-03T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina Upriver, 3 Oct 2026', fallbackUrl: 'https://commodityscope.com/markets/americas', fallbackBasis: 'Evaluación semanal indicativa de trigo molienda argentino FOB Upriver US$247,50/MT, 3 Oct 2026.', fallbackNote: 'Confirmar proteína, calidad, puerto y fecha de carga; no equivale a trigo feed.', fallbackStatus: 'FOB Argentina · 3 Oct 2026' },
  { id: 'ag-soybean-oil', name: 'Aceite de soya · FOB Brasil Paranaguá', unit: 'USD/MT', decimals: 1, fallbackPrice: 1245.5, fallbackUsdPerMt: 1245.5, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Paranaguá, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/brazil-soybean-oil', fallbackBasis: 'Evaluación física indicativa FOB Paranaguá US$1.245,50/MT, 9 Oct 2026.', fallbackNote: 'Indicativo; no confundir con futuro CBOT ni con aceite desgomado sin ajuste de especificación.', fallbackStatus: 'FOB Brasil · 9 Oct 2026' },
  { id: 'ag-soybean-meal', name: 'Harina de soya 48% · FOB Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 400, fallbackUsdPerMt: 400, fallbackTime: Math.floor(Date.parse('2026-10-03T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Brasil, 3 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/soymeal-48-brazil', fallbackBasis: 'Evaluación semanal indicativa FOB Brasil de harina de soya con 48% proteína: US$400/MT, rango US$394–406.', fallbackNote: 'El precio depende de proteína, fibra, humedad y puerto; no mezclar con harina argentina 47%.', fallbackStatus: 'FOB Brasil · 3 Oct 2026' },
  { id: 'ag-sunflower-seed', name: 'Semilla de girasol · FOB Argentina', unit: 'USD/MT', decimals: 1, fallbackPrice: 569, fallbackUsdPerMt: 569, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Evaluación indicativa FOB Argentina US$569/MT, 9 Oct 2026.', fallbackNote: 'Confirmar especificación de semilla, puerto y ventana de embarque.', fallbackStatus: 'FOB Argentina · 9 Oct 2026' },
  { id: 'ag-soy-fob-argentina', name: 'Soja en grano · FOB Argentina', unit: 'USD/MT', decimals: 1, fallbackPrice: 506, fallbackUsdPerMt: 506, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/soybeans-argentina', fallbackBasis: 'Cotización diaria indicativa FOB Argentina US$506/MT, 9 Oct 2026; evaluación semanal anterior US$505/MT.', fallbackNote: 'Indicativo, no oferta vinculante.', fallbackStatus: 'FOB Argentina · 9 Oct 2026' },
  { id: 'ag-corn-argentina', name: 'Maíz · FOB Argentina Upriver', unit: 'USD/MT', decimals: 1, fallbackPrice: 225, fallbackUsdPerMt: 225, fallbackTime: Math.floor(Date.parse('2026-10-03T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina Upriver, 3 Oct 2026', fallbackUrl: 'https://commodityscope.com/markets/americas', fallbackBasis: 'Evaluación semanal indicativa FOB Argentina Upriver US$225/MT, 3 Oct 2026.', fallbackNote: 'Precio indicativo, no oferta ejecutable.', fallbackStatus: 'FOB Argentina · 3 Oct 2026' },
  { id: 'ag-soymeal-argentina', name: 'Harina de soya 47% · FOB Argentina', unit: 'USD/MT', decimals: 1, fallbackPrice: 400, fallbackUsdPerMt: 400, fallbackTime: Math.floor(Date.parse('2026-10-03T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina, 3 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices/soymeal-48-brazil', fallbackBasis: 'Evaluación semanal indicativa FOB Argentina para harina de soya 47%: US$400/MT, 3 Oct 2026.', fallbackNote: 'Especificación 47% proteína; no comparar como idéntica a harina brasileña 48%.', fallbackStatus: 'FOB Argentina · 3 Oct 2026' },
  { id: 'ag-soyoil-argentina', name: 'Aceite de soya · FOB Argentina', unit: 'USD/MT', decimals: 1, fallbackPrice: 1233.25, fallbackUsdPerMt: 1233.25, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Evaluación indicativa FOB Argentina US$1.233,25/MT, 9 Oct 2026.', fallbackNote: 'Producto físico; comparar con Brasil solo después de confirmar calidad, terminal y ventana de carga.', fallbackStatus: 'FOB Argentina · 9 Oct 2026' },
  { id: 'ag-sunflower-oil-argentina', name: 'Aceite de girasol · FOB Argentina', unit: 'USD/MT', decimals: 1, fallbackPrice: 1327.5, fallbackUsdPerMt: 1327.5, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'CommodityScope · FOB Argentina, 9 Oct 2026', fallbackUrl: 'https://commodityscope.com/prices', fallbackBasis: 'Evaluación indicativa FOB Argentina US$1.327,50/MT, 9 Oct 2026.', fallbackNote: 'Confirmar perfil de ácidos grasos, refinación, calidad y terminal.', fallbackStatus: 'FOB Argentina · 9 Oct 2026' }
];

await buildFile('energy-prices.json', energy);
await buildFile('mining-prices.json', mining);
await buildFile('fertilizers-chemicals-prices.json', fertilizerChemicals);
await buildFile('agricultural-prices.json', agriculture);
