import type { FeedstockType, Product } from '@/types';

export type ProductFamily = 'uco' | 'vegetable_oils' | 'off_spec' | 'acid_oils_fatty_acids' | 'secondary_residues';

export const PRODUCT_FAMILY_LABELS: Record<ProductFamily, string> = {
  uco: 'UCO / AVU',
  vegetable_oils: 'Vegetable Oils / Mixed Vegetable Feedstock',
  off_spec: 'Off-Spec Oils',
  acid_oils_fatty_acids: 'Acid Oils / Fatty Acids / Soapstock',
  secondary_residues: 'Secondary / Extraction Residues',
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