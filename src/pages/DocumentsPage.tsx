import { useState } from 'react';
import { useNav } from '@/context/NavContext';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { getSupabaseClient } from '@/data/supabase-client';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Input, Select, TextArea, Badge, Modal, PageHeader } from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { formatDate } from '@/utils/date';
import { Plus, FileText, Trash2, Upload } from 'lucide-react';
import type { DocumentRecord, DocumentType, VerificationStatus } from '@/types';
import { DOCUMENT_TYPE_LABELS, VERIFICATION_LABELS } from '@/types';

const DOC_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const VERIFICATION_OPTIONS = Object.entries(VERIFICATION_LABELS).map(([value, label]) => ({ value, label }));

function emptyForm(supplierId: string): Omit<DocumentRecord, 'id' | 'created_at'> {
  return { supplier_id: supplierId, product_id: null, dd_item_id: null, doc_type: 'coa', title: '', description: '', file_name: '', file_url: '', uploaded_by: '', verification_status: 'claimed' };
}

export function DocumentsPage() {
  const { procurementDomain } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<Omit<DocumentRecord, 'id' | 'created_at'> | null>(null);
  const { data: docs, loading, error, refresh } = useAsync(() => getStore().documents.getAll(), []);
  const { data: suppliers } = useAsync(() => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(), [procurementDomain]);
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));
  const visibleDocs = procurementDomain ? (docs ?? []).filter((d) => supplierMap.has(d.supplier_id)) : (docs ?? []);
  const openCrear = () => { setForm(emptyForm('')); setFile(null); setShowForm(true); };
  const save = async () => {
    if (!form || !form.supplier_id || !form.title) return;
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase is not configured.');
    let storagePath = form.file_url || '';
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = form.supplier_id + '/' + Date.now() + '-' + safeName;
      const upload = await client.storage.from('documents').upload(storagePath, file, { contentTipo: file.type || 'application/octet-stream', upsert: false });
      if (upload.error) throw upload.error;
    }
    try {
      await getStore().documents.create({ ...form, file_name: file?.name || form.file_name, file_url: storagePath });
    } catch (err) {
      if (file && storagePath) await client.storage.from('documents').remove([storagePath]);
      throw err;
    }
    setShowForm(false); setFile(null); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este documento y su archivo almacenado?')) return;
    const doc = (docs ?? []).find((d) => d.id === id);
    const client = getSupabaseClient();
    await getStore().documents.remove(id);
    if (client && doc?.file_url && !doc.file_url.startsWith('http')) await client.storage.from('documents').remove([doc.file_url]);
    refresh();
  };
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  return (
    <div>
      <PageHeader title="Documentos" subtitle="Almacenamiento de evidencia vinculado a la inteligencia del proveedor" action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar documento</Button> : undefined} />
      {visibleDocs.length === 0 ? <Card><EmptyState icon={<FileText size={28} />} title="No hay documentos registrados" message={suppliers && suppliers.length > 0 ? 'Carga COA, SGS, TDS, SDS/FDS, ISCC, licencias, conocimientos de embarque e informes de inspección.' : 'Registra primero un proveedor y luego agrega sus documentos.'} action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar documento</Button> : undefined} /></Card> :
        <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Título</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proveedor</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Verificación</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cargado</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-gray-100">
          {visibleDocs.map((d) => <tr key={d.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{d.title}</td><td className="px-4 py-3 text-gray-600">{DOCUMENT_TYPE_LABELS[d.doc_type]}</td><td className="px-4 py-3 text-gray-600">{supplierMap.get(d.supplier_id) ?? '—'}</td><td className="px-4 py-3"><Badge color={verificationColor(d.verification_status)}>{verificationLabel(d.verification_status)}</Badge></td><td className="px-4 py-3 text-gray-600">{formatDate(d.created_at)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => remove(d.id)}><Trash2 size={14} /></Button></td></tr>)}
        </tbody></table></div></Card>
      }
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Agregar documento" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={save} disabled={!form?.title || !form?.supplier_id}><Upload size={15} /> Upload</Button></>}>
        {form && <div className="space-y-3"><Select label="Proveedor" value={form.supplier_id} onChange={(v) => setForm({ ...form, supplier_id: v })} options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required /><Input label="Título del documento" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Select label="Tipo de documento" value={form.doc_type} onChange={(v) => setForm({ ...form, doc_type: v as DocumentType })} options={DOC_TYPE_OPTIONS} /><TextArea label="Descripción" value={form.description} onChange={(v) => setForm({ ...form, description: v })} /><input type="file" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><Input label="Cargado por" value={form.uploaded_by} onChange={(v) => setForm({ ...form, uploaded_by: v })} /><Select label="Estado de verificación" value={form.verification_status} onChange={(v) => setForm({ ...form, verification_status: v as VerificationStatus })} options={VERIFICATION_OPTIONS} /><p className="text-xs text-gray-400">Los archivos se almacenan en el bucket de documentos de Supabase. La vista previa aparece dentro del perfil del proveedor.</p></div>}
      </Modal>
    </div>
  );
}