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
  Building2, Plus, ArrowLeft, MapPin, FileText, Trash2, Edit3, FlaskConical, Clock, AlertTriangle,
} from 'lucide-react';
import type { Supplier, SupplierLifecycle, Contact } from '@/types';
import { LIFECYCLE_LABELS, VERIFICATION_LABELS } from '@/types';
import { getProductFamily, PRODUCT_FAMILY_LABELS, displayProductName } from '@/utils/productFamilies';

const LIFECYCLE_OPTIONS = Object.entries(LIFECYCLE_LABELS).map(([value, label]) => ({ value, label }));

const VERIFIED_PRIORITY = ['Renovar Oleos', 'FL Óleos', 'Olam Agro'];

const BRAZIL_INTERIOR_TERMS = [
  'paraná', 'parana', 'santa catarina', 'rio grande do sul', 'goiás', 'goias',
  'minas gerais', 'bahia', 'pará', 'para', 'pernambuco', 'ceará', 'ceara',
  'mato grosso', 'mato grosso do sul', 'espírito santo', 'espirito santo',
  'maranhão', 'maranhao', 'piauí', 'piaui', 'amazonas', 'rondônia', 'rondonia',
  'acre', 'amapá', 'amapa', 'roraima', 'tocantins', 'alagoas', 'sergipe',
  'paraíba', 'paraiba', 'rio grande do norte'
];

function priorityIndex(supplier: Supplier): number {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const names = [supplier.trading_name || '', supplier.legal_name || ''].map(normalize);
  return VERIFIED_PRIORITY.findIndex((priority) => {
    const normalizedPriority = normalize(priority);
    return names.some((name) => name.includes(normalizedPriority));
  });
}

function supplierGroup(supplier: Supplier): 'principais' | 'sao_paulo' | 'interior' | 'brasil' | 'argentina' | 'chile' | 'colombia' | 'espana' | 'sin_ubicacion' {
  if (priorityIndex(supplier) !== -1) return 'principais';

  const country = (supplier.country || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const location = (supplier.city || '') + ' ' + (supplier.country || '');
  const normalizedLocation = location.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (country === 'chile') return 'chile';
  if (country === 'argentina') return 'argentina';
  if (country === 'colombia') return 'colombia';
  if (country === 'espana' || country === 'spain') return 'espana';
  if (country === 'brasil' || country === 'brazil') {
    if (normalizedLocation.includes('sao paulo') || /,\\s*sp\\b/.test(normalizedLocation) || /\\bsp\\b/.test(normalizedLocation)) return 'sao_paulo';
    if (BRAZIL_INTERIOR_TERMS.some((term) => normalizedLocation.includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))) return 'interior';
    return 'brasil';
  }

  return 'sin_ubicacion';
}

const SUPPLIER_GROUP_LABELS = {
  principais: 'Principales',
  sao_paulo: 'Brasil — São Paulo',
  interior: 'Brasil — Interior',
  brasil: 'Brasil — ubicación por confirmar',
  argentina: 'Argentina',
  chile: 'Chile',
  colombia: 'Colombia',
  espana: 'España',
  sin_ubicacion: 'Ubicación no especificada',
} as const;

const SUPPLIER_GROUP_ORDER = ['principais', 'sao_paulo', 'interior', 'brasil', 'argentina', 'colombia', 'chile', 'espana', 'sin_ubicacion'] as const;

const supplierSort = (a: Supplier, b: Supplier) => {
  const groupA = SUPPLIER_GROUP_ORDER.indexOf(supplierGroup(a));
  const groupB = SUPPLIER_GROUP_ORDER.indexOf(supplierGroup(b));
  const priorityA = priorityIndex(a);
  const priorityB = priorityIndex(b);
  if (groupA !== groupB) return groupA - groupB;
  if (groupA === 0 && priorityA !== priorityB) return priorityA - priorityB;
  return (a.trading_name || a.legal_name).localeCompare(b.trading_name || b.legal_name);
};

function geographyStyle(supplier: Supplier) {
  const group = supplierGroup(supplier);
  const styles = {
    principales: { border: 'border-l-[var(--astra-red)]', badge: 'bg-red-50 text-red-800 border-red-200' },
    sao_paulo: { border: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    interior: { border: 'border-l-yellow-500', badge: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    brasil: { border: 'border-l-slate-300', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
    argentina: { border: 'border-l-emerald-500', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    colombia: { border: 'border-l-yellow-500', badge: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
    chile: { border: 'border-l-blue-500', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
    espana: { border: 'border-l-orange-500', badge: 'bg-orange-50 text-orange-800 border-orange-200' },
    sin_ubicacion: { border: 'border-l-slate-300', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
  } as const;
  return { ...styles[group], label: SUPPLIER_GROUP_LABELS[group] };
};

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
    if (!confirm('¿Eliminar este proveedor y toda su inteligencia relacionada? Esta acción no se puede deshacer.')) return;
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
      <>
        <SupplierDetail
          supplier={selected}
          onBack={() => selectSupplier(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => remove(selected.id)}
        />
        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editing ? 'Editar proveedor' : 'Registrar nuevo proveedor'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.legal_name}>
                {editing ? 'Guardar cambios' : 'Crear proveedor'}
              </Button>
            </>
          }
        >
          {formError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>}
          <SupplierForm form={form} setForm={setForm} />
        </Modal>
      </>
    );
  }

  // List view
  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Perfiles de inteligencia de proveedores"
        action={<Button onClick={openCreate}><Plus size={16} /> Agregar proveedor</Button>}
      />

      {!suppliers || suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={28} />}
            title="No hay proveedores registrados"
            message="Registra tu primer proveedor para construir inteligencia de procurement: identidad, operación, productos, ofertas, certificaciones y DD."
            action={<Button onClick={openCreate}><Plus size={16} /> Agregar proveedor</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {SUPPLIER_GROUP_ORDER.map((group) => {
            const groupedSuppliers = [...(suppliers ?? [])]
              .filter((supplier) => supplierGroup(supplier) === group)
              .sort(supplierSort);
            if (!groupedSuppliers.length) return null;

            return (
              <section key={group}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-gray-900">{SUPPLIER_GROUP_LABELS[group]}</h2>
                  <span className="text-xs text-gray-400">{groupedSuppliers.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedSuppliers.map((s) => {
                    const geo = geographyStyle(s);
                    const isPriority = priorityIndex(s) !== -1;
                    return (
                      <Card key={s.id} className={`border-l-4 ${geo.border} hover:shadow-md transition-shadow cursor-pointer`}>
                        <CardBody>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0" onClick={() => selectSupplier(s.id)}>
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{s.legal_name || 'Proveedor sin nombre'}</h3>
                              {s.trading_name && <p className="text-xs text-gray-500 truncate">{s.trading_name}</p>}
                            </div>
                            <Badge color={lifecycleColor(s.lifecycle)}>{lifecycleLabel(s.lifecycle)}</Badge>
                          </div>
                          <div className="space-y-1 text-xs text-gray-500" onClick={() => selectSupplier(s.id)}>
                            {s.country && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <MapPin size={12} /> {s.city ? `${s.city}, ` : ''}{s.country}
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${geo.badge}`}>{geo.label}</span>
                                {isPriority && <Badge color="red">Principal</Badge>}
                              </div>
                            )}
                            {s.tax_id && <div>CNPJ / RUT: {s.tax_id}</div>}
                            {s.facility && <div>Instalación: {s.facility}</div>}
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                            <Button size="sm" variant="ghost" onClick={() => selectSupplier(s.id)}><FileText size={14} /> Ver perfil</Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit3 size={14} /> Editar</Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 size={14} /></Button>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar proveedor' : 'Registrar nuevo proveedor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.legal_name}>
              {editing ? 'Guardar cambios' : 'Crear proveedor'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>}
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
  const [downloadUrl, setDownloadUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!doc.file_url) return;
      if (doc.file_url.startsWith('http')) {
        if (active) { setUrl(doc.file_url); setDownloadUrl(doc.file_url); }
        return;
      }
      const client = getSupabaseClient();
      if (!client) { if (active) setError('Supabase no disponible'); return; }
      const [preview, download] = await Promise.all([
        client.storage.from('documents').createSignedUrl(doc.file_url, 3600),
        client.storage.from('documents').createSignedUrl(doc.file_url, 3600, { download: true }),
      ]);
      if (!active) return;
      if (preview.error) setError(preview.error.message);
      else {
        setUrl(preview.data.signedUrl);
        setDownloadUrl(download.error ? preview.data.signedUrl : download.data.signedUrl);
      }
    };
    void load();
    return () => { active = false; };
  }, [doc.file_url]);

  if (error) return <div className="p-3 text-xs text-red-600">{error}</div>;
  if (!url) return <div className="p-3 text-xs text-gray-500">Cargando vista previa…</div>;

  const fileName = doc.file_name || doc.title || 'documento';
  const lower = fileName.toLowerCase();
  const isImage = /\.(png|jpg|jpeg|webp|gif)$/.test(lower);
  const isPdf = /\.pdf$/.test(lower);
  const isVideo = /\.(mp4|webm|mov)$/.test(lower);

  return (
    <div className="border-t border-gray-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Vista previa</span>
        <div className="flex items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700">Abrir</a>
          <a href={downloadUrl} className="rounded-md bg-[var(--astra-blue)] px-2.5 py-1.5 text-xs font-medium text-white">Descargar</a>
        </div>
      </div>
      {isImage ? <img src={url} alt={doc.title} className="max-h-[520px] w-full rounded-md bg-white object-contain" /> :
       isPdf ? <iframe src={`${url}#toolbar=1&navpanes=0&view=FitH`} title={doc.title || fileName} loading="eager" className="h-[520px] w-full rounded-md border border-gray-200 bg-white" /> :
       isVideo ? <video src={url} controls className="max-h-[520px] w-full rounded-md" /> :
       <div className="rounded-md border border-dashed border-gray-200 bg-white p-5 text-center text-xs text-gray-500">Vista previa no disponible para este formato. Usa “Abrir” o “Descargar”.</div>}
    </div>
  );
}

function SupplierDetail({
  supplier, onBack, onEdit, onDelete,
}: { supplier: Supplier; onBack: () => void; onEdit: () => void; onDelete: () => void; }) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<Omit<Contact, 'id' | 'created_at'> | null>(null);
  const [contactError, setContactError] = useState('');

  const { data, loading, error, refresh } = useAsync(async () => {
    const store = getStore();
    const [contacts, products, documents, offers, certifications, dueDiligence, logistics, timeline, redFlags, intelligenceFacts] =
      await Promise.all([
        store.contacts.getBySupplier(supplier.id),
        store.products.getBySupplier(supplier.id),
        store.documents.getBySupplier(supplier.id),
        store.commercialOffers.getBySupplier(supplier.id),
        store.certifications.getBySupplier(supplier.id),
        store.dueDiligence.getBySupplier(supplier.id),
        store.logistics.getBySupplier(supplier.id),
        store.timeline.getBySupplier(supplier.id),
        store.redFlags.getBySupplier(supplier.id),
        store.intelligenceFacts.getByEntity('supplier', supplier.id),
      ]);

    const specs = (await Promise.all(products.map(async product => ({
      product,
      specs: await store.technicalSpecs.getByProduct(product.id),
    })))).filter(entry => entry.specs.length > 0);

    return { contacts, products, documents, offers, certifications, dueDiligence, logistics, timeline, redFlags, intelligenceFacts, specs };
  }, [supplier.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const relationshipFacts = data.intelligenceFacts.filter(f => /^(relationship|people)\./.test(f.field_name));
  const historicalFacts = data.intelligenceFacts.filter(f =>
    /^(historical_|current_opportunity\.)/.test(f.field_name)
  );

  const openContactEdit = (contact: Contact) => {
    const { id, created_at, ...rest } = contact;
    void id; void created_at;
    setContactForm(rest);
    setEditingContactId(contact.id);
    setContactError('');
    setShowContactForm(true);
  };

  const saveContact = async () => {
    if (!contactForm || !contactForm.name.trim()) return;
    setContactError('');
    try {
      if (!editingContactId) throw new Error('Contacto no seleccionado.');
      await getStore().contacts.update(editingContactId, contactForm);
      setShowContactForm(false);
      setEditingContactId(null);
      setContactForm(null);
      refresh();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'No fue posible guardar el contacto.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Volver</Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-gray-900">{supplier.legal_name}</h1><Badge color={lifecycleColor(supplier.lifecycle)}>{lifecycleLabel(supplier.lifecycle)}</Badge></div>
            {supplier.trading_name && <p className="text-sm text-gray-500">{supplier.trading_name}</p>}
            <p className="mt-1 text-xs text-gray-400">Perfil de inteligencia de procurement</p>
          </div>
        </div>
        <div className="flex items-center gap-2"><Button variant="secondary" onClick={onEdit}><Edit3 size={16} /> Editar</Button><Button variant="danger" onClick={onDelete}><Trash2 size={16} /></Button></div>
      </div>

      <DetailSection title="1. Identidad Legal y Corporativa">
        <DetailRow label="Razón social" value={supplier.legal_name} />
        <DetailRow label="Nombre comercial" value={supplier.trading_name} />
        <DetailRow label="País" value={supplier.country} />
        <DetailRow label="Ciudad" value={supplier.city} />
        <DetailRow label="Dirección registrada" value={supplier.address} />
        <DetailRow label="Registro mercantil / referencia" value={supplier.cnae} />
        <DetailRow label="Administrador / representante" value={supplier.administrator} />
        <DetailRow label="Situación legal" value={supplier.legal_status} />
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
          CIS registrado en Evidencia y Documentos. PREKAMA USA LLC aparece en documentación histórica como entidad distinta; su relación corporativa con PREKAMA Verwaltungs GmbH no se presume sin KYC.
        </div>
      </DetailSection>

      <DetailSection title="2. Operación y Capacidad">
        <DetailRow label="Estado operativo" value={supplier.operation_status} />
        <DetailRow label="Instalación propia" value={supplier.facility} />
        <DetailRow label="Capacidad teórica propia" value={supplier.theoretical_capacity} />
        <DetailRow label="Producción real" value={supplier.real_production} />
        <DetailRow label="Disponibilidad a nivel proveedor" value={supplier.available_volume} />
        <DetailRow label="Volumen para Astra" value={supplier.volume_to_astra} />
        <DetailRow label="Trial" value={supplier.trial_volume} />
        <DetailRow label="Recurrencia" value={supplier.recurring_volume} />
        <DetailRow label="Infraestructura" value={supplier.infrastructure} />
      </DetailSection>

      <DetailSection title="3. Relación y Contactos">
        {!data.contacts.length && !relationshipFacts.length ? <EmptyLine text="Sin contactos registrados." /> : (
          <>
            {data.contacts.map(c => (
              <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-sm font-semibold text-gray-900">{c.name || 'Contacto sin nombre'}</div><div className="text-xs text-gray-500">{c.title || 'Cargo no especificado'}</div></div>
                  {c.is_primary && <Badge color="blue">Principal</Badge>}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2">
                  <span>Correo: {c.email || '—'}</span><span>Teléfono: {c.phone || '—'}</span><span>WhatsApp: {c.whatsapp || '—'}</span>
                </div>
                {c.notes && <p className="mt-2 text-xs text-gray-500">{c.notes}</p>}
                <div className="mt-2 flex justify-end"><Button size="sm" variant="ghost" onClick={() => openContactEdit(c)}><Edit3 size={13} /> Editar contacto</Button></div>
              </div>
            ))}
            {relationshipFacts.length > 0 && (
              <div className="rounded-lg border border-gray-100 p-3">
                {relationshipFacts.map(f => (
                  <div key={f.id} className="flex justify-between gap-3 border-b border-gray-50 py-1.5 last:border-0">
                    <span className="text-xs text-gray-500">{f.field_name.replace(/^(relationship|people)\./, '')}</span>
                    <span className="text-xs font-medium text-gray-800 text-right">{f.value_text}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DetailSection>

      <DetailSection title="4. Productos y Posiciones">
        {!data.products.length ? <EmptyLine text="Sin productos registrados." /> : data.products.map(p => (
          <div key={p.id} className="rounded-lg border border-gray-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-sm font-semibold text-gray-900">{displayProductName(p.name)}</div><div className="text-xs text-gray-500">{p.composition || 'Composición no registrada'}</div></div>
              <Badge color={verificationColor(p.verification_status)}>{verificationLabel(p.verification_status)}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <span>Familia: {PRODUCT_FAMILY_LABELS[getProductFamily(p)]}</span>
              <span>Origen: {p.origin || '—'}</span>
              <span>Volumen documentado: {p.available_volume || '—'} {p.available_volume ? p.unit : ''}</span>
              <span>Verificación: {verificationLabel(p.verification_status)}</span>
            </div>
          </div>
        ))}
      </DetailSection>

      <DetailSection title="5. Comercial — Historial de Ofertas">
        {!data.offers.length ? <EmptyLine text="Sin ofertas comerciales registradas." /> : data.offers.map(o => (
          <div key={o.id} className="rounded-lg border border-gray-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-900">{data.products.find(p => p.id === o.product_id)?.name || 'Producto no especificado'}</div>
              <Badge color={verificationColor(o.verification_status)}>{verificationLabel(o.verification_status)}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 md:grid-cols-4">
              <DetailRow label="Precio" value={o.price ? `${o.price} ${o.currency || ''} / ${o.price_unit || 'unidad'}` : 'Pendiente'} />
              <DetailRow label="Base" value={o.price_basis || '—'} />
              <DetailRow label="Incoterm" value={o.incoterm || '—'} />
              <DetailRow label="Destino" value={o.destination || '—'} />
              <DetailRow label="Carga / puerto" value={[o.loading_point, o.port].filter(Boolean).join(' / ') || '—'} />
              <DetailRow label="Pago" value={o.payment_terms || '—'} />
              <DetailRow label="Volumen" value={o.offered_volume || '—'} />
              <DetailRow label="Trial / recurrente" value={[o.trial_quantity, o.recurring_quantity].filter(Boolean).join(' / ') || '—'} />
            </div>
          </div>
        ))}
      </DetailSection>

      <DetailSection title="6. Técnico / Calidad">
        {!data.specs.length ? <EmptyLine text="Sin ficha técnica ampliada registrada." /> : data.specs.map(({ product, specs }) => (
          <div key={product.id} className="mb-3 rounded-lg border border-gray-100 p-3 last:mb-0">
            <div className="mb-2 flex items-center gap-2"><FlaskConical size={15} className="text-gray-400" /><span className="text-sm font-semibold text-gray-900">{displayProductName(product.name)}</span></div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-gray-100 text-left text-gray-500"><th className="py-2 pr-3">Parámetro</th><th className="py-2 pr-3">Valor</th><th className="py-2 pr-3">Unidad</th><th className="py-2 pr-3">Método</th><th className="py-2">Evidencia</th></tr></thead><tbody>{specs.map(s => <tr key={s.id} className="border-b border-gray-50"><td className="py-2 pr-3 font-medium text-gray-800">{s.parameter}</td><td className="py-2 pr-3">{s.value || '—'}</td><td className="py-2 pr-3">{s.unit || '—'}</td><td className="py-2 pr-3">{s.method || '—'}</td><td className="py-2"><Badge color={verificationColor(s.verification_status)}>{verificationLabel(s.verification_status)}</Badge></td></tr>)}</tbody></table></div>
          </div>
        ))}
      </DetailSection>

      <DetailSection title="8. Evidencia y Documentos">
        {!data.documents.length ? <EmptyLine text="Sin evidencia documental registrada." /> : data.documents.map(doc => (
          <div key={doc.id} className="rounded-lg border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-3">
              <div><div className="text-sm font-semibold text-gray-900">{doc.title || doc.file_name || 'Documento'}</div><div className="text-xs text-gray-500">{doc.file_name || 'Sin archivo adjunto'} · {doc.doc_type}</div></div>
              <Badge color={verificationColor(doc.verification_status)}>{verificationLabel(doc.verification_status)}</Badge>
            </div>
            {doc.file_url ? <DocumentPreview doc={doc} /> : <div className="border-t border-gray-100 p-3 text-xs text-gray-500">{doc.description || 'Metadatos registrados; archivo no vinculado.'}</div>}
          </div>
        ))}
      </DetailSection>

      <DetailSection title="9. Riesgos / Alertas">
        {!data.redFlags.length ? <EmptyLine text="Sin alertas registradas." /> : data.redFlags.map(r => (
          <div key={r.id} className="rounded-lg border border-red-100 bg-red-50 p-3">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-red-900">{r.flag_type || 'Alerta'}</span><Badge color={r.status === 'resolved' ? 'green' : 'red'}>{r.status}</Badge></div>
            <p className="mt-2 text-xs text-red-800">{r.description}</p>
            <div className="mt-1 text-[11px] text-red-600">Evidencia: {r.evidence || '—'} · Fuente: {r.source || '—'}</div>
          </div>
        ))}
      </DetailSection>

      <DetailSection title="11. Logística / Preparación para Exportación">
        {!data.logistics.length ? <EmptyLine text="Sin registro logístico." /> : data.logistics.map(l => (
          <div key={l.id} className="rounded-lg border border-gray-100 p-3">
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-900">{l.port || l.loading_location || l.origin_location || 'Registro logístico'}</span><Badge color={verificationColor(l.export_readiness)}>{verificationLabel(l.export_readiness)}</Badge></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600"><span>Origen: {l.origin_location || '—'}</span><span>Carga: {l.loading_location || '—'}</span><span>Transporte: {l.transport_mode || '—'}</span><span>Contenedor: {l.container_type || '—'}</span><span>Embarque: {l.estimated_shipment_size || '—'}</span><span>Lead time: {l.lead_time || '—'}</span></div>
            {l.notes && <p className="mt-2 text-xs text-gray-500">{l.notes}</p>}
          </div>
        ))}
      </DetailSection>



      <Modal
        open={showContactForm}
        onClose={() => setShowContactForm(false)}
        title="Editar contacto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowContactForm(false)}>Cancelar</Button>
            <Button onClick={saveContact} disabled={!contactForm?.name.trim()}>Guardar cambios</Button>
          </>
        }
      >
        {contactError && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{contactError}</div>}
        {contactForm && (
          <div className="space-y-3">
            <Input label="Nombre" value={contactForm.name} onChange={(v) => setContactForm({ ...contactForm, name: v })} />
            <Input label="Cargo / función" value={contactForm.title} onChange={(v) => setContactForm({ ...contactForm, title: v })} />
            <div className="grid grid-cols-2 gap-3"><Input label="Correo" value={contactForm.email} onChange={(v) => setContactForm({ ...contactForm, email: v })} /><Input label="Teléfono" value={contactForm.phone} onChange={(v) => setContactForm({ ...contactForm, phone: v })} /></div>
            <Input label="WhatsApp" value={contactForm.whatsapp} onChange={(v) => setContactForm({ ...contactForm, whatsapp: v })} />
            <TextArea label="Notas" value={contactForm.notes} onChange={(v) => setContactForm({ ...contactForm, notes: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} /> Contacto principal</label>
          </div>
        )}
      </Modal>
    </div>
  );
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
          <Input label="Razón social" required value={form.legal_name} onChange={(v) => update('legal_name', v)} />
          <Input label="Nombre comercial" value={form.trading_name} onChange={(v) => update('trading_name', v)} />
          <Input label="País" value={form.country} onChange={(v) => update('country', v)} />
          <Input label="Ciudad" value={form.city} onChange={(v) => update('city', v)} />
          <Input label="Tax ID (CNPJ/RUT)" value={form.tax_id} onChange={(v) => update('tax_id', v)} />
          <Input label="CNAE / Activity" value={form.cnae} onChange={(v) => update('cnae', v)} />
          <Input label="Administrator" value={form.administrator} onChange={(v) => update('administrator', v)} />
          <Input label="Situación legal" value={form.legal_status} onChange={(v) => update('legal_status', v)} />
        </div>
        <div className="mt-3">
          <TextArea label="Dirección" value={form.address} onChange={(v) => update('address', v)} />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Operación</h4>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Planta / instalación" value={form.facility} onChange={(v) => update('facility', v)} />
          <Input label="Estado operativo" value={form.operation_status} onChange={(v) => update('operation_status', v)} />
          <Input label="Capacidad teórica" value={form.theoretical_capacity} onChange={(v) => update('theoretical_capacity', v)} />
          <Input label="Producción real" value={form.real_production} onChange={(v) => update('real_production', v)} />
          <Input label="Volumen disponible" value={form.available_volume} onChange={(v) => update('available_volume', v)} />
          <Input label="Volumen para Astra" value={form.volume_to_astra} onChange={(v) => update('volume_to_astra', v)} />
          <Input label="Volumen de prueba" value={form.trial_volume} onChange={(v) => update('trial_volume', v)} />
          <Input label="Volumen recurrente" value={form.recurring_volume} onChange={(v) => update('recurring_volume', v)} />
        </div>
        <div className="mt-3">
          <TextArea label="Infraestructura" value={form.infrastructure} onChange={(v) => update('infrastructure', v)} />
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
