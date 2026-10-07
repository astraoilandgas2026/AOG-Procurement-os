import { useEffect, useState } from 'react';
import { Download, FileText, Trash2, Upload, History } from 'lucide-react';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Button, Badge, PageHeader } from '@/components/ui';
import { getSupabaseClient } from '@/data/supabase-client';

type AstraDocument = {
  id: string;
  title: string;
  category: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  company_profile: 'Company Profile',
  kyc: 'KYC',
  cis: 'CIS',
  corporate: 'Corporativo',
  other: 'Otro',
};

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

function formatSize(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function AstraDocumentationPage() {
  const [docs, setDocs] = useState<AstraDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('company_profile');
  const [title, setTitle] = useState('Company Profile');
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const client = getSupabaseClient();

  async function load() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await client
      .from('astra_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setDocs((data ?? []) as AstraDocument[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function upload() {
    if (!client || !file || !title.trim()) return;
    setUploading(true);
    setError('');
    try {
      const { data: currentRows, error: currentError } = await client
        .from('astra_documents')
        .select('id,version')
        .eq('category', category)
        .eq('is_current', true)
        .order('version', { ascending: false })
        .limit(1);
      if (currentError) throw currentError;
      const nextVersion = ((currentRows?.[0]?.version as number | undefined) ?? 0) + 1;

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = 'corporate/' + category + '/' + Date.now() + '-v' + nextVersion + '-' + safeName;

      const uploadResult = await client.storage.from('astra-docs').upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadResult.error) throw uploadResult.error;

      if (currentRows?.[0]?.id) {
        const { error: supersedeError } = await client
          .from('astra_documents')
          .update({ is_current: false })
          .eq('id', currentRows[0].id);
        if (supersedeError) {
          await client.storage.from('astra-docs').remove([storagePath]);
          throw supersedeError;
        }
      }

      const { error: insertError } = await client.from('astra_documents').insert({
        title: title.trim(),
        category,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        version: nextVersion,
        is_current: true,
        uploaded_by: 'Astra',
      });
      if (insertError) {
        await client.storage.from('astra-docs').remove([storagePath]);
        throw insertError;
      }

      setFile(null);
      setTitle(category === 'company_profile' ? 'Company Profile' : CATEGORY_LABELS[category]);
      const input = document.getElementById('astra-document-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el documento.');
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: AstraDocument) {
    if (!client) return;
    const { data, error: downloadError } = await client.storage.from('astra-docs').download(doc.storage_path);
    if (downloadError) { setError(downloadError.message); return; }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = doc.file_name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function remove(doc: AstraDocument) {
    if (!client || !confirm('¿Eliminar esta versión de la documentación Astra?')) return;
    const { error: deleteError } = await client.from('astra_documents').delete().eq('id', doc.id);
    if (deleteError) { setError(deleteError.message); return; }
    await client.storage.from('astra-docs').remove([doc.storage_path]);
    await load();
  }

  const currentDocs = docs.filter(d => d.is_current);
  const visible = showHistory ? docs : currentDocs;

  if (loading) return <LoadingSpinner />;
  if (error && !docs.length) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentación Astra"
        subtitle="Documentos corporativos oficiales, siempre con la versión vigente disponible."
        action={
          <Button onClick={upload} disabled={!file || !title.trim() || uploading}>
            <Upload size={16} /> {uploading ? 'Cargando…' : 'Subir documento'}
          </Button>
        }
      />

      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr_auto] items-end">
            <label className="text-sm font-medium text-slate-700">
              Tipo
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setTitle(CATEGORY_LABELS[e.target.value]); }}>
                <option value="company_profile">Company Profile</option>
                <option value="kyc">KYC</option>
                <option value="cis">CIS</option>
                <option value="corporate">Corporativo</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Nombre
              <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={title} onChange={e => setTitle(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Archivo
              <input id="astra-document-file" type="file" accept={ACCEPT} className="mt-1 block w-full text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button variant="secondary" onClick={() => setShowHistory(v => !v)}>
              <History size={15} /> {showHistory ? 'Solo vigentes' : 'Ver historial'}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-slate-400">Las nuevas cargas reemplazan la versión vigente sin borrar el historial. Daniel verá siempre la última versión marcada como vigente.</p>
        </CardBody>
      </Card>

      {visible.length === 0 ? (
        <Card><EmptyState icon={<FileText size={28} />} title="Sin documentación Astra" message="Sube aquí el Company Profile, KYC, CIS y demás documentación corporativa." /></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Documento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Versión</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Archivo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Fecha</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{doc.title}</div>
                      <div className="text-xs text-slate-500">{CATEGORY_LABELS[doc.category] ?? doc.category}</div>
                    </td>
                    <td className="px-4 py-3"><Badge color={doc.is_current ? 'green' : 'gray'}>{doc.is_current ? 'Vigente · v' : 'Histórico · v'}{doc.version}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{doc.file_name} · {formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(doc.created_at).toLocaleString('es-CL')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => download(doc)} title="Descargar"><Download size={15} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(doc)} title="Eliminar"><Trash2 size={15} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
