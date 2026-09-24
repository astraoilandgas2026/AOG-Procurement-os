import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, Badge, Modal, PageHeader,
} from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { Plus, Package, Trash2 } from 'lucide-react';
import type { Product, FeedstockType, VerificationStatus } from '@/types';
import { FEEDSTOCK_LABELS, VERIFICATION_LABELS } from '@/types';

const FEEDSTOCK_OPTIONS = Object.entries(FEEDSTOCK_LABELS).map(([value, label]) => ({ value, label }));
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<Product, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, name: '', feedstock_type: 'uco', origin: '',
    composition: '', available_volume: '', unit: 'MT',
    verification_status: 'claimed',
  };
}

export function ProductsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'> | null>(null);

  const { data: products, loading, error, refresh } = useAsync(
    () => getStore().products.getAll(), []
  );
  const { data: suppliers } = useAsync(
    () => getStore().suppliers.getAll(), []
  );

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Unknown']));

  const openCreate = () => {
    setForm(emptyForm(suppliers?.[0]?.id ?? ''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.name) return;
    await getStore().products.create(form);
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await getStore().products.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Feedstock and product registry"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Product</Button> : undefined}
      />

      {!products || products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={28} />}
            title="No products registered"
            message={suppliers && suppliers.length > 0
              ? "Register your first feedstock or product to start tracking technical specifications and commercial offers."
              : "Register a supplier first, then add products associated with that supplier."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCreate}><Plus size={16} /> Add Product</Button> : undefined}
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Feedstock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Origin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Volume</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Verification</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{FEEDSTOCK_LABELS[p.feedstock_type]}</td>
                    <td className="px-4 py-3 text-gray-600">{supplierMap.get(p.supplier_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.origin || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.available_volume ? `${p.available_volume} ${p.unit}` : '—'}</td>
                    <td className="px-4 py-3"><Badge color={verificationColor(p.verification_status)}>{verificationLabel(p.verification_status)}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Product"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form?.name || !form?.supplier_id}>Create</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <Select
              label="Supplier"
              value={form.supplier_id}
              onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Unnamed' }))}
              required
            />
            <Input label="Product Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Select
              label="Feedstock Type"
              value={form.feedstock_type}
              onChange={(v) => setForm({ ...form, feedstock_type: v as FeedstockType })}
              options={FEEDSTOCK_OPTIONS}
            />
            <Input label="Origin" value={form.origin} onChange={(v) => setForm({ ...form, origin: v })} />
            <Input label="Composition" value={form.composition} onChange={(v) => setForm({ ...form, composition: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Available Volume" value={form.available_volume} onChange={(v) => setForm({ ...form, available_volume: v })} />
              <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            </div>
            <Select
              label="Verification Status"
              value={form.verification_status}
              onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })}
              options={VERIFICATION_OPTIONS}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
