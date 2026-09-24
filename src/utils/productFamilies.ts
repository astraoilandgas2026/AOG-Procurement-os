import type { FeedstockType, Product } from '@/types';

export type ProductFamily = 'uco' | 'vegetable_oils' | 'off_spec' | 'acid_oils_fatty_acids' | 'secondary_residues';

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  uco: 'UCO / AVU',
  vegetable_oils: 'Aceites vegetales / materia prima vegetal mixta',
  off_spec: 'Aceites fuera de especificación',
  acid_oils_fatty_acids: 'Aceites ácidos / ácidos grasos / borra',
  secondary_residues: 'Subproductos / residuos de extracción',
};

export function getProductFamily(product: Pick<Product, 'feedstock_type' | 'name'>): ProductFamily {
  const name = product.name.toLowerCase();
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

  let value = raw;
  const replacements: Array<[RegExp, string]> = [
    [/used cooking oil/gi, 'Aceite de cocina usado'],
    [/used frying oil/gi, 'Aceite de fritura usado'],
    [/recovered cooking oil/gi, 'Aceite de cocina recuperado'],
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
  value = value.replace(/\bUCO\b/gi, 'UCO / AVU');
  value = value.replace(/\bAVU\b/gi, 'UCO / AVU');
  return value.replace(/\s{2,}/g, ' ').trim();
}
