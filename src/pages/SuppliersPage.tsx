import { useEffect, useState, type ReactNode } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { getSupabaseClient } from '@/data/supabase-client';
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
  Building2, Plus, ArrowLeft, MapPin, FileText, Trash2, Edit3, Users, FlaskConical, DollarSign, Award, ShieldCheck, Clock, AlertTriangle, Globe2,
} from 'lucide-react';
import type { Supplier, SupplierLifecycle } from '@/types';
import { LIFECYCLE_LABELS, VERIFICATION_LABELS } from '@/types';
import { getProductFamily, PRODUCT_FAMILY_LABELS } from '@/utils/productFamilies';

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
  const { selectedSupplierId, selectSupplier, procurementDomain } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySupplierForm());
  const [formError, setFormError] = useState('');

  const { data: suppliers, loading, error, refresh } = useAsync(
    () => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(),
    [procurementDomain]
  );

  const { data: selected } = useAsync(
    () => selectedSupplierId ? getStore().suppliers.getById(selectedSupplierId) : Promise.resolve(null),
    [selectedSupplierId]
  );

  // ---- Form helpers ----
  const openCreate = () => {
    setForm(emptySupplierForm());
    setFormError('');
    setEditing(false);
    setEditingSupplierId(null);
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    const { id, created_at, updated_at, ...rest } = s;
    void id; void created_at; void updated_at;
    setForm(rest);
    setFormError('');
    setEditing(true);
    setEditingSupplierId(s.id);
    setShowForm(true);
  };

  const save = async () => {
    setFormError('');
    try {
      if (editing && editingSupplierId) {
        await getStore().suppliers.update(editingSupplierId, form);
      } else {
        if (!procurementDomain) throw new Error('Selecciona un dominio antes de crear un proveedor.');
        await getStore().suppliers.createForDomain(procurementDomain, form);
      }
      setShowForm(false);
      setEditingSupplierId(null);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No fue posible guardar los cambios.');
    }
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

function DocumentPreview({ doc }: { doc: import('@/types').DocumentRecord }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!doc.file_url) return;
      if (doc.file_url.startsWith('http')) { if (active) setUrl(doc.file_url); return; }
      const client = getSupabaseClient();
      if (!client) { if (active) setError('Supabase unavailable'); return; }
      const result = await client.storage.from('documents').createSignedUrl(doc.file_url, 3600);
      if (!active) return;
      if (result.error) setError(result.error.message); else setUrl(result.data.signedUrl);
    };
    void load();
    return () => { active = false; };
  }, [doc.file_url]);
  if (error) return <div className="p-3 text-xs text-red-600">{error}</div>;
  if (!url) return <div className="p-3 text-xs text-gray-500">Loading preview…</div>;
  const lower = url.toLowerCase();
  return <div className="border-t border-gray-200 bg-slate-50 p-3">
    {lower.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/) ? <img src={url} alt={doc.title} className="max-h-[520px] w-full object-contain" /> :
     lower.match(/\.pdf(\?|$)/) ? <iframe title={doc.title} src={url} className="h-[520px] w-full bg-white" /> :
     lower.match(/\.(mp4|webm|mov)(\?|$)/) ? <video src={url} controls className="max-h-[520px] w-full" /> :
     <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[var(--astra-blue)]">Open document</a>}
  </div>;
}

function SupplierDetail({
  supplier, onBack, onEdit, onDelete,
}: { supplier: Supplier; onBack: () => void; onEdit: () => void; onDelete: () => void; }) {
  const { data, loading, error } = useAsync(async () => {
    const store = getStore();
    const [contacts, products, documents, offers, certifications, dueDiligence, logistics, timeline, followUps, redFlags, intelligenceFacts] =
      await Promise.all([
        store.contacts.getBySupplier(supplier.id), store.products.getBySupplier(supplier.id),
        store.documents.getBySupplier(supplier.id), store.commercialOffers.getBySupplier(supplier.id),
        store.certifications.getBySupplier(supplier.id), store.dueDiligence.getBySupplier(supplier.id),
        store.logistics.getBySupplier(supplier.id), store.timeline.getBySupplier(supplier.id),
        store.followUps.getBySupplier(supplier.id), store.redFlags.getBySupplier(supplier.id), store.intelligenceFacts.getByEntity('supplier', supplier.id),
      ]);
    const specs = (await Promise.all(products.map(async product => ({
      product, specs: await store.technicalSpecs.getByProduct(product.id),
    })))).filter(entry => entry.specs.length > 0);
    return { contacts, products, documents, offers, certifications, dueDiligence, logistics, timeline, followUps, redFlags, intelligenceFacts, specs };
  }, [supplier.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Volver</Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-gray-900">{supplier.legal_name}</h1><Badge color={lifecycleColor(supplier.lifecycle)}>{lifecycleLabel(supplier.lifecycle)}</Badge></div>
            {supplier.trading_name && <p className="text-sm text-gray-500">{supplier.trading_name}</p>}
            <p className="mt-1 text-xs text-gray-400">Ficha ampliada de inteligencia de procurement</p>
          </div>
        </div>
        <div className="flex items-center gap-2"><Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Editar</Button><Button variant="danger" onClick={onDelete}><Trash2 size={16} /></Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <SummaryChip icon={<Users size={15} />} label="Contactos" value={data.contacts.length} />
        <SummaryChip icon={<FileText size={15} />} label="Productos" value={data.products.length} />
        <SummaryChip icon={<FlaskConical size={15} />} label="Especificaciones" value={data.specs.reduce((n, x) => n + x.specs.length, 0)} />
        <SummaryChip icon={<DollarSign size={15} />} label="Ofertas" value={data.offers.length} />
        <SummaryChip icon={<Award size={15} />} label="Certificaciones" value={data.certifications.length} />
        <SummaryChip icon={<ShieldCheck size={15} />} label="DD" value={data.dueDiligence.length} />
        <SummaryChip icon={<FileText size={15} />} label="Evidencia" value={data.documents.length} />
        <SummaryChip icon={<AlertTriangle size={15} />} label="Alertas" value={data.redFlags.length} danger={data.redFlags.length > 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DetailSection title="1. Identidad Legal y Corporativa">
          <DetailRow label="Legal Name" value={supplier.legal_name} /><DetailRow label="Trading Name" value={supplier.trading_name} />
          <DetailRow label="Country" value={supplier.country} /><DetailRow label="City" value={supplier.city} /><DetailRow label="Address" value={supplier.address} />
          <DetailRow label="CNPJ / RUT" value={supplier.tax_id} /><DetailRow label="CNAE / Declared Activity" value={supplier.cnae} />
          <DetailRow label="Administrator / Legal Representative" value={supplier.administrator} /><DetailRow label="Legal Status" value={supplier.legal_status} />
        </DetailSection>
        <DetailSection title="2. Operación y Capacidad">
          <DetailRow label="Facility" value={supplier.facility} /><DetailRow label="Operation Status" value={supplier.operation_status} />
          <DetailRow label="Theoretical Capacity" value={supplier.theoretical_capacity} /><DetailRow label="Real Production" value={supplier.real_production} />
          <DetailRow label="Available Volume" value={supplier.available_volume} /><DetailRow label="Volume for Astra" value={supplier.volume_to_astra} />
          <DetailRow label="Trial Volume" value={supplier.trial_volume} /><DetailRow label="Recurring Volume" value={supplier.recurring_volume} /><DetailRow label="Infrastructure" value={supplier.infrastructure} />
        </DetailSection>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DetailSection title="3. Contactos">
          {!data.contacts.length ? <EmptyLine text="No contact record." /> : data.contacts.map(c => (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-gray-900">{c.name || 'Unnamed contact'}</div><div className="text-xs text-gray-500">{c.title || 'Role not specified'}</div></div>{c.is_primary && <Badge color="blue">Primary</Badge>}</div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2"><span>Email: {c.email || '—'}</span><span>Phone: {c.phone || '—'}</span><span>WhatsApp: {c.whatsapp || '—'}</span></div>
              {c.notes && <p className="mt-2 text-xs text-gray-500">{c.notes}</p>}
            </div>
          ))}
        </DetailSection>
        <DetailSection title="4. Productos y Variantes del Proveedor">
          {!data.products.length ? <EmptyLine text="No products registered." /> : data.products.map(p => (
            <div key={p.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold text-gray-900">{p.name}</div><div className="text-xs text-gray-500">{p.composition || 'No composition recorded'}</div></div><Badge color={verificationColor(p.verification_status)}>{verificationLabel(p.verification_status)}</Badge></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600"><span>Family: {PRODUCT_FAMILY_LABELS[getProductFamily(p)]}</span><span>Origin: {p.origin || '—'}</span><span>Volume: {p.available_volume || '—'} {p.available_volume ? p.unit : ''}</span><span>Verification: {p.verification_status}</span></div>
            </div>
          ))}
        </DetailSection>
      </div>

      <DetailSection title="5. Técnico / Calidad — Ficha Técnica Ampliada">
        {!data.specs.length ? <EmptyLine text="No technical parameters recorded. Expected evidence: COA, TDS, SDS/FDS, laboratory analysis and product-specific quality limits." /> : data.specs.map(({ product, specs }) => (
          <div key={product.id} className="mb-3 rounded-lg border border-gray-100 p-3 last:mb-0">
            <div className="mb-2 flex items-center gap-2"><FlaskConical size={15} className="text-gray-400" /><span className="text-sm font-semibold text-gray-900">{product.name}</span></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-gray-100 text-left text-gray-500"><th className="py-2 pr-3">Parameter</th><th className="py-2 pr-3">Value</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Method</th><th className="py-2">Evidence</th></tr></thead><tbody>{specs.map(s => <tr key={s.id} className="border-b border-gray-50"><td className="py-2 pr-3 font-medium text-gray-800">{s.parameter}</td><td className="py-2 pr-3">{s.value || '—'}</td><td className="py-2 pr-3">{s.unit || '—'}</td><td className="py-2 pr-3">{s.method || '—'}</td><td className="py-2"><Badge color={verificationColor(s.verification_status)}>{verificationLabel(s.verification_status)}</Badge></td></tr>)}</tbody></table></div>
          </div>
        ))}
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DetailSection title="6. Ofertas Comerciales">
          {!data.offers.length ? <EmptyLine text="No commercial offer recorded." /> : data.offers.map(o => (
            <div key={o.id} className="rounded-lg border border-gray-100 p-3"><div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold text-gray-900">{o.price || 'Price pending'} {o.currency}</div><Badge color={verificationColor(o.verification_status)}>{verificationLabel(o.verification_status)}</Badge></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600"><span>Basis: {o.price_basis || '—'}</span><span>Incoterm: {o.incoterm || '—'}</span><span>Loading: {o.loading_point || '—'}</span><span>Port: {o.port || '—'}</span><span>Destination: {o.destination || '—'}</span><span>Payment: {o.payment_terms || '—'}</span><span>Offered: {o.offered_volume || '—'}</span><span>Trial: {o.trial_quantity || '—'}</span><span>Recurring: {o.recurring_quantity || '—'}</span><span>ISCC premium: {o.certification_premium || '—'}</span></div>
            </div>
          ))}
        </DetailSection>
        <DetailSection title="7. Certificaciones">
          {!data.certifications.length ? <EmptyLine text="No certification records. Claims such as ISCC remain unverified until documentary evidence is attached." /> : data.certifications.map(c => (
            <div key={c.id} className="rounded-lg border border-gray-100 p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">{c.cert_type}</span><Badge color={c.status === 'active' ? 'green' : c.status === 'revoked' ? 'red' : 'yellow'}>{c.status}</Badge></div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600"><span>Number: {c.cert_number || '—'}</span><span>Issuer: {c.issuing_body || '—'}</span><span>Issue: {c.issue_date || '—'}</span><span>Expiry: {c.expiration_date || '—'}</span></div>{c.notes && <p className="mt-2 text-xs text-gray-500">{c.notes}</p>}
            </div>
          ))}
        </DetailSection>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DetailSection title="8. Debida Diligencia">
          {!data.dueDiligence.length ? <EmptyLine text="No DD records yet. Required categories: legal, operational, product, export, commercial risk, compliance." /> : data.dueDiligence.map(d => (
            <div key={d.id} className="rounded-lg border border-gray-100 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-900">{d.category}</span><Badge color={d.status === 'rejected' ? 'red' : d.status === 'physically_verified' ? 'green' : d.status === 'independently_verified' ? 'blue' : d.status === 'documented' ? 'yellow' : 'gray'}>{d.status}</Badge></div><p className="mt-2 text-xs text-gray-600">{d.findings || 'No findings recorded.'}</p><div className="mt-1 text-[11px] text-gray-400">Evidence: {d.evidence_ref || '—'} · Reviewer: {d.reviewer || '—'} · Review: {d.review_date || '—'}</div></div>
          ))}
        </DetailSection>
        <DetailSection title="9. Logística / Preparación para Exportación">
          {!data.logistics.length ? <EmptyLine text="No logistics record. Target structure: origin, loading point, port, flexitank/ISO tank, shipment size, lead time and export readiness." /> : data.logistics.map(l => (
            <div key={l.id} className="rounded-lg border border-gray-100 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-900">{l.port || l.loading_location || l.origin_location || 'Logistics record'}</span><Badge color={verificationColor(l.export_readiness)}>{verificationLabel(l.export_readiness)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600"><span>Origin: {l.origin_location || '—'}</span><span>Loading: {l.loading_location || '—'}</span><span>Transport: {l.transport_mode}</span><span>Container: {l.container_type}</span><span>Shipment: {l.estimated_shipment_size || '—'}</span><span>Lead time: {l.lead_time || '—'}</span></div>{l.notes && <p className="mt-2 text-xs text-gray-500">{l.notes}</p>}</div>
          ))}
        </DetailSection>
      </div>

      <DetailSection title="10. Inteligencia Histórica de Procurement">
        {!data.intelligenceFacts.length ? <EmptyLine text="No historical intelligence facts recorded." /> : (
          <div className="space-y-2">
            {data.intelligenceFacts.map(f => (
              <div key={f.id} className={`rounded-lg border p-3 ${f.is_contradiction ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{f.field_name}</div><div className="mt-1 text-sm text-gray-900">{f.value_text}{f.unit ? ` ${f.unit}` : ''}</div></div>
                  <Badge color={verificationColor(f.verification_status)}>{verificationLabel(f.verification_status)}</Badge>
                </div>
                {f.is_contradiction && <div className="mt-2 text-xs font-semibold text-amber-800">Contradiction requires clarification before commercial reliance.</div>}
                {f.notes && <p className="mt-1 text-xs text-gray-500">{f.notes}</p>}
                {f.source_ref && <a href={f.source_ref} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[var(--astra-blue)]">Ver evidencia</a>}
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title="10. Evidencia y Documentos">
        {!data.documents.length ? <EmptyLine text="No documentary evidence attached." /> : data.documents.map(doc => (
          <div key={doc.id} className="rounded-lg border border-gray-100 overflow-hidden"><div className="flex items-center justify-between gap-3 p-3"><div><div className="text-sm font-semibold text-gray-900">{doc.title || doc.file_name || 'Document'}</div><div className="text-xs text-gray-500">{doc.file_name || 'No file name'} · {doc.doc_type}</div></div><Badge color={verificationColor(doc.verification_status)}>{verificationLabel(doc.verification_status)}</Badge></div>{doc.file_url ? <DocumentPreview doc={doc} /> : <div className="border-t border-gray-100 p-3 text-xs text-gray-500">{doc.description || 'Metadata registered; no storage file linked.'}</div>}</div>
        ))}
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DetailSection title="11. Riesgos / Alertas">
          {!data.redFlags.length ? <EmptyLine text="No red flags recorded." /> : data.redFlags.map(r => (
            <div key={r.id} className="rounded-lg border border-red-100 bg-red-50 p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-red-900">{r.flag_type || 'Red flag'}</span><Badge color={r.status === 'resolved' ? 'green' : 'red'}>{r.status}</Badge></div><p className="mt-2 text-xs text-red-800">{r.description}</p><div className="mt-1 text-[11px] text-red-600">Evidence: {r.evidence || '—'} · Source: {r.source || '—'}</div></div>
          ))}
        </DetailSection>
        <DetailSection title="12. Próximas Acciones / Seguimientos">
          {!data.followUps.length ? <EmptyLine text="No follow-ups recorded." /> : data.followUps.map(f => (
            <div key={f.id} className="rounded-lg border border-gray-100 p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-900">{f.title}</span><Badge color={f.status === 'completed' ? 'green' : f.priority === 'urgent' ? 'red' : 'yellow'}>{f.status}</Badge></div>{f.description && <p className="mt-2 text-xs text-gray-600">{f.description}</p>}<div className="mt-1 text-[11px] text-gray-400">Responsible: {f.responsible_person || '—'} · Due: {f.due_date || '—'} · Priority: {f.priority}</div></div>
          ))}
        </DetailSection>
      </div>

      <DetailSection title="13. Cronología / Historial de Interacciones">
        {!data.timeline.length ? <EmptyLine text="No timeline events recorded." /> : data.timeline.map(t => (
          <div key={t.id} className="flex gap-3 rounded-lg border border-gray-100 p-3"><Clock size={15} className="mt-0.5 shrink-0 text-gray-400" /><div><div className="text-sm font-semibold text-gray-900">{t.title || t.event_type}</div><div className="text-xs text-gray-500">{t.event_date || '—'} · {t.actor || '—'}</div>{t.description && <p className="mt-1 text-xs text-gray-600">{t.description}</p>}</div></div>
        ))}
      </DetailSection>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Globe2 size={15} /> Verification discipline</div>
        <p className="mt-1 text-xs leading-5 text-gray-600">Every claim must remain classified as CLAIMED, DOCUMENTED, INDEPENDENTLY VERIFIED or PHYSICALLY VERIFIED. Public registry data shown here is independent public evidence; product quality, current capacity, availability, export history and current certificates still require their own evidence.</p>
      </div>
    </div>
  );
}

function SummaryChip({ icon, label, value, danger = false }: { icon: ReactNode; label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-lg border p-3 ${danger ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}><div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div><div className={`mt-1 text-xl font-bold ${danger ? 'text-red-700' : 'text-gray-900'}`}>{value}</div></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">{text}</p>;
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
