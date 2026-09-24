import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import {
  priorityColor, priorityLabel,
  followUpStatusColor, followUpStatusLabel,
} from '@/utils/statusHelpers';
import { formatRelative, isOverdue } from '@/utils/date';
import { Plus, CheckSquare, Trash2 } from 'lucide-react';
import type { FollowUp, Priority, FollowUpStatus } from '@/types';
import { PRIORITY_LABELS, FOLLOWUP_STATUS_LABELS } from '@/types';

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(FOLLOWUP_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<FollowUp, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, title: '', description: '', responsible_person: '',
    due_date: '', priority: 'medium', status: 'open',
  };
}

export function FollowUpsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<FollowUp, 'id' | 'created_at' | 'updated_at'> | null>(null);

  const { data: followUps, loading, error, refresh } = useAsync(
    () => getStore().followUps.getAll(), []
  );
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));

  const openCreate = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.title) return;
    await getStore().followUps.create(form);
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este seguimiento?')) return;
    await getStore().followUps.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Seguimientos"
        subtitle="Acciones pendientes y próximos pasos"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Follow-up</Button> : undefined}
      />

      {!followUps || followUps.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckSquare size={28} />}
            title="No hay seguimientos registrados"
            message={suppliers && suppliers.length > 0
              ? "Registra próximas acciones, responsables, fechas límite y prioridades para mantener el procurement en movimiento."
              : "Register a supplier first, then add follow-ups."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Follow-up</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {followUps.map((f) => {
            const overdue = f.status !== 'completed' && isOverdue(f.due_date);
            return (
              <Card key={f.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                        {overdue && <Badge color="red">Vencido</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{supplierMap.get(f.supplier_id) ?? '—'}</p>
                      {f.description && <p className="text-sm text-gray-600 mb-2">{f.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {f.responsible_person && <span>Responsible: {f.responsible_person}</span>}
                        <span>Due: {formatRelative(f.due_date)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge color={priorityColor(f.priority)}>{priorityLabel(f.priority)}</Badge>
                      <Badge color={followUpStatusColor(f.status)}>{followUpStatusLabel(f.status)}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => remove(f.id)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Agregar seguimiento"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.title}>Crear</Button></>}
      >
        {form && (
          <div className="space-y-3">
            <Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Input label="Cargo" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <TextArea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <Input label="Responsable" value={form.responsible_person} onChange={(v) => setForm({ ...form, responsible_person: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Due Date" type="date" value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} />
              <Select label="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v as Priority })} options={PRIORITY_OPTIONS} />
            </div>
            <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v as FollowUpStatus })} options={STATUS_OPTIONS} />
          </div>
        )}
      </Modal>
    </div>
  );
}
