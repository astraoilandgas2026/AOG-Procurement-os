import type { FeedstockType, Product } from '@/types';

export type ProductFamily = 'uco' | 'vegetable_oils' | 'off_spec' | 'acid_oils_fatty_acids' | 'secondary_residues' | 'refined_petroleum' | 'crude_oil' | 'lng_natural_gas' | 'other_energy';

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  uco: 'UCO / AVU',
  vegetable_oils: 'Aceites vegetales / materia prima vegetal mixta',
  off_spec: 'Aceites fuera de especificación',
  acid_oils_fatty_acids: 'Aceites ácidos / ácidos grasos / borra',
  secondary_residues: 'Subproductos / residuos de extracción',
  refined_petroleum: 'Productos refinados / derivados del petróleo',
  crude_oil: 'Crudos',
  lng_natural_gas: 'LNG / Gas natural',
  other_energy: 'Otros commodities energéticos',
};

export function getProductFamily(product: Pick<Product, 'feedstock_type' | 'name' | 'commodity_category'>): ProductFamily {
  const name = product.name.toLowerCase();
  const category = (product.commodity_category || '').toLowerCase();
  if (/refined|petroleum|derivatives/.test(category)) return 'refined_petroleum';
  if (/crude/.test(category)) return 'crude_oil';
  if (/lng|natural.?gas/.test(category)) return 'lng_natural_gas';
  if (category && category !== 'feedstock') return 'other_energy';
  const type = product.feedstock_type as FeedstockType;
  if (type === 'uco' || /uco|used cooking|used frying|recovered cooking|avu/.test(name)) return 'uco';
  if (type === 'off_spec_oil' || /off[- ]spec/.test(name)) return 'off_spec';
  if (type === 'fatty_acids' || type === 'acid_oils' || type === 'soapstock' || /acid oil|fatty acid|soapstock|borra/.test(name)) return 'acid_oils_fatty_acids';
  if (type === 'oilseed_residues' || /residue|residues|açaí|andiroba|murumuru|patauá|extraction/.test(name)) return 'secondary_residues';
  return 'vegetable_oils';
}

export function displayProductName(name: string): string {
  const raw = name.trim();
  if (!raw) return 'Producto sin nombre';

  let value = raw
    .replace(/\bUCO\s*\/\s*AVU\b/gi, 'UCO')
    .replace(/\bAVU\s*\/\s*UCO\b/gi, 'UCO')
    .replace(/\bUsed Cooking Oil\b/gi, 'UCO')
    .replace(/\bUsed Frying Oil\b/gi, 'UCO')
    .replace(/\bRecovered Cooking Oil\b/gi, 'UCO');

  const replacements: Array<[RegExp, string]> = [
    [/vegetable oils?/gi, 'Aceites vegetales'],
    [/mixed vegetable feedstock/gi, 'Materia prima vegetal mixta'],
    [/mixed vegetable/gi, 'Vegetal mixto'],
    [/mixed cotton/gi, 'Mixo de algodón y soya'],
    [/cotton/gi, 'Algodón'],
    [/soybean/gi, 'Soya'],
    [/soy/gi, 'Soya'],
    [/fatty acids?/gi, 'Ácidos grasos'],
    [/acid oils?/gi, 'Aceites ácidos'],
    [/soapstock/gi, 'Borra'],
    [/off[- ]spec(?:ification)?/gi, 'Fuera de especificación'],
    [/degummed oil/gi, 'Aceite desgomado'],
    [/oleins?/gi, 'Oleínas'],
    [/oilseed residues?/gi, 'Residuos oleaginosos'],
    [/industrial returns/gi, 'Retornos industriales'],
    [/residues?/gi, 'Residuos'],
    [/extraction/gi, 'Extracción'],
  ];

  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);

  value = value
    .replace(/\bAVU\b/gi, 'UCO')
    .replace(/\bUCO\s*\/\s*UCO\b/gi, 'UCO')
    .replace(/\bUCO\s*\/\s*AVU\b/gi, 'UCO')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return value;
}

export const COMMODITY_CATEGORY_LABELS: Record<string, string> = {
  crude_oil: 'Crudo',
  refined_products: 'Productos refinados / derivados',
  lng_natural_gas: 'LNG / Gas natural',
  ngls: 'NGLs',
  fuel_oil: 'Fuel Oil',
  other_energy: 'Otro commodity energético',
  ores_concentrates: 'Minerales / concentrados',
  base_metals: 'Metales base',
  precious_metals: 'Metales preciosos',
  industrial_minerals: 'Minerales industriales',
  coal: 'Carbón',
  other_mining: 'Otro commodity minero',
};

export function productCategoryLabel(category: string | undefined): string {
  if (!category || category === 'feedstock') return '';
  return COMMODITY_CATEGORY_LABELS[category] || category.replaceAll('_', ' ');
}
