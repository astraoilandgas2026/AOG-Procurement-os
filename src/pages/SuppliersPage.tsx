import { useState, type ReactNode } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { useNav } from '@/context/NavContext';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import {
  lifecycleColor, lifecycleLabel,
  verificationColor, verificationLabel,
} from '@/utils/statusHelpers';
import { formatDate } from '@/utils/date';
import {
  Building2, Plus, ArrowLeft, MapPin, FileText, Trash2, Edit3,
} from 'lucide-react';
import type { Supplier, SupplierLifecycle } from '@/types';
import { LIFECYCLE_LABELS, VERIFICATION_LABELS } from '@/types';

const LIFECYCLE_OPTIONS = Object.entries(LIFECYCLE_LABELS).map(([value, label]) => ({ value, label }));

function emptySupplierForm(): Omit<Supplier, 'id' | 'created_at' | 'updated_at'> {
  return {
    legal_name: '', trading_name: '', country: '', city: '', address: '',
    tax_id: '', cnae: '', administrator: '', legal_status: '',
    facility: '', operation_status: '', theoretical_capacity: '',
    real_production: '', available_volume: '', volume_to_astra: '',
    trial_volume: '', recurring_volume: '', infrastructure: '',
    lifecycle: 'prospect',
  };
}

export function SuppliersPage() {
  const { selectedSupplierId, selectSupplier } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptySupplierForm());

  const { data: suppliers, loading, error, refresh } = useAsync(
    () => getStore().suppliers.getAll(),
    []
  );

  const { data: selected } = useAsync(
    () => selectedSupplierId ? getStore().suppliers.getById(selectedSupplierId) : Promise.resolve(null),
    [selectedSupplierId]
  );

  // ---- Form helpers ----
  const openCreate = () => {
    setForm(emptySupplierForm());
    setEditing(false);
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    const { id, created_at, updated_at, ...rest } = s;
    void id; void created_at; void updated_at;
    setForm(rest);
    setEditing(true);
    setShowForm(true);
  };

  const save = async () => {
    if (editing && selectedSupplierId) {
      await getStore().suppliers.update(selectedSupplierId, form);
    } else {
      await getStore().suppliers.create(form);
    }
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this supplier and all related intelligence? This cannot be undone.')) return;
    await getStore().suppliers.remove(id);
    if (selectedSupplierId === id) selectSupplier(null);
    refresh();
  };

  // ---- Render ----
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  // Detail view
  if (selected && selectedSupplierId) {
    return (
      <SupplierDetail
        supplier={selected}
        onBack={() => selectSupplier(null)}
        onEdit={() => openEdit(selected)}
        onDelete={() => remove(selected.id)}
      />
    );
  }

  // List view
  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Supplier intelligence profiles"
        action={<Button onClick={openCreate}><Plus size={16} /> Add Supplier</Button>}
      />

      {!suppliers || suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={28} />}
            title="No suppliers registered"
            message="Register your first supplier to begin building procurement intelligence. Each supplier profile captures identity, operations, products, commercial offers, certifications, and due diligence."
            action={<Button onClick={openCreate}><Plus size={16} /> Add Supplier</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0" onClick={() => selectSupplier(s.id)}>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {s.legal_name || 'Unnamed Supplier'}
                    </h3>
                    {s.trading_name && (
                      <p className="text-xs text-gray-500 truncate">{s.trading_name}</p>
                    )}
                  </div>
                  <Badge color={lifecycleColor(s.lifecycle)}>{lifecycleLabel(s.lifecycle)}</Badge>
                </div>
                <div className="space-y-1 text-xs text-gray-500" onClick={() => selectSupplier(s.id)}>
                  {s.country && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} /> {s.city ? `${s.city}, ` : ''}{s.country}
                    </div>
                  )}
                  {s.tax_id && <div>Tax ID: {s.tax_id}</div>}
                  {s.facility && <div>Facility: {s.facility}</div>}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={() => selectSupplier(s.id)}>
                    <FileText size={14} /> View Profile
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Edit3 size={14} /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Supplier' : 'Register New Supplier'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.legal_name}>
              {editing ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </>
        }
      >
        <SupplierForm form={form} setForm={setForm} />
      </Modal>
    </div>
  );
}

// ============================================================
// Supplier Detail View
// ============================================================

function SupplierDetail({
  supplier,
  onBack,
  onEdit,
  onDelete,
}: {
  supplier: Supplier;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Back</Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{supplier.legal_name}</h1>
            {supplier.trading_name && (
              <p className="text-sm text-gray-500">{supplier.trading_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={lifecycleColor(supplier.lifecycle)}>{lifecycleLabel(supplier.lifecycle)}</Badge>
          <Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Edit</Button>
          <Button variant="danger" onClick={onDelete}><Trash2 size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DetailSection title="Identity">
          <DetailRow label="Legal Name" value={supplier.legal_name} />
          <DetailRow label="Trading Name" value={supplier.trading_name} />
          <DetailRow label="Country" value={supplier.country} />
          <DetailRow label="City" value={supplier.city} />
          <DetailRow label="Address" value={supplier.address} />
          <DetailRow label="Tax ID (CNPJ/RUT)" value={supplier.tax_id} />
          <DetailRow label="CNAE / Activity" value={supplier.cnae} />
          <DetailRow label="Administrator" value={supplier.administrator} />
          <DetailRow label="Legal Status" value={supplier.legal_status} />
        </DetailSection>

        <DetailSection title="Operation">
          <DetailRow label="Facility" value={supplier.facility} />
          <DetailRow label="Operation Status" value={supplier.operation_status} />
          <DetailRow label="Theoretical Capacity" value={supplier.theoretical_capacity} />
          <DetailRow label="Real Production" value={supplier.real_production} />
          <DetailRow label="Available Volume" value={supplier.available_volume} />
          <DetailRow label="Volume to Astra" value={supplier.volume_to_astra} />
          <DetailRow label="Trial Volume" value={supplier.trial_volume} />
          <DetailRow label="Recurring Volume" value={supplier.recurring_volume} />
          <DetailRow label="Infrastructure" value={supplier.infrastructure} />
        </DetailSection>

        <DetailSection title="Lifecycle & Timeline">
          <DetailRow label="Lifecycle" value={lifecycleLabel(supplier.lifecycle)} />
          <DetailRow label="Registered" value={formatDate(supplier.created_at)} />
          <DetailRow label="Last Updated" value={formatDate(supplier.updated_at)} />
        </DetailSection>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        <div className="space-y-2">{children}</div>
      </CardBody>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value || '—'}</span>
    </div>
  );
}

// ============================================================
// Supplier Form
// ============================================================

function SupplierForm({
  form,
  setForm,
}: {
  form: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
  setForm: (f: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => void;
}) {
  const update = (field: keyof typeof form, value: string) =>
    setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Identity</h4>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Legal Name" required value={form.legal_name} onChange={(v) => update('legal_name', v)} />
          <Input label="Trading Name" value={form.trading_name} onChange={(v) => update('trading_name', v)} />
          <Input label="Country" value={form.country} onChange={(v) => update('country', v)} />
          <Input label="City" value={form.city} onChange={(v) => update('city', v)} />
          <Input label="Tax ID (CNPJ/RUT)" value={form.tax_id} onChange={(v) => update('tax_id', v)} />
          <Input label="CNAE / Activity" value={form.cnae} onChange={(v) => update('cnae', v)} />
          <Input label="Administrator" value={form.administrator} onChange={(v) => update('administrator', v)} />
          <Input label="Legal Status" value={form.legal_status} onChange={(v) => update('legal_status', v)} />
        </div>
        <div className="mt-3">
          <TextArea label="Address" value={form.address} onChange={(v) => update('address', v)} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Operation</h4>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Facility" value={form.facility} onChange={(v) => update('facility', v)} />
          <Input label="Operation Status" value={form.operation_status} onChange={(v) => update('operation_status', v)} />
          <Input label="Theoretical Capacity" value={form.theoretical_capacity} onChange={(v) => update('theoretical_capacity', v)} />
          <Input label="Real Production" value={form.real_production} onChange={(v) => update('real_production', v)} />
          <Input label="Available Volume" value={form.available_volume} onChange={(v) => update('available_volume', v)} />
          <Input label="Volume to Astra" value={form.volume_to_astra} onChange={(v) => update('volume_to_astra', v)} />
          <Input label="Trial Volume" value={form.trial_volume} onChange={(v) => update('trial_volume', v)} />
          <Input label="Recurring Volume" value={form.recurring_volume} onChange={(v) => update('recurring_volume', v)} />
        </div>
        <div className="mt-3">
          <TextArea label="Infrastructure" value={form.infrastructure} onChange={(v) => update('infrastructure', v)} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Lifecycle</h4>
        <Select
          label="Supplier Lifecycle"
          value={form.lifecycle}
          onChange={(v) => update('lifecycle', v as SupplierLifecycle)}
          options={LIFECYCLE_OPTIONS}
        />
      </div>
    </div>
  );
}
