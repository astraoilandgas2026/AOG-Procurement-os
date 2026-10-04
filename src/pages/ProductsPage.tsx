import { useMemo, useState } from 'react';
import { useNav } from '@/context/NavContext';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Input, Select, Badge, Modal, PageHeader } from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { getProductFamily, PRODUCT_FAMILY_LABELS, displayProductName, productCategoryLabel, type ProductFamily } from '@/utils/productFamilies';
import type { Product, FeedstockType, ProcurementDomain, VerificationStatus } from '@/types';
import { FEEDSTOCK_LABELS, VERIFICATION_LABELS } from '@/types';
import { Plus, Package, Trash2 } from 'lucide-react';

const FEEDSTOCK_OPTIONS = Object.entries(FEEDSTOCK_LABELS).map(([value, label]) => ({ value, label }));
const ENERGY_COMMODITY_OPTIONS = [
  { value: 'crude_oil', label: 'Crudo' },
  { value: 'refined_products', label: 'Productos refinados / derivados' },
  { value: 'lng_natural_gas', label: 'LNG / Gas natural' },
  { value: 'ngls', label: 'NGLs' },
  { value: 'fuel_oil', label: 'Fuel Oil' },
  { value: 'other_energy', label: 'Otro commodity energético' },
];
const MINING_COMMODITY_OPTIONS = [
  { value: 'ores_concentrates', label: 'Minerales / concentrados' },
  { value: 'base_metals', label: 'Metales base' },
  { value: 'metal_scrap', label: 'Chatarra metálica' },
  { value: 'precious_metals', label: 'Metales preciosos' },
  { value: 'industrial_minerals', label: 'Minerales industriales' },
  { value: 'coal', label: 'Carbón' },
  { value: 'other_mining', label: 'Otro commodity minero' },
];
const FERTILIZER_COMMODITY_OPTIONS = [
  { value: 'nitrogen_fertilizers', label: 'Fertilizantes nitrogenados' },
  { value: 'phosphate_fertilizers', label: 'Fertilizantes fosfatados' },
  { value: 'potash_fertilizers', label: 'Fertilizantes potásicos' },
  { value: 'compound_fertilizers', label: 'Fertilizantes compuestos' },
  { value: 'fertilizer_raw_materials', label: 'Materias primas para fertilizantes' },
  { value: 'industrial_gases', label: 'Gases industriales' },
  { value: 'other_fertilizer_chemical', label: 'Otro fertilizante / químico' },
];
const AGRICULTURAL_COMMODITY_OPTIONS = [
  { value: 'grains', label: 'Granos' },
  { value: 'biomass_bioenergy', label: 'Biomasa / bioenergía' },
  { value: 'other_agricultural', label: 'Otro commodity agrícola' },
];
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

const FEEDSTOCK_TABLES: Array<{ family: ProductFamily; label: string; description: string }> = [
  { family: 'uco', label: 'UCO / AVU', description: 'Aceite de cocina usado y corrientes equivalentes' },
  { family: 'fatty_acids', label: 'Ácidos grasos', description: 'Ácidos grasos y corrientes equivalentes' },
  { family: 'acid_oils', label: 'Aceites ácidos', description: 'Aceites ácidos y corrientes equivalentes' },
  { family: 'vegetable_oils', label: 'Aceites vegetales', description: 'Aceites vegetales y mezclas de origen vegetal' },
  { family: 'degummed_oils', label: 'Aceites desgomados', description: 'Aceites desgomados' },
  { family: 'oleins', label: 'Oleínas', description: 'Oleínas y fracciones equivalentes' },
  { family: 'off_spec', label: 'Fuera de especificación / otros', description: 'Fuera de especificación y otras corrientes no clasificadas' },
];

const FEEDSTOCK_CANONICAL_NAMES: Partial<Record<FeedstockType, string>> = {
  uco: 'UCO',
  fatty_acids: 'Ácidos grasos',
  acid_oils: 'Aceites ácidos',
  vegetable_oil: 'Aceites vegetales',
  degummed_oil: 'Aceite desgomado',
  oleins: 'Oleínas',
  off_spec_oil: 'Fuera de especificación',
};

function emptyForm(supplierId: string, domain: ProcurementDomain): Omit<Product, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId,
    domain_id: undefined,
    name: domain === 'feedstock' ? 'UCO' : '',
    feedstock_type: domain === 'feedstock' ? 'uco' : 'other',
    commodity_category: domain === 'feedstock' ? 'feedstock' : '',
    origin: '',
    composition: '',
    available_volume: '',
    unit: 'MT',
    verification_status: 'claimed',
  };
}

function categoryOptions(domain: ProcurementDomain) {
  if (domain === 'feedstock') return FEEDSTOCK_OPTIONS;
  if (domain === 'energy_commodities') return ENERGY_COMMODITY_OPTIONS;
  if (domain === 'mining_commodities') return MINING_COMMODITY_OPTIONS;
  if (domain === 'fertilizers_chemicals') return FERTILIZER_COMMODITY_OPTIONS;
  return AGRICULTURAL_COMMODITY_OPTIONS;
}

function categoryLabel(domain: ProcurementDomain) {
  return domain === 'feedstock' ? 'Familia de producto' : 'Tipo de commodity';
}

function cleanProductVolume(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  const numeric = raw.match(/^[~≈]?\s*\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?\s*(?:MT|KG|L|t|ton(?:eladas)?)\s*(?:\/\s*(?:mes|month))?/i);
  if (numeric) return numeric[0].trim();
  if (/historical|historically|histórico|histórica|referencia histórica|activity reported|activity historically|collection,.*reported/i.test(raw)) return '';
  return raw;
}

function feedstockTableFamily(product: Product): ProductFamily {
  const family = getProductFamily(product);
  return ['uco', 'fatty_acids', 'acid_oils', 'vegetable_oils', 'degummed_oils', 'oleins', 'off_spec'].includes(family)
    ? family
    : 'off_spec';
}

export function ProductsPage() {
  const { procurementDomain, selectedSupplierId, selectSupplier } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'> | null>(null);

  const { data: rawProducts, loading, error, refresh } = useAsync(
    () => procurementDomain ? getStore().products.getByDomainKey(procurementDomain) : getStore().products.getAll(),
    [procurementDomain]
  );
  const { data: suppliers } = useAsync(
    () => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(),
    [procurementDomain]
  );

  const products = useMemo(
    () => (rawProducts ?? []).filter((product) => product.feedstock_type !== 'soapstock' && !/\bsoapstock\b|\bborra\b/i.test(product.name)),
    [rawProducts]
  );

  const supplierMap = useMemo(
    () => new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Proveedor sin nombre'])),
    [suppliers]
  );

  const feedstockTables = useMemo(() => {
    const groups = new Map<ProductFamily, Product[]>();
    for (const product of products) {
      const family = feedstockTableFamily(product);
      groups.set(family, [...(groups.get(family) ?? []), product]);
    }
    return FEEDSTOCK_TABLES.map((table) => ({
      ...table,
      products: (groups.get(table.family) ?? []).sort((a, b) =>
        (supplierMap.get(a.supplier_id) ?? '').localeCompare(supplierMap.get(b.supplier_id) ?? '') ||
        displayProductName(a.name).localeCompare(displayProductName(b.name))
      ),
    }));
  }, [products, supplierMap]);

  const supplierGroups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products) map.set(product.supplier_id, [...(map.get(product.supplier_id) ?? []), product]);
    return Array.from(map.entries()).map(([supplierId, supplierProducts]) => ({
      supplierId,
      supplierName: supplierMap.get(supplierId) ?? 'Proveedor sin nombre',
      products: supplierProducts.sort((a, b) => displayProductName(a.name).localeCompare(displayProductName(b.name))),
    }));
  }, [products, supplierMap]);

  if (!procurementDomain) return <ErrorState message="Selecciona un dominio de procurement antes de gestionar productos." />;
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const openCrear = () => {
    setForm(emptyForm(selectedSupplierId ?? suppliers?.[0]?.id ?? '', procurementDomain));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.name) return;
    if (procurementDomain !== 'feedstock' && !form.commodity_category) return;
    await getStore().products.create({ ...form, domain_id: procurementDomain });
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await getStore().products.remove(id);
    refresh();
  };

  const selectFeedstockFamily = (value: FeedstockType) => {
    const canonicalName = FEEDSTOCK_CANONICAL_NAMES[value] ?? FEEDSTOCK_LABELS[value];
    setForm((current) => current ? {
      ...current,
      feedstock_type: value,
      commodity_category: 'feedstock',
      name: canonicalName,
    } : current);
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={procurementDomain === 'feedstock' ? 'Catálogo de materias primas normalizado por familia' : 'Catálogo de productos del dominio seleccionado'}
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar producto</Button> : undefined}
      />

      {!products || products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={28} />}
            title="No hay productos registrados"
            message={suppliers && suppliers.length > 0 ? 'Registra un producto para seguir especificaciones, volumen y evidencia.' : 'Registra primero un proveedor y luego agrega sus productos.'}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar producto</Button> : undefined}
          />
        </Card>
      ) : procurementDomain === 'feedstock' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {feedstockTables.map((table) => (
              <div key={table.family} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-[var(--astra-dark)]">{table.label}</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--astra-orange)]">{table.products.length}</div>
                <div className="text-[10px] text-slate-400">registros</div>
              </div>
            ))}
          </div>

          {feedstockTables.map((table) => (
            <Card key={table.family}>
              <CardBody className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--astra-dark)]">{table.label}</h3>
                    <p className="text-xs text-slate-500">{table.description}</p>
                  </div>
                  <Badge color={table.products.length ? 'blue' : 'gray'}>{table.products.length}</Badge>
                </div>
                {table.products.length === 0 ? (
                  <div className="px-4 py-5 text-xs text-slate-400">Sin registros en esta familia.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Proveedor</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Origen</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Volumen</th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {table.products.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium text-slate-800">
                              <button className="text-left hover:underline" onClick={() => selectSupplier(product.supplier_id)}>
                                {supplierMap.get(product.supplier_id) ?? 'Proveedor sin nombre'}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-slate-700">
                              {displayProductName(product.name)}
                              {product.composition && <div className="text-[10px] text-slate-400">{product.composition}</div>}
                            </td>
                            <td className="px-4 py-2 text-slate-600">{product.origin || '—'}</td>
                            <td className="px-4 py-2 text-slate-600">{cleanProductVolume(product.available_volume) || '—'}</td>
                            <td className="px-4 py-2"><Badge color={verificationColor(product.verification_status)}>{verificationLabel(product.verification_status)}</Badge></td>
                            <td className="px-4 py-2 text-right">
                              <Button size="sm" variant="ghost" onClick={() => remove(product.id)}><Trash2 size={14} /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {supplierGroups.map(({ supplierId, supplierName, products: supplierProducts }) => (
            <Card key={supplierId} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => selectSupplier(supplierId)}>
              <CardBody>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{supplierName}</h3>
                    <p className="text-xs text-gray-500">{supplierProducts.length} producto(s) vinculados</p>
                  </div>
                  <Badge color="blue">{supplierProducts.length}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Producto</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Tipo</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Origen</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Volumen</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supplierProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{displayProductName(product.name)}</td>
                          <td className="px-3 py-2 text-gray-600">{productCategoryLabel(product.commodity_category) || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{product.origin || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{cleanProductVolume(product.available_volume) || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); remove(product.id); }}><Trash2 size={14} /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Agregar producto"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.name || !form?.supplier_id || (procurementDomain !== 'feedstock' && !form?.commodity_category)}>Crear</Button></>}
      >
        {form && (
          <div className="space-y-3">
            <Select
              label="Proveedor"
              value={form.supplier_id}
              onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))}
              required
            />

            {procurementDomain === 'feedstock' && (
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-700">Familia de producto</div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {FEEDSTOCK_TABLES.map((table) => {
                    const option = table.family === 'off_spec' ? 'off_spec_oil' : table.family;
                    const selected = getProductFamily(form) === table.family;
                    return (
                      <button
                        key={table.family}
                        type="button"
                        onClick={() => selectFeedstockFamily(option as FeedstockType)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${selected ? 'border-[var(--astra-orange)] bg-[var(--astra-orange-soft)] text-[var(--astra-dark)]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {table.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Input label="Nombre mostrado" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />

            <Select
              label={categoryLabel(procurementDomain)}
              value={procurementDomain === 'feedstock' ? form.feedstock_type : form.commodity_category}
              onChange={(v) => setForm({
                ...form,
                ...(procurementDomain === 'feedstock'
                  ? { feedstock_type: v as FeedstockType, commodity_category: 'feedstock' }
                  : { commodity_category: v }),
              })}
              options={categoryOptions(procurementDomain)}
              required={procurementDomain !== 'feedstock'}
            />

            <Input label="Origen" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} />
            <Input label="Composición / especificación" value={form.composition} onChange={(v) => setForm({ ...form, composition: v })} />

            <div className="grid grid-cols-2 gap-3">
              <Input label="Volumen disponible" value={form.available_volume} onChange={(v) => setForm({ ...form, available_volume: v })} />
              <Input label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            </div>

            <Select label="Estado de verificación" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })} options={VERIFICATION_OPTIONS} />
          </div>
        )}
      </Modal>
    </div>
  );
}
