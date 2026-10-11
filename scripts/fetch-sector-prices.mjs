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

async function buildFile(fileName, definitions) {
  const filePath = path.join(outDir, fileName);
  const old = await fs.readFile(filePath, 'utf8').then(JSON.parse).catch(() => ({ instruments: [] }));
  const oldById = new Map((old.instruments || []).map((item) => [item.id, item]));
  const instruments = [];

  for (const def of definitions) {
    const previous = oldById.get(def.id);
    let q = null;
    if (def.symbol) {
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
        note: def.note, stale: false, status: 'Benchmark financiero actualizado',
        symbol: def.symbol, currency: q.currency
      });
    } else if (previous) {
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
        stale: true, status: def.fallbackPrice != null ? 'Última referencia pública localizada' : 'Sin cotización pública comparable'
      });
    }
  }

  await fs.writeFile(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), delayMinutes: 15, instruments }, null, 2) + '\n');
  const priced = instruments.filter((x) => typeof x.price === 'number').length;
  console.log(fileName + ': ' + priced + '/' + instruments.length + ' referencias numéricas; ' + instruments.filter((x) => !x.stale).length + ' actualizadas automáticamente.');
}

const energy = [
  { id: 'crude-oil', name: 'Petróleo crudo físico (Brent benchmark)', symbol: 'BZ=F', unit: 'USD/bbl', decimals: 2, sourceUrl: 'https://finance.yahoo.com/quote/BZ=F/', basis: 'Futuro ICE Brent en USD/barril; referencia global, no cotización de un grado físico específico.', note: 'El precio de Basrah, Olmeca u otro crudo depende de calidad, diferencial, origen, puerto e Incoterm.' },
  { id: 'en590-distillates', name: 'EN590 10 ppm / Destilados (ULSD proxy)', symbol: 'HO=F', factor: 1, unit: 'USD/gal', decimals: 4, sourceUrl: 'https://finance.yahoo.com/quote/HO=F/', basis: 'Futuro NYMEX ULSD en USD/galón como proxy de destilados; conversión orientativa a USD/MT ≈ precio × 313.7.', note: 'Proxy financiero, no oferta física EN590 ni diferencial de calidad/origen. La conversión por masa depende de la densidad.' , usdPerMtFactor: 313.7 },
  { id: 'jet-a1', name: 'Jet Fuel A1 (ULSD proxy)', symbol: 'HO=F', unit: 'USD/gal', decimals: 4, sourceUrl: 'https://finance.yahoo.com/quote/HO=F/', basis: 'ULSD NYMEX utilizado únicamente como proxy direccional; no es un benchmark específico de Jet A1.', note: 'El Jet A1 físico requiere cotización por región, especificación, terminal y fecha.' , usdPerMtFactor: 313.7 },
  { id: 'lng-gas', name: 'LNG / Gas natural (Henry Hub)', symbol: 'NG=F', unit: 'USD/MMBtu', decimals: 3, sourceUrl: 'https://finance.yahoo.com/quote/NG=F/', basis: 'Futuro Henry Hub en USD/MMBtu; referencia de gas natural de EE. UU., no precio de un cargamento LNG.', note: 'LNG entregado se valora por destino, ventana de entrega, fórmula contractual y coste de licuefacción/flete.' },
  { id: 'lpg-propane', name: 'LPG / Propano', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.eia.gov/dnav/pet/pet_pri_wfr_dcus_nus_w.htm', basis: 'Sin benchmark diario gratuito verificable integrado en este marcador.', note: 'No se sustituye por el precio de crudo o gas natural: requiere índice regional o cotización física de propano.' },
  { id: 'n-butane', name: 'n-Butano', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.eia.gov/', basis: 'Sin benchmark diario gratuito verificable integrado en este marcador.', note: 'El precio depende de región, pureza, punto de entrega y contrato; se requiere cotización específica.' },
  { id: 'residual-fuel-oil', name: 'Residual Fuel Oil', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm', basis: 'Sin benchmark público gratuito homogéneo integrado para la especificación física ofertada.', note: 'No se usa ULSD como sustituto del fuel oil residual; se requiere azufre, viscosidad, origen y puerto.' },
  { id: 'asphalt-bitumen', name: 'Asphalt / Bitumen', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.worldbank.org/en/research/commodity-markets', basis: 'Sin benchmark diario gratuito global comparable integrado.', note: 'Precio según grado, penetración, origen, embalaje, puerto y especificación.' },
  { id: 'lubricants', name: 'Lubricantes', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.worldbank.org/en/research/commodity-markets', basis: 'Sin benchmark único: depende del tipo de aceite base y paquete de aditivos.', note: 'Se requiere grado SAE/ISO, viscosidad, especificación y presentación para una referencia válida.' }
];

const mining = [
  { id: 'metallurgical-coal', name: 'Alabama Metallurgical Coal (hard coking coal benchmark)', unit: 'USD/MT', decimals: 0, fallbackPrice: 245, fallbackUsdPerMt: 245, fallbackTime: Math.floor(Date.parse('2026-07-31T12:00:00Z') / 1000), fallbackSource: 'IEA · Coal Mid-Year Update 2026', fallbackUrl: 'https://www.iea.org/reports/coal-mid-year-update-2026/prices', fallbackBasis: 'Hard coking coal FOB Australia: US$245/t en julio de 2026; benchmark indicativo de carbón coquizable, no precio de una carga Alabama/Colombia.', fallbackNote: 'Referencia pública de julio de 2026. El producto de Astra figura con origen Colombia en el registro; el precio físico requiere calidad, origen y puerto confirmados.' },
  { id: 'thermal-coal', name: 'Thermal Coal (Newcastle FOB)', unit: 'USD/MT', decimals: 0, fallbackPrice: 143, fallbackUsdPerMt: 143, fallbackTime: Math.floor(Date.parse('2026-10-09T12:00:00Z') / 1000), fallbackSource: 'Reuters · LSEG market pricing', fallbackUrl: 'https://www.reuters.com/commentary/reuters-open-interest/cheap-coal-expensive-gas-set-stage-year-end-coal-export-surge-2026-10-09/', fallbackBasis: 'Carbón térmico australiano Newcastle alrededor de US$143/t según referencia publicada el 9-oct-2026.', fallbackNote: 'Referencia de mercado Newcastle, no oferta física de un origen/grado específico. Ajustar por poder calorífico, azufre, cenizas, puerto e Incoterm.' },
  { id: 'copper-concentrate', name: 'Concentrado de cobre (30% Cu; benchmark Cu)', symbol: 'HG=F', unit: 'USD/lb', decimals: 4, usdPerMtFactor: 2204.62262185, sourceUrl: 'https://finance.yahoo.com/quote/HG=F/', basis: 'Futuro COMEX Copper en USD/lb; equivalente por tonelada de cobre contenido, no precio neto del concentrado.', note: 'No incluye pagabilidad, TC/RC, penalidades, humedad, flete ni deducciones; el concentrado no se cotiza igual que cobre refinado.' },
  { id: 'aluminium', name: 'Aluminium (benchmark aluminio)', symbol: 'ALI=F', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://finance.yahoo.com/quote/ALI=F/', basis: 'Futuro de aluminio USD/MT si el símbolo está disponible; verificar contrato y mercado de referencia.', note: 'Referencia financiera, no oferta física de aluminio con grado, forma, origen y entrega confirmados.' },
  { id: 'steel-scrap', name: 'Steel Scrap HMS 1&2', unit: 'USD/MT', decimals: 0, sourceUrl: 'https://www.lme.com/en/Metals/Ferrous/LME-Steel-Scrap', basis: 'Sin benchmark gratuito único integrado para HMS 1&2.', note: 'El precio depende de origen, puerto, densidad, contaminación, inspección, tamaño de lote e Incoterm.' }
];

await buildFile('energy-prices.json', energy);
await buildFile('mining-prices.json', mining);
