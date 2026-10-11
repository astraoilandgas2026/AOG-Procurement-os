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
  { id: 'crude-oil', name: 'Petróleo crudo · referencia FOB Brasil', unit: 'USD/bbl', decimals: 2, disablePrevious: true, sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Base comercial requerida: crudo brasileño exportable · FOB terminal/puerto de carga en Brasil.', note: 'Brent es un futuro global y no debe presentarse como precio FOB Brasil. Sin evaluación pública gratuita y verificable de un grado brasileño específico, se deja N/D hasta disponer de diferencial de calidad y terminal.' },
  { id: 'en590-distillates', name: 'Diésel EN590 10 ppm · FOB Brasil', unit: 'USD/MT', decimals: 0, disablePrevious: true, sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Base requerida: producto físico EN590 10 ppm · FOB terminal brasileña · USD/MT.', note: 'ULSD NYMEX es un proxy financiero estadounidense, no una oferta FOB Brasil. No se calcula un precio brasileño sin diferencial físico, especificación, terminal y fecha de carga.' },
  { id: 'jet-a1', name: 'Jet A-1 · FOB Brasil', unit: 'USD/MT', decimals: 0, disablePrevious: true, source: 'Sin benchmark público gratuito verificable para FOB Brasil', sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Base requerida: Jet A-1 exportable · FOB Brasil · USD/MT.', note: 'Se retira el promedio global de Jet Fuel como si fuera una oferta FOB Brasil. Requiere evaluación brasileña por terminal, fecha, especificación y volumen.' },
  { id: 'lng-gas', name: 'Gas natural / GNL · Brasil', unit: 'USD/MMBtu', decimals: 3, disablePrevious: true, source: 'Sin precio contractual brasileño verificable', sourceUrl: 'https://www.gov.br/anp/pt-br/assuntos/royalties-e-outras-participacoes/preco-de-referencia-do-gas-natural', basis: 'Para GNL exportable: FOB terminal de licuefacción en Brasil, si aplica. Para suministro a Eneva: punto de entrega y fórmula contractual en Brasil; el gas por red no se cotiza automáticamente como FOB.', note: 'Henry Hub es una referencia estadounidense y no representa el precio de suministro a Eneva ni un cargamento FOB Brasil. Se deja N/D hasta definir si la operación es GNL exportable o gas entregado en Brasil.' },
  { id: 'lpg-propane', name: 'Propano · base Brasil por confirmar', unit: 'USD/MT', decimals: 0, disablePrevious: true, source: 'Sin benchmark público gratuito verificable para FOB Brasil', sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Para exportación: propano físico · FOB terminal brasileña. Para suministro a Eneva: cotización en el punto de entrega en Brasil.', note: 'Se retira Mont Belvieu como precio principal: es un benchmark de Texas, no FOB Brasil ni una oferta para Eneva. Requiere cotización brasileña con pureza, volumen y terminal.' },
  { id: 'n-butane', name: 'Butano normal (n-butano) · base Brasil por confirmar', unit: 'USD/MT', decimals: 0, disablePrevious: true, source: 'Sin benchmark público gratuito verificable para FOB Brasil', sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Para exportación: n-butano físico · FOB terminal brasileña. Para suministro a Eneva: cotización en el punto de entrega en Brasil.', note: 'Se retira el proxy de futuros OPIS Mont Belvieu como precio brasileño. Requiere cotización de n-butano con pureza, volumen, terminal y fecha de carga/entrega.' },
  { id: 'residual-fuel-oil', name: 'Fuel oil residual · base FOB Brasil', unit: 'USD/MT', decimals: 2, disablePrevious: true, source: 'Sin benchmark público gratuito verificable para FOB Brasil', sourceUrl: 'https://www.gov.br/anp/pt-br', basis: 'Base requerida: fuel oil residual físico · FOB terminal brasileña · USD/MT; especificar azufre y viscosidad.', note: 'La referencia Platts FOB Mediterráneo no se presenta como precio brasileño. Requiere precio FOB Brasil para el grado y la fecha de carga.' },
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
  { id: 'fert-tsp', name: 'Superfosfato triple (TSP) · FOB Nueva Orleans', unit: 'USD/MT', decimals: 0, fallbackPrice: 766.15, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Green Markets · 9 Oct 2026', fallbackUrl: 'https://fertilizerpricing.com/market-watch-posts/', fallbackBasis: 'TSP NOLA FOB traded at USD 695/short ton on 9 October 2026; converted to USD/MT (×1.102311).', fallbackNote: 'Benchmark FOB Nueva Orleans (NOLA).', fallbackStatus: 'Ref. · 09 Oct 2026' },
  { id: 'fert-urea', name: 'Urea granular · CFR Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 462.5, fallbackTime: Math.floor(Date.parse('2026-10-08T12:00:00Z') / 1000), fallbackSource: 'Argus Nitrogen · 8 Oct 2026', fallbackUrl: 'https://www.argusmedia.com/en/commodities/fertilizers', fallbackBasis: 'Argus Nitrogen, Issue 26-199, 8 October 2026: Brazil granular urea USD 455–470/MT CFR. Displayed value is the arithmetic midpoint of the published range.', fallbackNote: 'Range: USD 455–470/MT CFR Brazil.', fallbackStatus: 'Argus · 08 Oct 2026' },
  { id: 'fert-ammonia', name: 'Amoníaco · CFR Tampa', unit: 'USD/MT', decimals: 0, fallbackPrice: 545, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Green Markets · 9 Oct 2026', fallbackUrl: 'https://fertilizerpricing.com/market-watch-posts/', fallbackBasis: 'Green Markets reported the Tampa ammonia contract at USD 545/MT CFR on 9 October 2026.', fallbackNote: 'Assessment/contract reference CFR Tampa.', fallbackStatus: 'Ref. · 09 Oct 2026' },
  { id: 'fert-dap', name: 'DAP · CFR India', unit: 'USD/MT', decimals: 1, fallbackPrice: 897.5, fallbackTime: Math.floor(Date.parse('2026-10-02T12:00:00Z') / 1000), fallbackSource: 'Global Fertiliser Markets · 2 Oct 2026', fallbackUrl: 'https://getthewordout.com.au/press-release/press-release-weekly-update-global-fertiliser-markets-w-e-02-10-2026-global-fertiliser-markets-wait-on-india-as-china-releases-more-urea/', fallbackBasis: 'Published indicative range USD 890–905/MT CFR India, dated 2 October 2026; displayed value is the range midpoint. Argus Phosphates dated 8 October describes prices as broadly steady but its indexed text did not expose a new numeric assessment.', fallbackNote: 'Range: USD 890–905/MT CFR India.', fallbackStatus: 'Ref. · 02 Oct 2026' },
  { id: 'fert-map', name: 'MAP · CFR Brasil', unit: 'USD/MT', decimals: 1, fallbackPrice: 840, fallbackTime: Math.floor(Date.parse('2026-10-02T12:00:00Z') / 1000), fallbackSource: 'Global Fertiliser Markets · 2 Oct 2026', fallbackUrl: 'https://getthewordout.com.au/press-release/press-release-weekly-update-global-fertiliser-markets-w-e-02-10-2026-global-fertiliser-markets-wait-on-india-as-china-releases-more-urea/', fallbackBasis: 'Published indicative range USD 830–850/MT CFR Brazil, dated 2 October 2026; displayed value is the range midpoint. Argus Phosphates dated 8 October describes prices as broadly steady but its indexed text did not expose a new numeric assessment.', fallbackNote: 'Range: USD 830–850/MT CFR Brazil.', fallbackStatus: 'Ref. · 02 Oct 2026' },
  { id: 'fert-mop', name: 'Potasa (MOP) · FOB Nueva Orleans', unit: 'USD/MT', decimals: 2, fallbackPrice: 388.56, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Green Markets · 9 Oct 2026', fallbackUrl: 'https://fertilizerpricing.com/market-watch-posts/', fallbackBasis: 'Green Markets reported USD 345–360/short ton FOB NOLA on 9 October 2026; displayed price is the midpoint converted to USD/MT (×1.102311).', fallbackNote: 'Source range: USD 345–360/short ton FOB NOLA.', fallbackStatus: 'Ref. · 09 Oct 2026' },
  { id: 'chem-methanol', name: 'Metanol', fetcher: 'methanex-methanol', unit: 'USD/MT', decimals: 0, source: 'Methanex · octubre 2026', sourceUrl: 'https://www.methanex.com/our-products/about-methanol/pricing/', basis: 'Precio contractual mensual publicado por Methanex para octubre de 2026.', note: 'Referencia contractual, no spot.' },
  { id: 'chem-petrochemical-feedstock', name: 'Feedstock petroquímico · Brent', symbol: 'BZ=F', unit: 'USD/bbl', decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/BZ=F/', basis: 'Futuro ICE Brent; indicador de materia prima, no precio de un químico terminado.', note: 'Proxy de coste de feedstock.' },
  { id: 'chem-benzene', name: 'Benceno · FOB Corea', fetcher: 'chemprice-benzene', unit: 'USD/MT', decimals: 0, source: 'Evaluación pública basada en Platts · 9 Oct 2026', sourceUrl: 'https://chempricehub.com/news/detail-market-trends-of-pure-benzene-in-asia-b7594.html', basis: 'Evaluación publicada FOB Corea: USD 1,247/MT el 9 de octubre de 2026.', note: 'Referencia regional asiática.', status: 'Platts · 09 Oct 2026', fallbackPrice: 1247, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Evaluación pública basada en Platts · 9 Oct 2026', fallbackUrl: 'https://chempricehub.com/news/detail-market-trends-of-pure-benzene-in-asia-b7594.html', fallbackBasis: 'USD 1,247/MT FOB Corea, 9 October 2026.', fallbackNote: 'Referencia regional asiática.', fallbackStatus: 'Ref. · 09 Oct 2026' },
  { id: 'chem-fatty-acids', name: 'Ácido oleico 75% mín.', fetcher: 'mblion-oleic', unit: 'USD/MT', decimals: 0, source: 'MBLion Oleo Malaysia', sourceUrl: 'https://www.mblionoleo.com/', basis: 'Precio indicativo FOB Malasia para ácido oleico 75% mínimo.', note: 'Confirmar vigencia de la lista antes de negociar.', status: 'Referencia indicativa', fallbackPrice: 1280, fallbackTime: Math.floor(Date.parse('2026-10-05T12:00:00Z') / 1000), fallbackSource: 'MBLion Oleo Malaysia', fallbackUrl: 'https://www.mblionoleo.com/', fallbackBasis: 'USD 1,280/MT, referencia visible en lista FOB Malasia de 5 octubre de 2026.', fallbackNote: 'Referencia indicativa.', fallbackStatus: 'Ref. · 05 Oct 2026' },
];

const agriculture = [
  { id: 'ag-soybeans', name: 'Soja en grano (CBOT futures)', symbol: 'ZS=F', factor: 0.367437, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ZS=F/', basis: 'Futuro CBOT de soja cotizado en USD/bushel convertido a USD/MT usando 36.7437 bushels por tonelada métrica.', note: 'Benchmark financiero de soja estadounidense, no precio FOB Brasil/Argentina ni precio local de semilla.' },
  { id: 'ag-corn', name: 'Maíz (CBOT futures)', symbol: 'ZC=F', factor: 0.393683, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ZC=F/', basis: 'Futuro CBOT de maíz en USD/bushel convertido a USD/MT (bushel comercial de 56 lb).', note: 'Benchmark financiero; ajustar por origen, calidad, humedad, puerto, basis local e Incoterm.' },
  { id: 'ag-wheat', name: 'Trigo (CBOT futures)', symbol: 'ZW=F', factor: 0.367437, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ZW=F/', basis: 'Futuro CBOT de trigo en USD/bushel convertido a USD/MT (bushel comercial de 60 lb).', note: 'El precio físico varía por clase, proteína, origen, puerto e Incoterm.' },
  { id: 'ag-soybean-oil', name: 'Aceite de soja (CBOT futures)', symbol: 'ZL=F', factor: 22.0462, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ZL=F/', basis: 'Futuro CBOT de aceite de soja cotizado en centavos USD/libra, convertido a USD/MT.', note: 'Benchmark financiero; no sustituye cotización FOB Santos/Paranaguá o FOB Argentina.' },
  { id: 'ag-soybean-meal', name: 'Harina de soja (CBOT futures)', symbol: 'ZM=F', factor: 1.10231, unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ZM=F/', basis: 'Futuro CBOT de harina de soja en USD/short ton convertido a USD/MT.', note: 'Referencia de mercado; ajustar por proteína, fibra, humedad, origen, puerto e Incoterm.' },
  { id: 'ag-sunflower-seed', name: 'Semilla de girasol (FOB Argentina)', fetcher: 'bolsa-sunflower', unit: 'USD/MT', decimals: 0, source: 'Bolsa de Cereales de Buenos Aires · precio oficial FOB', sourceUrl: 'https://www.bolsadecereales.com/precios-oficiales?lang=ingles', basis: 'Cotización FOB oficial de semilla de girasol de Argentina, posición octubre 2026, USD/MT; referencia de exportación regional.', note: 'El precio físico depende de fecha de embarque, calidad, origen, puerto y condiciones comerciales.', fallbackPrice: 569, fallbackUsdPerMt: 569, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Bolsa de Cereales de Buenos Aires · FOB oficial', fallbackUrl: 'https://www.bolsadecereales.com/precios-oficiales?lang=ingles', fallbackBasis: 'Precio FOB oficial para semilla de girasol, posición octubre 2026: USD 569/MT, publicado para el 9-oct-2026. Respaldo público; no es una cotización de entrega a Astra.', fallbackNote: 'Dato de respaldo con fecha explícita; reemplazar cuando se publique la próxima cotización oficial.' },
  { id: 'ag-soy-fob-argentina', name: 'Soja en grano (FOB Argentina, oficial)', unit: 'USD/MT', decimals: 0, fallbackPrice: 503, fallbackUsdPerMt: 503, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Bolsa de Cereales de Buenos Aires · FOB oficial', fallbackUrl: 'https://www.bolsadecereales.com/precios-oficiales?lang=ingles', fallbackBasis: 'Precio FOB oficial de soja, posición octubre 2026: USD 503/MT, publicado el 9-oct-2026. Referencia regional pública, no oferta vinculante.', fallbackNote: 'Referencia fechada; renovar al publicarse la próxima cotización oficial.' }
];

await buildFile('energy-prices.json', energy);
await buildFile('mining-prices.json', mining);
await buildFile('fertilizers-chemicals-prices.json', fertilizerChemicals);
await buildFile('agricultural-prices.json', agriculture);
