import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import {
  ddStatusColor, ddStatusLabel,
} from '@/utils/statusHelpers';
import { formatDate } from '@/utils/date';
import { Plus, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react';
import type { DueDiligenceItem, RedFlag, DDCategory, DDStatus } from '@/types';
import { DD_CATEGORY_LABELS, DD_STATUS_LABELS } from '@/types';

const DD_CATEGORY_OPTIONS = Object.entries(DD_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const DD_STATUS_OPTIONS = Object.entries(DD_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function emptyDDForm(supplierId: string): Omit<DueDiligenceItem, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, category: 'legal', status: 'pending',
    findings: '', evidence_ref: '', reviewer: '', review_date: '',
  };
}

function emptyFlagForm(supplierId: string): Omit<RedFlag, 'id' | 'created_at'> {
  return {
    supplier_id: supplierId, flag_type: '', description: '', evidence: '',
    source: '', reviewer: '', flag_date: new Date().toISOString().slice(0, 10),
    status: 'open',
  };
}

export function DueDiligencePage() {
  const [showDDForm, setShowDDForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [ddForm, setDDForm] = useState<Omit<DueDiligenceItem, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [flagForm, setFlagForm] = useState<Omit<RedFlag, 'id' | 'created_at'> | null>(null);

  const { data: ddItems, loading, error, refresh } = useAsync(
    () => getStore().dueDiligence.getAll(), []
  );
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Unknown']));

  const openDDCreate = () => {
    setDDForm(emptyDDForm(suppliers?.[0]?.id ?? ''));
    setShowDDForm(true);
  };

  const saveDD = async () => {
    if (!ddForm || !ddForm.supplier_id) return;
    await getStore().dueDiligence.create(ddForm);
    setShowDDForm(false);
    refresh();
  };

  const removeDD = async (id: string) => {
    if (!confirm('Delete this DD item?')) return;
    await getStore().dueDiligence.remove(id);
    refresh();
  };

  const openFlagCreate = () => {
    setFlagForm(emptyFlagForm(suppliers?.[0]?.id ?? ''));
    setShowFlagForm(true);
  };

  const saveFlag = async () => {
    if (!flagForm || !flagForm.supplier_id || !flagForm.description) return;
    await getStore().redFlags.create(flagForm);
    setShowFlagForm(false);
    refresh();
  };

  const removeFlag = async (id: string) => {
    if (!confirm('Delete this red flag?')) return;
    await getStore().redFlags.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const hasSuppliers = suppliers && suppliers.length > 0;
  const hasDD = ddItems && ddItems.length > 0;

  if (!hasSuppliers && !hasDD) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="No due diligence records"
          message="Register a supplier first, then create due diligence items to track legal, operational, product, export, commercial risk, and compliance verification."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Due Diligence"
        subtitle="Verification and risk assessment"
        action={
          hasSuppliers && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openFlagCreate}><AlertTriangle size={16} /> Red Flag</Button>
              <Button onClick={openDDCreate}><Plus size={16} /> Add DD Item</Button>
            </div>
          )
        }
      />

      {/* DD Items */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Due Diligence Items</h2>
        {!hasDD ? (
          <Card>
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="No DD items yet"
              message="Create due diligence items to track verification across legal existence, operation/capacity, product/quality, export history, commercial risk, and compliance."
              action={hasSuppliers ? <Button onClick={openDDCreate}><Plus size={16} /> Add DD Item</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ddItems!.map((d) => (
              <Card key={d.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{DD_CATEGORY_LABELS[d.category]}</h3>
                      <p className="text-xs text-gray-500">{supplierMap.get(d.supplier_id) ?? '—'}</p>
                    </div>
                    <Badge color={ddStatusColor(d.status)}>{ddStatusLabel(d.status)}</Badge>
                  </div>
                  {d.findings && <p className="text-xs text-gray-600 mb-2">{d.findings}</p>}
                  <div className="space-y-0.5 text-xs text-gray-500">
                    {d.reviewer && <div>Reviewer: {d.reviewer}</div>}
                    {d.review_date && <div>Reviewed: {formatDate(d.review_date)}</div>}
                    {d.evidence_ref && <div>Evidence: {d.evidence_ref}</div>}
                  </div>
                  <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                    <Button size="sm" variant="ghost" onClick={() => removeDD(d.id)}><Trash2 size={14} /></Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Red Flags */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Red Flags</h2>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">No red flags recorded. Record risks such as unrealistic prices, perfect specs without evidence, excessive intermediaries, pressure for advance payment, or inconsistent documentation.</p>
          </CardBody>
        </Card>
      </div>

      {/* DD Modal */}
      <Modal
        open={showDDForm}
        onClose={() => setShowDDForm(false)}
        title="Add Due Diligence Item"
        footer={<><Button variant="secondary" onClick={() => setShowDDForm(false)}>Cancel</Button><Button onClick={saveDD}>Create</Button></>}
      >
        {ddForm && (
          <div className="space-y-3">
            <Select label="Supplier" value={ddForm.supplier_id} onChange={(v) => setDDForm({ ...ddForm, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Unnamed' }))} required />
            <Select label="DD Category" value={ddForm.category} onChange={(v) => setDDForm({ ...ddForm, category: v as DDCategory })} options={DD_CATEGORY_OPTIONS} />
            <Select label="Status" value={ddForm.status} onChange={(v) => setDDForm({ ...ddForm, status: v as DDStatus })} options={DD_STATUS_OPTIONS} />
            <TextArea label="Findings" value={ddForm.findings} onChange={(v) => setDDForm({ ...ddForm, findings: v })} />
            <Input label="Evidence Reference" value={ddForm.evidence_ref} onChange={(v) => setDDForm({ ...ddForm, evidence_ref: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Reviewer" value={ddForm.reviewer} onChange={(v) => setDDForm({ ...ddForm, reviewer: v })} />
              <Input label="Review Date" type="date" value={ddForm.review_date} onChange={(v) => setDDForm({ ...ddForm, review_date: v })} />
            </div>
          </div>
        )}
      </Modal>

      {/* Red Flag Modal */}
      <Modal
        open={showFlagForm}
        onClose={() => setShowFlagForm(false)}
        title="Record Red Flag"
        footer={<><Button variant="secondary" onClick={() => setShowFlagForm(false)}>Cancel</Button><Button onClick={saveFlag} disabled={!flagForm?.description}>Create</Button></>}
      >
        {flagForm && (
          <div className="space-y-3">
            <Select label="Supplier" value={flagForm.supplier_id} onChange={(v) => setFlagForm({ ...flagForm, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Unnamed' }))} required />
            <Input label="Flag Type" value={flagForm.flag_type} onChange={(v) => setFlagForm({ ...flagForm, flag_type: v })} placeholder="e.g. Unrealistic price" />
            <TextArea label="Description" required value={flagForm.description} onChange={(v) => setFlagForm({ ...flagForm, description: v })} />
            <TextArea label="Evidence" value={flagForm.evidence} onChange={(v) => setFlagForm({ ...flagForm, evidence: v })} />
            <Input label="Source" value={flagForm.source} onChange={(v) => setFlagForm({ ...flagForm, source: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Reviewer" value={flagForm.reviewer} onChange={(v) => setFlagForm({ ...flagForm, reviewer: v })} />
              <Input label="Flag Date" type="date" value={flagForm.flag_date} onChange={(v) => setFlagForm({ ...flagForm, flag_date: v })} />
            </div>
            <p className="text-xs text-gray-400">The system records evidence and source. It does not automatically classify a supplier as fraudulent.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
