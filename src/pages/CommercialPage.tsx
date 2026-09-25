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
import { displayProductName } from '@/utils/productFamilies';
import { Plus, DollarSign, Trash2, Edit3, FileText } from 'lucide-react';
import type { CommercialOffer, Incoterm, VerificationStatus } from '@/types';
import { VERIFICATION_LABELS } from '@/types';

const INCOTERM_OPTIONS: { value: string; label: string }[] = [
  'EXW','FCA','FOB','FAS','CFR','CIF','CPT','CIP','DAP','DPU','DDP'
].map((v) => ({ value: v, label: v }));

const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<CommercialOffer, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, product_id: '', price: '', currency: 'USD', price_basis: '', incoterm: 'FOB', loading_point: '', port: '',
    destination: '', payment_terms: '', offered_volume: '', trial_quantity: '', recurring_quantity: '', certification_premium: '', commercial_validity: '',
    verification_status: 'claimed', price_unit: 'MT', price_date: '', source: '',
  };
}

export function CommercialPage() {
  const [showForm, setShowForm] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetOffer, setSheetOffer] = useState<CommercialOffer | null>(null);
  const [form, setForm] = useState<Omit<CommercialOffer, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [editingId, setEditaringId] = useState<string | null>(null);
  const { procurementDomain, selectSupplier } = useNav();

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
  const supplierLifecycleMap = new Map((suppliers ?? []).map((s) => [s.id, s.lifecycle]));
  const productMap = new Map((products ?? []).map((p) => [p.id, displayProductName(p.name)]));

  const normalizeSupplierName = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const priorityRank = (supplier: string) => {
    const value = normalizeSupplierName(supplier);
    if (value.includes('renovar oleos')) return 0;
    if (value.includes('fl oleos')) return 1;
    if (value.includes('olam agro')) return 2;
    return 3;
  };

  const isPrioritySupplier = (supplier: string) => priorityRank(supplier) < 3;

  const numericPrice = (offer: CommercialOffer) => {
    const match = String(offer.price ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };

  const prioritizedOffers = [...(offers ?? [])].sort((a, b) => {
    const supplierA = supplierMap.get(a.supplier_id) ?? '';
    const supplierB = supplierMap.get(b.supplier_id) ?? '';
    const rankA = priorityRank(supplierA);
    const rankB = priorityRank(supplierB);

    // 1) Prioridad primero: Renovar → FL Óleos → Olam.
    // 2) Dentro de cada proveedor prioritario, menor precio primero.
    // 3) Todos los demás proveedores después, también por menor precio.
    if (rankA !== rankB) {
      if (rankA < 3 && rankB < 3) return rankA - rankB;
      if (rankA < 3) return -1;
      if (rankB < 3) return 1;
    }

    return numericPrice(a) - numericPrice(b);
  });

  const offerStyle = (offer: CommercialOffer) => {
    if (isPrioritySupplier(supplierMap.get(offer.supplier_id) ?? '')) return 'border-l-4 border-l-red-500 bg-red-50/30';
    const lifecycle = supplierLifecycleMap.get(offer.supplier_id);
    if (lifecycle === 'qualified' || lifecycle === 'active' || lifecycle === 'trial' || lifecycle === 'recurring') {
      return 'border-l-4 border-l-amber-400 bg-amber-50/20';
    }
    if (lifecycle === 'prospect' || lifecycle === 'dd_pending') {
      return 'border-l-4 border-l-blue-400 bg-blue-50/20';
    }
    return 'border-l-4 border-l-slate-300 bg-white';
  };

  const openSheet = (offer: CommercialOffer) => { setSheetOffer(offer); setShowSheet(true); };

  const openCrear = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.price) return;
    if (editingId) await getStore().commercialOffers.update(editingId, form);
    else await getStore().commercialOffers.create(form);
    setShowForm(false);
    setEditaringId(null);
    refresh();
  };

  const openEdit = (o: CommercialOffer) => {
    const { id, created_at, updated_at, ...rest } = o;
    void created_at; void updated_at;
    setEditaringId(id);
    setForm(rest);
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta oferta comercial?')) return;
    await getStore().commercialOffers.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Comercial"
        subtitle="Ofertas comerciales y precios"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar oferta</Button> : undefined}
      />

      {!offers || offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DollarSign size={28} />}
            title="No hay ofertas comerciales registradas"
            message={suppliers && suppliers.length > 0
              ? "Registra la primera oferta comercial para seguir precios, Incoterms, condiciones de pago e historial de negociación."
              : "Registra primero un proveedor y luego agrega ofertas comerciales."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar oferta</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {prioritizedOffers.map((o) => (
            <Card key={o.id} className={`cursor-pointer transition-shadow hover:shadow-md ${offerStyle(o)}`} onClick={() => selectSupplier(o.supplier_id)}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {isPrioritySupplier(supplierMap.get(o.supplier_id) ?? '') && (
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-700">Prioridad</div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900">
                      {o.price || 'N/D'} {o.price ? o.currency : ''}{o.price_unit ? ` / ${o.price_unit}` : ''}
                    </h3>
                    <button type="button" onClick={() => selectSupplier(o.supplier_id)} className="text-left text-xs font-medium text-[var(--astra-blue)] hover:underline">{supplierMap.get(o.supplier_id) ?? '—'}</button>
                  </div>
                  <Badge color={verificationColor(o.verification_status)}>
                    {verificationLabel(o.verification_status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Incoterm: <span className="font-medium text-gray-900">{o.incoterm}</span></div>
                  <div>Puerto: <span className="font-medium text-gray-900">{o.port || '—'}</span></div>
                  <div>Ofertado: <span className="font-medium text-gray-900">{o.offered_volume || '—'}</span></div>
                  <div>Prueba: <span className="font-medium text-gray-900">{o.trial_quantity || '—'}</span></div>
                  <div>Recurrente: <span className="font-medium text-gray-900">{o.recurring_quantity || '—'}</span></div>
                  <div>Pago: <span className="font-medium text-gray-900">{o.payment_terms || '—'}</span></div>
                  {o.product_id && <div>Producto: <span className="font-medium text-gray-900">{productMap.get(o.product_id) ?? '—'}</span></div>}
                  <div>Vigencia: <span className="font-medium text-gray-900">{formatDate(o.commercial_validity)}</span></div>
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); openSheet(o); }}><FileText size={14} /> Ficha comercial</Button><Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); openEdit(o); }}><Edit3 size={14} /> Editar</Button><Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); remove(o.id); }}><Trash2 size={14} /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showSheet} onClose={() => setShowSheet(false)} title="Ficha comercial de la oferta"
        footer={<><Button variant="secondary" onClick={() => setShowSheet(false)}>Cerrar</Button><Button onClick={() => { setShowSheet(false); if (sheetOffer?.supplier_id) selectSupplier(sheetOffer.supplier_id); }}>Ver ficha del proveedor</Button></>}>
        {sheetOffer && (
          <div className="space-y-4 text-sm">
            <div><p className="text-xs text-gray-400">Proveedor</p><p className="font-semibold text-gray-900">{supplierMap.get(sheetOffer.supplier_id) ?? 'Proveedor sin nombre'}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-400">Precio</p><p className="font-semibold">{sheetOffer.price || 'N/D'} {sheetOffer.price ? sheetOffer.currency : ''}{sheetOffer.price_unit ? ` / ${sheetOffer.price_unit}` : ''}</p></div>
              <div><p className="text-xs text-gray-400">Base</p><p>{sheetOffer.price_basis || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Fecha precio</p><p>{sheetOffer.price_date || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Fuente</p><p>{sheetOffer.source || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Incoterm</p><p>{sheetOffer.incoterm || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Puerto</p><p>{sheetOffer.port || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Volumen ofertado</p><p>{sheetOffer.offered_volume || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Volumen de prueba</p><p>{sheetOffer.trial_quantity || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Suministro recurrente</p><p>{sheetOffer.recurring_quantity || '—'}</p></div>
              <div><p className="text-xs text-gray-400">Condiciones de pago</p><p>{sheetOffer.payment_terms || '—'}</p></div>
            </div>
            {sheetOffer.product_id && <div className="rounded-md border border-gray-200 bg-gray-50 p-3"><p className="text-xs text-gray-400">Producto</p><p className="font-medium text-gray-900">{productMap.get(sheetOffer.product_id) ?? '—'}</p></div>}
            <div className="rounded-md border border-gray-200 bg-white p-3"><p className="text-xs text-gray-400">Verificación</p><p className="font-medium text-gray-900">{verificationLabel(sheetOffer.verification_status)}</p></div>
          </div>
        )}
      </Modal>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Editar oferta comercial' : 'Agregar oferta comercial'}
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}><span>Cancelar</span></Button><Button onClick={save} disabled={!form?.supplier_id}>{editingId ? 'Guardar cambios' : 'Crear'}</Button></>}>
        {form && (
          <div className="space-y-3">
            <Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Select label="Producto" value={form.product_id} onChange={(v) => setForm({ ...form, product_id: v })} options={(products ?? []).filter((p) => p.supplier_id === form.supplier_id).map((p) => ({ value: p.id, label: p.name }))} />
            <div className="grid grid-cols-3 gap-3"><Input label="Precio" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /><Input label="Moneda" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} /><Input label="Unidad" value={form.price_unit} onChange={(v) => setForm({ ...form, price_unit: v })} /></div>
            <div className="grid grid-cols-2 gap-3"><Input label="Fecha del precio" value={form.price_date} onChange={(v) => setForm({ ...form, price_date: v })} /><Input label="Fuente" value={form.source} onChange={(v) => setForm({ ...form, source: v })} /></div>
            <Input label="Base de precio" value={form.price_basis} onChange={(v) => setForm({ ...form, price_basis: v })} />
            <Select label="Incoterm" value={form.incoterm} onChange={(v) => setForm({ ...form, incoterm: v as Incoterm })} options={INCOTERM_OPTIONS} />
            <div className="grid grid-cols-2 gap-3"><Input label="Punto de carga" value={form.loading_point} onChange={(v) => setForm({ ...form, loading_point: v })} /><Input label="Puerto" value={form.port} onChange={(v) => setForm({ ...form, port: v })} /></div>
            <Input label="Destino" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} />
            <Input label="Condiciones de pago" value={form.payment_terms} onChange={(v) => setForm({ ...form, payment_terms: v })} />
            <div className="grid grid-cols-2 gap-3"><Input label="Volumen ofertado" value={form.offered_volume} onChange={(v) => setForm({ ...form, offered_volume: v })} /><Input label="Cantidad de prueba" value={form.trial_quantity} onChange={(v) => setForm({ ...form, trial_quantity: v })} /></div>
            <div className="grid grid-cols-2 gap-3"><Input label="Cantidad recurrente" value={form.recurring_quantity} onChange={(v) => setForm({ ...form, recurring_quantity: v })} /><Input label="Prima de certificación" value={form.certification_premium} onChange={(v) => setForm({ ...form, certification_premium: v })} /></div>
            <Input label="Vigencia comercial" type="date" value={form.commercial_validity} onChange={(v) => setForm({ ...form, commercial_validity: v })} />
            <Select label="Estado de verificación" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })} options={VERIFICATION_OPTIONS} />
          </div>
        )}
      </Modal>
    </div>
  );
}
