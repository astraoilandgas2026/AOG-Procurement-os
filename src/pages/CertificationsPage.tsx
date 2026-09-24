import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import { formatDate } from '@/utils/date';
import { Plus, Award, Trash2 } from 'lucide-react';
import type { Certification } from '@/types';

const CERT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'pending', label: 'Pending' },
  { value: 'revoked', label: 'Revoked' },
];

function certStatusColor(status: string): 'green' | 'red' | 'amber' | 'gray' {
  switch (status) {
    case 'active': return 'green';
    case 'expired': return 'red';
    case 'pending': return 'amber';
    default: return 'gray';
  }
}

function emptyForm(supplierId: string): Omit<Certification, 'id' | 'created_at'> {
  return {
    supplier_id: supplierId, cert_type: 'ISCC', cert_number: '', status: 'pending',
    issue_date: '', expiration_date: '', issuing_body: '', notes: '',
  };
}

export function CertificationsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Certification, 'id' | 'created_at'> | null>(null);

  const { data: certs, loading, error, refresh } = useAsync(
    () => getStore().certifications.getAll(), []
  );
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));

  const openCreate = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.cert_type) return;
    await getStore().certifications.create(form);
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this certification?')) return;
    await getStore().certifications.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Certificaciones"
        subtitle="Certification tracking and evidence"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Certification</Button> : undefined}
      />

      {!certs || certs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Award size={28} />}
            title="No hay certificaciones registradas"
            message={suppliers && suppliers.length > 0
              ? "Track ISCC and other certifications, including certificate status, expiration, and supporting evidence."
              : "Register a supplier first, then add certifications."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Certification</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{c.cert_type}</h3>
                    <p className="text-xs text-gray-500">{supplierMap.get(c.supplier_id) ?? '—'}</p>
                  </div>
                  <Badge color={certStatusColor(c.status)}>{c.status}</Badge>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  {c.cert_number && <div>Cert #: {c.cert_number}</div>}
                  {c.issuing_body && <div>Issued by: {c.issuing_body}</div>}
                  <div>Issued: {formatDate(c.issue_date)}</div>
                  <div>Expires: {formatDate(c.expiration_date)}</div>
                  {c.notes && <p className="mt-2 text-gray-500">{c.notes}</p>}
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 size={14} /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Agregar certificación"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.cert_type}>Crear</Button></>}
      >
        {form && (
          <div className="space-y-3">
            <Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Input label="Tipo de certificación" value={form.cert_type} onChange={(v) => setForm({ ...form, cert_type: v })} placeholder="ISCC, RSB, etc." />
            <Input label="Número de certificado" value={form.cert_number} onChange={(v) => setForm({ ...form, cert_number: v })} />
            <Select label="Estado" value={form.status} onChange={(v) => setForm({ ...form, status: v as Certification['status'] })} options={CERT_STATUS_OPTIONS} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Fecha de emisión" type="date" value={form.issue_date} onChange={(v) => setForm({ ...form, issue_date: v })} />
              <Input label="Fecha de vencimiento" type="date" value={form.expiration_date} onChange={(v) => setForm({ ...form, expiration_date: v })} />
            </div>
            <Input label="Issuing Body" value={form.issuing_body} onChange={(v) => setForm({ ...form, issuing_body: v })} />
            <TextArea label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
