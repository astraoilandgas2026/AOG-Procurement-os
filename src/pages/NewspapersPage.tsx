import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Newspaper, Plus, Trash2 } from 'lucide-react';
import { getSupabaseClient } from '@/data/supabase-client';
import { Badge, Button, Card, CardBody, EmptyState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type NewspaperRecord = {
  id: string; title: string; publisher: string; published_date: string; sectors: SectorKey[];
  topics: string[]; region: string; summary: string; key_findings: string; article_text: string;
  source_url: string; access_note: string; created_by: string; created_at: string; updated_at: string;
  file_path: string; file_name: string; file_size: number; mime_type: string;
};
const SECTORS: { value: SectorKey; label: string; keywords: string[] }[] = [
  { value: 'feedstock', label: 'Feedstock', keywords: ['biodiesel', 'biofuel', 'used cooking oil', 'uco', 'vegetable oil', 'palm oil', 'soy oil', 'soybean oil', 'canola oil', 'rapeseed', 'olein', 'fatty acid', 'feedstock', 'tallow', 'renewable diesel'] },
  { value: 'energy_commodities', label: 'Energy', keywords: ['oil price', 'crude', 'brent', 'wti', 'diesel', 'gasoline', 'fuel oil', 'natural gas', 'lng', 'opec', 'energy', 'refinery', 'petroleum', 'electricity'] },
  { value: 'mining_commodities', label: 'Metals & Mining', keywords: ['copper', 'lithium', 'iron ore', 'iron', 'steel', 'gold', 'silver', 'aluminium', 'aluminum', 'mining', 'mineral', 'concentrate', 'nickel'] },
  { value: 'fertilizers_chemicals', label: 'Fertilizers & Chemicals', keywords: ['fertilizer', 'fertiliser', 'urea', 'ammonia', 'phosphate', 'potash', 'sulfur', 'sulphur', 'methanol', 'chemical', 'acid', 'nitrogen'] },
  { value: 'agricultural_commodities', label: 'Agriculture', keywords: ['wheat', 'corn', 'maize', 'soybean', 'soybeans', 'grain', 'crop', 'harvest', 'sugar', 'coffee', 'cocoa', 'cotton', 'agriculture', 'agricultural', 'export stocks'] },
];
const PUBLISHERS: [RegExp, string][] = [
  [/new york times|nytimes/i, 'The New York Times'], [/jerusalem post/i, 'The Jerusalem Post'],
  [/financial times|ft\.com/i, 'Financial Times'], [/wall street journal|wsj\.com/i, 'The Wall Street Journal'],
  [/\breuters\b/i, 'Reuters'], [/\bbloomberg\b/i, 'Bloomberg'], [/the economist|economist\.com/i, 'The Economist'],
  [/\bcnbc\b/i, 'CNBC'], [/the guardian|guardian\.com/i, 'The Guardian'], [/nikkei asia|nikkei\.com/i, 'Nikkei Asia'],
  [/handelsblatt/i, 'Handelsblatt'], [/el país|elpais\.com/i, 'El País'], [/la nación|lanacion\.com/i, 'La Nación'],
  [/folha de s\.paulo|folha\.uol/i, 'Folha de S.Paulo'], [/valor econômico|valor\.globo/i, 'Valor Econômico'],
];
const detectPublisher = (text: string) => PUBLISHERS.find(([pattern]) => pattern.test(text))?.[1] ?? 'Por identificar';
const detectSectors = (text: string): SectorKey[] => {
  const normalized = text.toLowerCase().replace(/[._-]+/g, ' ');
  // A document's core subject wins over incidental terms mentioned in its body.
  if (/bunker\s*wire|bunkerwire|bunker fuel|marine fuel|vlsfo|hsfo/.test(normalized)) return ['energy_commodities'];
  if (/weekly harvest report|crop progress report|wheat fob\s*(?:&|and)?\s*export basis|wheat export basis estimates/.test(normalized)) return ['agricultural_commodities'];
  const scores = SECTORS.map(sector => ({
    value: sector.value,
    score: sector.keywords.reduce((total, keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\const detectSectors = (text: string): SectorKey[] => {
  const normalized = text.toLowerCase();
  return SECTORS.filter(s => s.keywords.some(keyword => normalized.includes(keyword))).map(s => s.value);
};
');
      const matches = normalized.match(new RegExp('\\b' + escaped + '\\b', 'g'));
      return total + (matches?.length ?? 0);
    }, 0),
  })).sort((a, b) => b.score - a.score);
  const highest = scores[0]?.score ?? 0;
  if (highest === 0) return [];
  // Keep multiple sectors only when each has substantial evidence, not one incidental keyword.
  return scores.filter(item => item.score >= Math.max(2, highest * 0.6)).map(item => item.value);
};
const dateLabel = (value: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('es-CL') : '—';
const cleanFilenameTitle = (name: string) => name.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
  const [selectedSector, setSelectedSector] = useState<SectorKey | 'all'>('all');

  async function refresh() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await client.from('intelligence_newspapers').select('*').order('published_date', { ascending: false }).order('created_at', { ascending: false });
    if (queryError) setError('No se pudieron cargar los diarios: ' + queryError.message);
    else setRecords((data ?? []) as NewspaperRecord[]);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);
  const visible = useMemo(() => records.filter(r => selectedSector === 'all' || r.sectors?.includes(selectedSector)), [records, selectedSector]);

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
      const title = (metadataTitle || cleanFilenameTitle(file.name) || file.name).slice(0, 240);
      const combined = title + ' ' + file.name + ' ' + fullText;
      const publisher = detectPublisher(combined);
      const detected = detectSectors(combined);
      const sectors: SectorKey[] = detected;
      const sentences = fullText.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 35);
      const summary = sentences.slice(0, 3).join(' ').slice(0, 1200);
      const signalTerms = /price|pricing|stock|stocks|crush|crushing|crop|harvest|supply|demand|export|import|production|forecast|margin|spread|tonne|metric ton|brent|soy|oil|biodiesel|urea|copper|inventor/i;
      const findings = sentences.filter(x => signalTerms.test(x)).slice(0, 8).join('\n').slice(0, 1800);
      const topics = ['UCO', 'soybean oil', 'cottonseed', 'Brent', 'diesel', 'urea', 'copper', 'wheat', 'corn', 'sugar', 'biodiesel', 'vegetable oil'].filter(term => combined.toLowerCase().includes(term.toLowerCase()));
      const publishedDate = fullText ? detectPublicationDate(fullText) : new Date().toISOString().slice(0, 10);
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
      setSelectedSector('all');
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
    const tab = window.open('', '_blank');
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(item.file_path, 1800);
    if (signedError || !data?.signedUrl) { if (tab) tab.close(); setError(signedError?.message ?? 'No se pudo abrir el PDF.'); return; }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
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
  return <div className="space-y-5">
    <PageHeader title="Diarios" subtitle="" action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus size={16} /> Agregar diario<input type="file" accept="application/pdf,.pdf" aria-label="Agregar diario PDF" disabled={processingFile || saving} onChange={e => { void handlePdfSelection(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" /></label>} />
    {(processingFile || notice) && <p role="status" className="text-xs text-slate-500">{processingFile ? 'Leyendo el PDF y guardándolo…' : notice}</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <section aria-label="Sectores de diarios"><div className="flex flex-wrap gap-2">
      {SECTORS.map(({ value, label }) => {
        const count = records.filter(r => r.sectors?.includes(value)).length;
        const active = selectedSector === value;
        return <button key={value} type="button" aria-pressed={active} onClick={() => setSelectedSector(active ? 'all' : value)} className={'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ' + (active ? 'border-slate-700 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
          <span>{label}</span><span className="text-xs text-slate-400">{count}</span>
        </button>;
      })}
    </div></section>
    {visible.length === 0 ? <Card><EmptyState icon={<Newspaper size={24} />} title={selectedSector === 'all' ? 'Todavía no hay diarios' : 'Sin entradas de ' + (SECTORS.find(s => s.value === selectedSector)?.label ?? 'este sector')} message="Pulsa «Agregar diario» para adjuntar un PDF. El sistema intentará leerlo, extraer sus señales y guardar el documento junto con el contenido." /></Card> : <div className="grid gap-3 xl:grid-cols-2">
      {visible.map(item => <Card key={item.id}><CardBody>
        <div className="flex items-start gap-3"><div className="rounded-lg bg-slate-50 p-3 text-slate-600"><Newspaper size={22} /></div><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.publisher || 'Fuente no identificada'}</span><Badge color="gray">{dateLabel(item.published_date)}</Badge></div>
          <h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{(item.sectors ?? []).map(s => <Badge key={s} color="gray">{SECTORS.find(x => x.value === s)?.label ?? s}</Badge>)}</div>
          {item.topics?.length > 0 && <p className="mt-2 text-xs text-slate-500">{item.topics.join(' · ')}</p>}
        </div></div>
        {item.summary && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.summary}</p>}
        {item.key_findings && <div className="mt-3 rounded-md bg-slate-50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Señales clave</p><p className="whitespace-pre-wrap text-sm text-slate-700">{item.key_findings}</p></div>}
        {item.file_name && <p className="mt-3 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"><FileText size={15} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{item.file_name}</span><span className="shrink-0">{formatFileSize(item.file_size)}</span></p>}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3"><div>{item.file_path ? <button onClick={() => void openAttachedFile(item)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:underline"><Download size={15} /> Abrir PDF adjunto</button> : <span className="text-xs text-slate-400">Sin PDF adjunto</span>}</div><Button size="sm" variant="ghost" onClick={() => void remove(item)}><Trash2 size={15} /> Eliminar</Button></div>
      </CardBody></Card>)}
    </div>}
    <p className="text-xs text-slate-400">{visible.length} entrada(s) visibles · El texto extraído se conserva en la base de datos para su consulta posterior.</p>
  </div>;
}
