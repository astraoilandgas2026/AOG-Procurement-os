import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Trash2, Upload, History, X } from 'lucide-react';
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
  const [hasSession, setHasSession] = useState(false);
  const [accessEmail, setAccessEmail] = useState('astraoilandgas9@gmail.com');
  const [sendingLink, setSendingLink] = useState(false);
  const [accessLinkSent, setAccessLinkSent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AstraDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const client = getSupabaseClient();

  async function load() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await client
      .from('astra_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else {
      setError('');
      setDocs((data ?? []) as AstraDocument[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      if (session) window.setTimeout(() => { void load(); }, 0);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  async function sendAccessLink() {
    if (!client || !accessEmail.trim()) return;
    setSendingLink(true);
    setError('');
    setAccessLinkSent(false);
    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: accessEmail.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.href.split('#')[0],
        },
      });
      if (authError) throw authError;
      setAccessLinkSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace de acceso.');
    } finally {
      setSendingLink(false);
    }
  }

  async function signOut() {
    if (!client) return;
    const { error: authError } = await client.auth.signOut();
    if (authError) setError(authError.message);
    else {
      setHasSession(false);
      setAccessLinkSent(false);
      await load();
    }
  }

  async function upload() {
    if (!client || !file || !title.trim()) return;
    if (!hasSession && !['company_profile', 'corporate', 'other'].includes(category)) {
      setError('KYC y CIS requieren una sesión autorizada. Sin iniciar sesión, solo se pueden gestionar documentos corporativos no sensibles.');
      return;
    }
    setUploading(true);
    setError('');
    let storagePath = '';
    let insertedId = '';
    try {
      const { data: currentRows, error: currentError } = await client
        .from('astra_documents')
        .select('id,version')
        .eq('category', category)
        .eq('is_current', true)
        .order('version', { ascending: false })
        .limit(1);
      if (currentError) throw currentError;
      const previous = currentRows?.[0];
      const nextVersion = (previous?.version ?? 0) + 1;

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = 'corporate/' + category + '/' + Date.now() + '-v' + nextVersion + '-' + safeName;

      const uploadResult = await client.storage.from('astra-docs').upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadResult.error) throw uploadResult.error;

      const { data: inserted, error: insertError } = await client.from('astra_documents').insert({
        title: title.trim(),
        category,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        version: nextVersion,
        is_current: true,
        uploaded_by: 'Astra',
      }).select('id').single();
      if (insertError) throw insertError;
      insertedId = inserted.id;

      if (previous?.id) {
        const { data: superseded, error: supersedeError } = await client
          .from('astra_documents')
          .update({ is_current: false })
          .eq('id', previous.id)
          .select('id');
        if (supersedeError) throw supersedeError;
        if (!superseded?.length) throw new Error('No se pudo confirmar el cambio de versión. La versión anterior se conserva.');
      }

      setFile(null);
      setTitle(category === 'company_profile' ? 'Company Profile' : CATEGORY_LABELS[category]);
      const input = document.getElementById('astra-document-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (e) {
      // Roll back the newly inserted row/file so a failed version switch does not
      // leave a broken current version or orphan the uploaded file.
      if (insertedId) await client.from('astra_documents').delete().eq('id', insertedId);
      if (storagePath) await client.storage.from('astra-docs').remove([storagePath]);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el documento.');
    } finally {
      setUploading(false);
    }
  }

  async function preview(doc: AstraDocument) {
    if (!client) return;
    setPreviewDoc(doc);
    setPreviewUrl('');
    setPreviewLoading(true);
    setError('');
    const { data, error: previewError } = await client.storage.from('astra-docs').createSignedUrl(doc.storage_path, 60 * 60);
    if (previewError) {
      setError(previewError.message);
      setPreviewDoc(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewUrl(data.signedUrl);
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewDoc(null);
    setPreviewUrl('');
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
          <Button onClick={upload} disabled={!hasSession || !file || !title.trim() || uploading}>
            <Upload size={16} /> {uploading ? 'Cargando…' : hasSession ? 'Subir documento' : 'Inicia sesión para subir'}
          </Button>
        }
      />

      {!hasSession ? (
        <Card>
          <CardBody>
            <div className="font-medium text-slate-900">Acceso autorizado para gestionar documentos</div>
            <p className="mt-1 text-sm text-slate-600">La consulta del Company Profile sigue disponible sin iniciar sesión. Para subir, sustituir o eliminar archivos, usa el correo autorizado de Astra.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={accessEmail}
                onChange={e => setAccessEmail(e.target.value)}
                placeholder="Correo autorizado de Astra"
                autoComplete="email"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
              <Button onClick={sendAccessLink} disabled={!accessEmail.trim() || sendingLink}>
                {sendingLink ? 'Enviando…' : 'Enviar enlace de acceso'}
              </Button>
            </div>
            {accessLinkSent && <p className="mt-2 text-sm text-green-700">Enlace enviado si el correo corresponde a una cuenta autorizada. Ábrelo desde este dispositivo y vuelve a esta sección.</p>}
            <p className="mt-2 text-xs text-slate-500">KYC y CIS solo están disponibles para sesiones autenticadas y autorizadas.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={signOut}>Cerrar sesión</Button>
        </div>
      )}

      <Card>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr_auto] items-end">
            <label className="text-sm font-medium text-slate-700">
              Tipo
              <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setTitle(CATEGORY_LABELS[e.target.value]); }}>
                <option value="company_profile">Company Profile</option>
                <option value="kyc" disabled={!hasSession}>KYC{!hasSession ? ' · requiere sesión autorizada' : ''}</option>
                <option value="cis" disabled={!hasSession}>CIS{!hasSession ? ' · requiere sesión autorizada' : ''}</option>
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
          {!hasSession && <p className="mt-1 text-xs text-slate-500">Por seguridad, sin sesión solo se pueden consultar documentos no sensibles; las modificaciones requieren acceso autorizado.</p>}
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
                        <Button size="sm" variant="ghost" onClick={() => preview(doc)} title="Vista previa"><Eye size={15} /></Button>
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
          {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="Vista previa del documento">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{previewDoc.title}</div>
                <div className="truncate text-xs text-slate-500">{previewDoc.file_name} · v{previewDoc.version}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={closePreview} title="Cerrar"><X size={18} /></Button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center"><LoadingSpinner /></div>
              ) : previewUrl && previewDoc.mime_type === 'application/pdf' ? (
                <iframe title="Vista previa PDF" src={previewUrl} className="h-full w-full rounded border border-slate-200 bg-white" />
              ) : previewUrl && previewDoc.mime_type.startsWith('image/') ? (
                <div className="flex h-full items-center justify-center overflow-auto">
                  <img src={previewUrl} alt={previewDoc.file_name} className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <FileText size={40} className="text-slate-400" />
                  <p className="max-w-md text-sm text-slate-600">Este formato no tiene visor nativo en el navegador. Puedes descargarlo sin cerrar la aplicación.</p>
                  <Button onClick={() => download(previewDoc)}><Download size={15} /> Descargar</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
