import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { Plus, Truck, Trash2 } from 'lucide-react';
import type { LogisticsInfo, TransportMode, ContainerType, VerificationStatus } from '@/types';
import { TRANSPORT_MODE_LABELS, CONTAINER_TYPE_LABELS, VERIFICATION_LABELS } from '@/types';

const TRANSPORT_OPTIONS = Object.entries(TRANSPORT_MODE_LABELS).map(([value, label]) => ({ value, label }));
const CONTAINER_OPTIONS = Object.entries(CONTAINER_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<LogisticsInfo, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, origin_location: '', loading_location: '',
    port: '', transport_mode: 'sea', container_type: 'flexitank',
    estimated_shipment_size: '', lead_time: '', export_readiness: 'claimed',
    notes: '',
  };
}

export function LogísticaPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<LogisticsInfo, 'id' | 'created_at' | 'updated_at'> | null>(null);

  const { data: logistics, loading, error, refresh } = useAsync(
    () => getStore().logistics.getAll(), []
  );
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));

  const openCrear = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id) return;
    await getStore().logistics.create(form);
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este registro logístico?')) return;
    await getStore().logistics.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Logística"
        subtitle="Preparación logística y exportación"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar logística</Button> : undefined}
      />

      {!logistics || logistics.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck size={28} />}
            title="No hay registros logísticos"
            message={suppliers && suppliers.length > 0
              ? "Registra puntos de carga, puertos, modos de transporte, tipos de contenedor, tamaños de embarque, tiempos de tránsito y preparación para exportación."
              : "Registra primero un proveedor y luego agrega la información logística."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar logística</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {logistics.map((l) => (
            <Card key={l.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{supplierMap.get(l.supplier_id) ?? '—'}</h3>
                    <p className="text-xs text-gray-500">{l.origin_location || 'Sin origen especificado'}</p>
                  </div>
                  <Badge color={verificationColor(l.export_readiness)}>{verificationLabel(l.export_readiness)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Transporte: <span className="font-medium text-gray-900">{TRANSPORT_MODE_LABELS[l.transport_mode]}</span></div>
                  <div>Contenedor: <span className="font-medium text-gray-900">{CONTAINER_TYPE_LABELS[l.container_type]}</span></div>
                  <div>Puerto: <span className="font-medium text-gray-900">{l.port || '—'}</span></div>
                  <div>Tiempo de tránsito: <span className="font-medium text-gray-900">{l.lead_time || '—'}</span></div>
                  <div>Tamaño de embarque: <span className="font-medium text-gray-900">{l.estimated_shipment_size || '—'}</span></div>
                  <div>Carga: <span className="font-medium text-gray-900">{l.loading_location || '—'}</span></div>
                </div>
                {l.notes && <p className="mt-2 text-xs text-gray-500">{l.notes}</p>}
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={() => remove(l.id)}><Trash2 size={14} /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Agregar registro logístico"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save}>Crear</Button></>}
      >
        {form && (
          <div className="space-y-3">
            <Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Input label="Ubicación de origen" value={form.origin_location} onChange={(v) => setForm({ ...form, origin_location: v })} />
            <Input label="Ubicación de carga" value={form.loading_location} onChange={(v) => setForm({ ...form, loading_location: v })} />
            <Input label="Puerto" value={form.port} onChange={(v) => setForm({ ...form, port: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Modo de transporte" value={form.transport_mode} onChange={(v) => setForm({ ...form, transport_mode: v as TransportMode })} options={TRANSPORT_OPTIONS} />
              <Select label="Tipo de contenedor" value={form.container_type} onChange={(v) => setForm({ ...form, container_type: v as ContainerType })} options={CONTAINER_OPTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Tamaño estimado del embarque" value={form.estimated_shipment_size} onChange={(v) => setForm({ ...form, estimated_shipment_size: v })} />
              <Input label="Tiempo de tránsito" value={form.lead_time} onChange={(v) => setForm({ ...form, lead_time: v })} />
            </div>
            <Select label="Preparación para exportación" value={form.export_readiness} onChange={(v) => setForm({ ...form, export_readiness: v as VerificationStatus })} options={VERIFICATION_OPTIONS} />
            <TextArea label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
