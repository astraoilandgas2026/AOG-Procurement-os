import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { useNav } from '@/context/NavContext';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, Badge, Modal, PageHeader,
} from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { formatDate } from '@/utils/date';
import { Plus, DollarSign, Trash2, Edit3 } from 'lucide-react';
import type { ComercialOffer, Incoterm, VerificationStatus } from '@/types';
import { VERIFICATION_LABELS } from '@/types';

const INCOTERM_OPTIONS: { value: string; label: string }[] = [
  'EXW','FCA','FOB','FAS','CFR','CIF','CPT','CIP','DAP','DPU','DDP'
].map((v) => ({ value: v, label: v }));

const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<ComercialOffer, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, product_id: '', price: '', currency: 'USD',
    price_basis: '', incoterm: 'FOB', loading_point: '', port: '',
    destination: '', payment_terms: '', offered_volume: '', trial_quantity: '',
    recurring_quantity: '', certification_premium: '', commercial_validity: '',
    verification_status: 'claimed',
  };
}

export function ComercialPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<ComercialOffer, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { procurementDomain } = useNav();

  const { data: offers, loading, error, refresh } = useAsync(
    async () => {
      const store = getStore();
      const offers = await store.commercialOffers.getAll();
      if (!procurementDomain) return offers;
      const suppliers = await store.suppliers.getByDomainKey(procurementDomain);
      const ids = new Set(suppliers.map(s => s.id));
      return offers.filter(o => ids.has(o.supplier_id));
    }, [procurementDomain]
  );
  const { data: suppliers } = useAsync(() => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(), [procurementDomain]);
  const { data: products } = useAsync(() => getStore().products.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));
  const productMap = new Map((products ?? []).map((p) => [p.id, p.name]));

  const openCreate = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.price) return;
    if (editingId) await getStore().commercialOffers.update(editingId, form);
    else await getStore().commercialOffers.create(form);
    setShowForm(false);
    setEditingId(null);
    refresh();
  };

  const openEdit = (o: ComercialOffer) => {
    const { id, created_at, updated_at, ...rest } = o;
    void created_at; void updated_at;
    setEditingId(id);
    setForm(rest);
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this commercial offer?')) return;
    await getStore().commercialOffers.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Comercial"
        subtitle="Comercial offers and pricing"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Offer</Button> : undefined}
      />

      {!offers || offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DollarSign size={28} />}
            title="No commercial offers recorded"
            message={suppliers && suppliers.length > 0
              ? "Record your first commercial offer to track pricing, Incoterms, payment terms, and negotiation history."
              : "Register a supplier first, then add commercial offers."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Offer</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {offers.map((o) => (
            <Card key={o.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {o.price} {o.currency} {o.price_basis && `/ ${o.price_basis}`}
                    </h3>
                    <p className="text-xs text-gray-500">{supplierMap.get(o.supplier_id) ?? '—'}</p>
                  </div>
                  <Badge color={verificationColor(o.verification_status)}>
                    {verificationLabel(o.verification_status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Incoterm: <span className="font-medium text-gray-900">{o.incoterm}</span></div>
                  <div>Port: <span className="font-medium text-gray-900">{o.port || '—'}</span></div>
                  <div>Offered: <span className="font-medium text-gray-900">{o.offered_volume || '—'}</span></div>
                  <div>Trial: <span className="font-medium text-gray-900">{o.trial_quantity || '—'}</span></div>
                  <div>Recurring: <span className="font-medium text-gray-900">{o.recurring_quantity || '—'}</span></div>
                  <div>Payment: <span className="font-medium text-gray-900">{o.payment_terms || '—'}</span></div>
                  {o.product_id && <div>Product: <span className="font-medium text-gray-900">{productMap.get(o.product_id) ?? '—'}</span></div>}
                  <div>Validity: <span className="font-medium text-gray-900">{formatDate(o.commercial_validity)}</span></div>
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(o)}><Edit3 size={14} /></Button><Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 size={14} /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Editar Oferta Comercial' : 'Agregar Oferta Comercial'}
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.price}>{editingId ? 'Guardar Cambios' : 'Crear'}</Button></>}
      >
        {form && (
          <div className="space-y-3">
            <Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Select label="Producto" value={form.product_id} onChange={(v) => setForm({ ...form, product_id: v })}
              options={(products ?? []).filter((p) => p.supplier_id === form.supplier_id).map((p) => ({ value: p.id, label: p.name }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Precio" required value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
              <Input label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
            </div>
            <Input label="Base de precio" value={form.price_basis} onChange={(v) => setForm({ ...form, price_basis: v })} />
            <Select label="Incoterm" value={form.incoterm} onChange={(v) => setForm({ ...form, incoterm: v as Incoterm })} options={INCOTERM_OPTIONS} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Punto de carga" value={form.loading_point} onChange={(v) => setForm({ ...form, loading_point: v })} />
              <Input label="Puerto" value={form.port} onChange={(v) => setForm({ ...form, port: v })} />
            </div>
            <Input label="Destino" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} />
            <Input label="Condiciones de pago" value={form.payment_terms} onChange={(v) => setForm({ ...form, payment_terms: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Volumen ofertado" value={form.offered_volume} onChange={(v) => setForm({ ...form, offered_volume: v })} />
              <Input label="Cantidad de prueba" value={form.trial_quantity} onChange={(v) => setForm({ ...form, trial_quantity: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cantidad recurrente" value={form.recurring_quantity} onChange={(v) => setForm({ ...form, recurring_quantity: v })} />
              <Input label="Cert. Premium" value={form.certification_premium} onChange={(v) => setForm({ ...form, certification_premium: v })} />
            </div>
            <Input label="Vigencia comercial" type="date" value={form.commercial_validity} onChange={(v) => setForm({ ...form, commercial_validity: v })} />
            <Select label="Verification Status" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })} options={VERIFICATION_OPTIONS} />
          </div>
        )}
      </Modal>
    </div>
  );
}
