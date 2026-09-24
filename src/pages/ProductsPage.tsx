import { useMemo, useState } from 'react';
import { useNav } from '@/context/NavContext';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, CargaSpinner, ErrorState, Button, Input, Seleccionar, Badge, Modal, PageHeader } from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { getProductoFamilia, PRODUCT_FAMILY_LABELS, type ProductoFamilia } from '@/utils/productFamilies';
import { Plus, Package, Trash2 } from 'lucide-react';
import type { Producto, FeedstockType, VerificaciónStatus } from '@/types';
import { FEEDSTOCK_LABELS, VERIFICATION_LABELS } from '@/types';

const FEEDSTOCK_OPTIONS = Object.entries(FEEDSTOCK_LABELS).map(([value, label]) => ({ value, label }));
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<Producto, 'id' | 'created_at' | 'updated_at'> {
  return { supplier_id: supplierId, name: '', feedstock_type: 'uco', origin: '', composition: '', available_volume: '', unit: 'MT', verification_status: 'claimed' };
}

export function ProductosPage() {
  const { procurementDomain } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Producto, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const { data: products, loading, error, refresh } = useAsync(() => procurementDomain ? getStore().products.getByDomainKey(procurementDomain) : getStore().products.getAll(), [procurementDomain]);
  const { data: suppliers } = useAsync(() => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(), [procurementDomain]);
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));
  const families = useMemo(() => {
    const map = new Map<ProductoFamilia, Producto[]>();
    for (const product of products ?? []) { const family = getProductoFamilia(product); map.set(family, [...(map.get(family) ?? []), product]); }
    return Array.from(map.entries());
  }, [products]);
  const openCrear = () => { setForm(emptyForm('')); setShowForm(true); };
  const save = async () => { if (!form || !form.supplier_id || !form.name) return; await getStore().products.create(form); setShowForm(false); refresh(); };
  const remove = async (id: string) => { if (!confirm('¿Eliminar este producto?')) return; await getStore().products.remove(id); refresh(); };
  if (loading) return <CargaSpinner />;
  if (error) return <ErrorState message={error} />;
  return (
    <div>
      <PageHeader title="Productoos" subtitle="Cinco familias de procurement; las variantes específicas permanecen dentro de cada familia." action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar producto</Button> : undefined} />
      {!products || products.length === 0 ? (
        <Card><EmptyState icon={<Package size={28} />} title="No hay productos registrados" message={suppliers && suppliers.length > 0 ? 'Registra tu primer feedstock o producto para seguir especificaciones técnicas y ofertas comerciales.' : 'Registra primero un proveedor y luego agrega sus productos.'} action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar producto</Button> : undefined} /></Card>
      ) : (
        <div className="space-y-4">
          {families.map(([family, familyProductos]) => (
            <Card key={family}><CardBody>
              <div className="flex items-center justify-between gap-4 mb-3"><div><h3 className="text-sm font-semibold text-gray-900">{PRODUCT_FAMILY_LABELS[family]}</h3><p className="text-xs text-gray-500">{familyProductos.length} registro(s) vinculados a proveedores.</p></div><Badge color="blue">{familyProductos.length} registros</Badge></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-gray-200"><tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Variante</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Origen</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Volumenn</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Verificación</th><th className="px-3 py-2"></th>
              </tr></thead><tbody className="divide-y divide-gray-100">
                {familyProductos.map((p) => <tr key={p.id} className="hover:bg-gray-50"><td className="px-3 py-2 font-medium text-gray-900">{p.name}</td><td className="px-3 py-2 text-gray-600">{supplierMap.get(p.supplier_id) ?? '—'}</td><td className="px-3 py-2 text-gray-600">{p.origin || '—'}</td><td className="px-3 py-2 text-gray-600">{p.available_volume ? `${p.available_volume} ${p.unit}` : '—'}</td><td className="px-3 py-2"><Badge color={verificationColor(p.verification_status)}>{verificationLabel(p.verification_status)}</Badge></td><td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 size={14} /></Button></td></tr>)}
              </tbody></table></div>
            </CardBody></Card>
          ))}
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Agregar producto" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.name || !form?.supplier_id}>Crear</Button></>}>
        {form && <div className="space-y-3"><Seleccionar label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required /><Input label="Nombre del producto / variante" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Seleccionar label="Tipo de feedstock" value={form.feedstock_type} onChange={(v) => setForm({ ...form, feedstock_type: v as FeedstockType })} options={FEEDSTOCK_OPTIONS} /><Input label="Origen" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} /><Input label="Composición" value={form.composition} onChange={(v) => setForm({ ...form, composition: v })} /><div className="grid grid-cols-2 gap-3"><Input label="Volumenn disponible" value={form.available_volume} onChange={(v) => setForm({ ...form, available_volume: v })} /><Input label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} /></div><Seleccionar label="Estado de verificación" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificaciónStatus })} options={VERIFICATION_OPTIONS} /></div>}
      </Modal>
    </div>
  );
}