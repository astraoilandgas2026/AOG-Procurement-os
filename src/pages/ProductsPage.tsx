import { useMemo, useState } from 'react';
import { useNav } from '@/context/NavContext';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Input, Select, Badge, Modal, PageHeader } from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { getProductFamily, PRODUCT_FAMILY_LABELS, displayProductName, type ProductFamily } from '@/utils/productFamilies';
import { Plus, Package, Trash2 } from 'lucide-react';
import type { Product, FeedstockType, VerificationStatus } from '@/types';
import { FEEDSTOCK_LABELS, VERIFICATION_LABELS } from '@/types';

const FEEDSTOCK_OPTIONS = Object.entries(FEEDSTOCK_LABELS).map(([value, label]) => ({ value, label }));
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<Product, 'id' | 'created_at' | 'updated_at'> {
  return { supplier_id: supplierId, name: '', feedstock_type: 'uco', origin: '', composition: '', available_volume: '', unit: 'MT', verification_status: 'claimed' };
}

export function ProductsPage() {
  const { procurementDomain } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const { data: products, loading, error, refresh } = useAsync(() => procurementDomain ? getStore().products.getByDomainKey(procurementDomain) : getStore().products.getAll(), [procurementDomain]);
  const { data: suppliers } = useAsync(() => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(), [procurementDomain]);
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));
  const supplierGroups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products ?? []) map.set(product.supplier_id, [...(map.get(product.supplier_id) ?? []), product]);
    return Array.from(map.entries()).map(([supplierId, supplierProducts]) => ({
      supplierId,
      supplierName: supplierMap.get(supplierId) ?? 'Proveedor sin nombre',
      products: supplierProducts.sort((a, b) => displayProductName(a.name).localeCompare(displayProductName(b.name))),
    })).sort((a, b) => {
      const rank = (name: string) => {
        const value = name.toLowerCase();
        if (value.includes('fl óleos') || value.includes('fl oleos')) return 0;
        if (value.includes('olam agro')) return 1;
        if (value.includes('renovar')) return 2;
        return 100;
      };
      const rankA = rank(a.supplierName);
      const rankB = rank(b.supplierName);
      return rankA - rankB || a.supplierName.localeCompare(b.supplierName);
    });
  }, [products, supplierMap]);
  const openCrear = () => { setForm(emptyForm('')); setShowForm(true); };
  const save = async () => { if (!form || !form.supplier_id || !form.name) return; await getStore().products.create(form); setShowForm(false); refresh(); };
  const remove = async (id: string) => { if (!confirm('¿Eliminar este producto?')) return; await getStore().products.remove(id); refresh(); };
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  return (
    <div>
      {suppliers && suppliers.length > 0 && <div className="mb-4 flex justify-end"><Button onClick={openCrear}><Plus size={16} /> Agregar producto</Button></div>}
      {!products || products.length === 0 ? (
        <Card><EmptyState icon={<Package size={28} />} title="No hay productos registrados" message={suppliers && suppliers.length > 0 ? 'Registra tu primer producto para seguir especificaciones técnicas y ofertas comerciales.' : 'Registra primero un proveedor y luego agrega sus productos.'} /></Card>
      ) : (
        <div className="space-y-4">
          {supplierGroups.map(({ supplierId, supplierName, products: supplierProducts }) => {
            const familyMap = new Map<ProductFamily, Product[]>();
            for (const product of supplierProducts) {
              const family = getProductFamily(product);
              familyMap.set(family, [...(familyMap.get(family) ?? []), product]);
            }

            return (
              <Card key={supplierId}>
                <CardBody>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{supplierName}</h3>
                      <p className="text-xs text-gray-500">{supplierProducts.length} variante(s) de producto vinculadas</p>
                    </div>
                    <Badge color="blue">{supplierProducts.length}</Badge>
                  </div>

                  <div className="space-y-4">
                    {Array.from(familyMap.entries()).map(([family, familyProducts]) => (
                      <div key={family} className="rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold text-gray-800">{PRODUCT_FAMILY_LABELS[family]}</span>
                          <span className="text-[10px] text-gray-500">{familyProducts.length} variante(s)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Variante</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Origen</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Volumen</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Verificación</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {familyProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-900"><div>{displayProductName(p.name)}</div>{p.commodity_category && p.commodity_category !== 'feedstock' && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">{p.commodity_category.replaceAll('_', ' ')}</div>}</td>
                                  <td className="px-3 py-2 text-gray-600">{p.origin || '—'}</td>
                                  <td className="px-3 py-2 text-gray-600">{p.available_volume ? `${p.available_volume} ${p.unit}` : '—'}</td>
                                  <td className="px-3 py-2"><Badge color={verificationColor(p.verification_status)}>{verificationLabel(p.verification_status)}</Badge></td>
                                  <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 size={14} /></Button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Agregar producto" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.name || !form?.supplier_id}>Crear</Button></>}>
        {form && <div className="space-y-3"><Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required /><Input label="Nombre del producto / variante" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Select label="Tipo de feedstock" value={form.feedstock_type} onChange={(v) => setForm({ ...form, feedstock_type: v as FeedstockType })} options={FEEDSTOCK_OPTIONS} /><Input label="Origen" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} /><Input label="Composición" value={form.composition} onChange={(v) => setForm({ ...form, composition: v })} /><div className="grid grid-cols-2 gap-3"><Input label="Volumen disponible" value={form.available_volume} onChange={(v) => setForm({ ...form, available_volume: v })} /><Input label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} /></div><Select label="Estado de verificación" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })} options={VERIFICATION_OPTIONS} /></div>}
      </Modal>
    </div>
  );
}