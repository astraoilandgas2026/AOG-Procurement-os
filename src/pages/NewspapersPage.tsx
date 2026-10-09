import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Newspaper, Plus, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/data/supabase-client';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type NewspaperRecord = {
  id: string; title: string; publisher: string; published_date: string; sectors: SectorKey[];
  topics: string[]; region: string; summary: string; key_findings: string; article_text: string;
  source_url: string; access_note: string; created_by: string; created_at: string; updated_at: string;
  file_path: string; file_name: string; file_size: number; mime_type: string;
};
const PUBLISHERS: [RegExp, string][] = [
  [/new york times|nytimes/i, 'The New York Times'], [/jerusalem post/i, 'The Jerusalem Post'],
  [/financial times|ft\.com/i, 'Financial Times'], [/wall street journal|wsj\.com/i, 'The Wall Street Journal'],
  [/\breuters\b/i, 'Reuters'], [/\bbloomberg\b/i, 'Bloomberg'], [/the economist|economist\.com/i, 'The Economist'],
  [/\bcnbc\b/i, 'CNBC'], [/the guardian|guardian\.com/i, 'The Guardian'], [/nikkei asia|nikkei\.com/i, 'Nikkei Asia'],
  [/handelsblatt/i, 'Handelsblatt'], [/el país|elpais\.com/i, 'El País'], [/la nación|lanacion\.com/i, 'La Nación'],
  [/folha de s\.paulo|folha\.uol/i, 'Folha de S.Paulo'], [/valor econômico|valor\.globo/i, 'Valor Econômico'],
];
const detectPublisher = (text: string) => PUBLISHERS.find(([pattern]) => pattern.test(text))?.[1] ?? 'Por identificar';
const cleanFilenameTitle = (name: string) => name.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
const shortDate = (value: string) => {
  if (!value) return '';
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? parts[2] + ' ' + parts[1] + ' ' + parts[0].slice(-2) : '';
};
const compactNewspaperTitle = (fileName: string, title: string, text: string, date: string) => {
  const source = [fileName, title, text.slice(0, 5000)].filter(Boolean).join(' ').toLowerCase();
  if (/bunker\s*wire|bunkerwire|\bbw[_ -]?\d{8}/.test(source)) return 'Bunker Wire Platts';
  if (/weekly harvest report|hr[\s_-]*26[\s_-]*09[\s_-]*30/.test(source)) return 'Harvest Report ' + (shortDate(date) || '30 09 26');
  if (/wheat fob\s*(?:&|and)?\s*export basis|pr[\s_-]*26[\s_-]*10[\s_-]*02/.test(source)) return 'Wheat ' + (shortDate(date) || '02 10 26');
  return cleanFilenameTitle(fileName).slice(0, 64) || 'Diario';
};
const detectPublicationDate = (text: string) => {
  const iso = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])\b/);
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
  const months: Record<string, string> = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };
  const named = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-3]?\d),?\s+(20\d{2})\b/i);
  if (named) return named[3] + '-' + months[named[1].toLowerCase()] + '-' + named[2].padStart(2, '0');
  const reverse = text.match(/\b([0-3]?\d)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (reverse) return reverse[3] + '-' + months[reverse[2].toLowerCase()] + '-' + reverse[1].padStart(2, '0');
  return new Date().toISOString().slice(0, 10);
};
async function extractPdfContent(file: File): Promise<{ title: string; text: string }> {
  // Same browser-side PDF.js extraction path as Intelligence Reports.
  // @ts-ignore PDF.js is loaded on demand from its public CDN.
  const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let text = '';
  for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 80); pageNo += 1) {
    const content = await (await pdf.getPage(pageNo)).getTextContent();
    text += content.items.map((item: { str?: string }) => item.str ?? '').join(' ') + '\n';
    if (text.length >= 160000) break;
  }
  let title = '';
  try { title = String((await pdf.getMetadata())?.info?.Title ?? '').trim(); } catch { /* PDF metadata is optional. */ }
  return { title, text: text.replace(/\s+/g, ' ').trim().slice(0, 160000) };
}

export function NewspapersPage() {
  const client = getSupabaseClient();
  const [records, setRecords] = useState<NewspaperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewItem, setPreviewItem] = useState<NewspaperRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  async function refresh() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await client.from('intelligence_newspapers').select('*').order('published_date', { ascending: false }).order('created_at', { ascending: false });
    if (queryError) setError('No se pudieron cargar los diarios: ' + queryError.message);
    else setRecords((data ?? []) as NewspaperRecord[]);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);
  const visible = records;

  async function handlePdfSelection(file?: File) {
    if (!file || !client || processingFile || saving) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Selecciona un archivo PDF.'); return; }
    if (file.size > 25 * 1024 * 1024) { setError('El PDF supera el límite de 25 MB.'); return; }
    setProcessingFile(true); setSaving(true); setError(''); setNotice('Leyendo el PDF y guardándolo en Diarios…');
    let uploadedPath = '';
    try {
      let fullText = '';
      let metadataTitle = '';
      let extractionFailed = false;
      try {
        const extracted = await extractPdfContent(file);
        fullText = extracted.text;
        metadataTitle = extracted.title;
      } catch { extractionFailed = true; }
      const extractedDate = fullText ? detectPublicationDate(fullText) : new Date().toISOString().slice(0, 10);
      const title = compactNewspaperTitle(file.name, metadataTitle, fullText, extractedDate);
      const combined = title + ' ' + file.name + ' ' + fullText;
      const publisher = detectPublisher(combined);
      const sectors: SectorKey[] = [];
      const sentences = fullText.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 35);
      const summary = sentences.slice(0, 3).join(' ').slice(0, 1200);
      const signalTerms = /price|pricing|stock|stocks|crush|crushing|crop|harvest|supply|demand|export|import|production|forecast|margin|spread|tonne|metric ton|brent|soy|oil|biodiesel|urea|copper|inventor/i;
      const findings = sentences.filter(x => signalTerms.test(x)).slice(0, 8).join('\n').slice(0, 1800);
      const topics = ['UCO', 'soybean oil', 'cottonseed', 'Brent', 'diesel', 'urea', 'copper', 'wheat', 'corn', 'sugar', 'biodiesel', 'vegetable oil'].filter(term => combined.toLowerCase().includes(term.toLowerCase()));
      const publishedDate = extractedDate;
      uploadedPath = 'newspapers/' + crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const { error: uploadError } = await client.storage.from('intelligence-reports').upload(uploadedPath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw new Error('No se pudo adjuntar el PDF: ' + uploadError.message);
      const payload = {
        title, publisher, published_date: publishedDate, sectors, topics, region: 'Global',
        summary, key_findings: findings, article_text: fullText, source_url: '', access_note: 'Documento interno de Astra.',
        created_by: 'Astra', updated_at: new Date().toISOString(), file_path: uploadedPath, file_name: file.name,
        file_size: file.size, mime_type: 'application/pdf',
      };
      const { error: insertError } = await client.from('intelligence_newspapers').insert(payload).select('id').single();
      if (insertError) throw new Error('El PDF se adjuntó, pero no se pudo registrar en la base de datos: ' + insertError.message);
      uploadedPath = '';
      setNotice(extractionFailed || !fullText
        ? 'PDF guardado y adjunto. No se pudo extraer texto; la ficha conserva el archivo, pero no se ha leído su contenido.'
        : 'PDF leído, analizado y guardado en la base de datos.');
      await refresh();
    } catch (e) {
      if (uploadedPath) await client.storage.from('intelligence-reports').remove([uploadedPath]);
      setError(e instanceof Error ? e.message : 'No se pudo guardar el diario.');
      setNotice('');
    } finally { setProcessingFile(false); setSaving(false); }
  }

  async function openAttachedFile(item: NewspaperRecord) {
    if (!client || !item.file_path) return;
    setPreviewItem(item); setPreviewUrl(''); setPreviewLoading(true);
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(item.file_path, 1800);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? 'No se pudo abrir el PDF.');
      setPreviewItem(null); setPreviewLoading(false); return;
    }
    setPreviewUrl(data.signedUrl); setPreviewLoading(false);
  }

  async function downloadAttachedFile(item: NewspaperRecord) {
    if (!client || !item.file_path) return;
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(item.file_path, 1800, { download: item.file_name || true });
    if (signedError || !data?.signedUrl) { setError(signedError?.message ?? 'No se pudo descargar el PDF.'); return; }
    const link = document.createElement('a');
    link.href = data.signedUrl; link.download = item.file_name || 'diario.pdf';
    document.body.appendChild(link); link.click(); link.remove();
  }

  async function remove(item: NewspaperRecord) {
    if (!client || !window.confirm('¿Eliminar esta entrada de Diarios y su PDF adjunto?')) return;
    const { error: deleteError } = await client.from('intelligence_newspapers').delete().eq('id', item.id);
    if (deleteError) { setError(deleteError.message); return; }
    if (item.file_path) {
      const { error: storageError } = await client.storage.from('intelligence-reports').remove([item.file_path]);
      if (storageError) { setError('La entrada se eliminó, pero no se pudo borrar el PDF: ' + storageError.message); await refresh(); return; }
    }
    setNotice('Entrada eliminada.'); await refresh();
  }

  if (loading) return <LoadingSpinner />;
  return <div className="space-y-4">
    <PageHeader title="Diarios" subtitle="" action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus size={15} /> Agregar diario<input type="file" accept="application/pdf,.pdf" aria-label="Agregar diario PDF" disabled={processingFile || saving} onChange={e => { void handlePdfSelection(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" /></label>} />
    {(processingFile || notice) && <p role="status" className="text-xs text-slate-500">{processingFile ? 'Leyendo PDF…' : notice}</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {visible.length === 0 ? <EmptyState icon={<Newspaper size={22} />} title="Todavía no hay diarios" message="Pulsa «Agregar diario» para adjuntar un PDF." /> : (
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {visible.map(item => <div key={item.id} className="flex min-h-10 items-center gap-2 px-2.5 py-1.5">
          <FileText size={15} className="shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-800" title={item.title}>{item.title || cleanFilenameTitle(item.file_name || '') || 'Diario'}</p></div>
          {item.file_path && <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" aria-label="Ver PDF" title="Ver PDF" onClick={() => void openAttachedFile(item)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100"><Eye size={15} /></button>
            <button type="button" aria-label="Descargar PDF" title="Descargar PDF" onClick={() => void downloadAttachedFile(item)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100"><Download size={15} /></button>
          </div>}
          <button type="button" aria-label="Eliminar diario" title="Eliminar" onClick={() => void remove(item)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
        </div>)}
      </div>
    )}
    <p className="text-xs text-slate-400">{visible.length} documento(s)</p>
    {previewItem && <div className="fixed inset-0 z-50 bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="Vista previa del diario">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <p className="min-w-0 truncate text-sm font-medium text-slate-800">{previewItem.title}</p>
          <button type="button" onClick={() => { setPreviewItem(null); setPreviewUrl(''); }} aria-label="Cerrar vista previa" title="Cerrar" className="ml-3 rounded p-1.5 text-slate-600 hover:bg-slate-100"><span aria-hidden="true">×</span></button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-1 sm:p-3">
          {previewLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500">Cargando PDF…</div>
            : previewUrl ? <iframe title="Vista previa PDF" src={previewUrl} className="h-full w-full rounded border border-slate-200 bg-white" />
            : <p className="p-4 text-sm text-slate-600">No se pudo cargar la vista previa.</p>}
        </div>
      </div>
    </div>}
  </div>;
}
