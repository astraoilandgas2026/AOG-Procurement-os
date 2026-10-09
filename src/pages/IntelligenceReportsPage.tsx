import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Droplets, ExternalLink, FileText, FlaskConical, Fuel, Newspaper, Pickaxe, Plus, Trash2, Wheat, type LucideIcon } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { getSupabaseClient } from '@/data/supabase-client';
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type Report = {
  id: string; title: string; publisher: string; report_category: string; report_date: string; sectors: SectorKey[];
  commodities: string[]; region: string; period_label: string; summary: string; key_findings: string;
  source_url: string; source_kind: 'authorized_link' | 'public_pdf' | 'internal_link' | 'other'; access_note: string;
  file_path: string; file_name: string; file_size: number; mime_type: string;
  created_by: string; created_at: string; updated_at: string;
};
type ReportForm = Omit<Report, 'id' | 'created_at' | 'updated_at'>;
const SECTORS: { value: SectorKey; label: string }[] = [
  { value: 'feedstock', label: 'Feedstock' },
  { value: 'energy_commodities', label: 'Energy' },
  { value: 'mining_commodities', label: 'Metals & Mining' },
  { value: 'fertilizers_chemicals', label: 'Fertilizers & Chemicals' },
  { value: 'agricultural_commodities', label: 'Agricultural' },
];
type SectorCardInfo = { value: SectorKey; subtitle: string; examples: string; Icon: LucideIcon };
const SECTOR_CARDS: SectorCardInfo[] = [
  { value: 'energy_commodities', subtitle: 'Fuel oil, crude, diesel, gas y LNG', examples: 'Precios, balances, flujos y perspectivas', Icon: Fuel },
  { value: 'feedstock', subtitle: 'UCO / AVU, aceites vegetales, oleínas y acid oils', examples: 'Feedstock para biodiésel y mercados de aceites', Icon: Droplets },
  { value: 'fertilizers_chemicals', subtitle: 'Fertilizantes, químicos y ácidos', examples: 'Oferta, demanda, precios y trade flows', Icon: FlaskConical },
  { value: 'agricultural_commodities', subtitle: 'Granos, oleaginosas y agrícolas', examples: 'Cosechas, crushing, exportaciones y stocks', Icon: Wheat },
  { value: 'mining_commodities', subtitle: 'Metales, minerales y concentrados', examples: 'Precios, producción y comercio', Icon: Pickaxe },
];
const isoWeekLabel = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `Semana ${String(week).padStart(2, '0')} · ${date.getUTCFullYear()}`;
};
const REPORT_CATEGORIES = ['Price assessment', 'Crop / harvest', 'Crushing & stocks', 'Supply & demand', 'Market outlook', 'Trade flows', 'Regulatory / policy', 'Other'];
const detectPublicationDate = (text: string) => {
  const iso = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])\b/);
  if (iso) {
    const candidate = `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
    const d = new Date(candidate + 'T12:00:00Z');
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) return candidate;
  }
  const months: Record<string, string> = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };
  const dayFirst = text.match(/\b(0?[1-9]|[12]\d|3[01])\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  const monthFirst = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i);
  const m = dayFirst ? months[dayFirst[2].toLowerCase()] : monthFirst ? months[monthFirst[1].toLowerCase()] : '';
  const day = dayFirst ? dayFirst[1] : monthFirst ? monthFirst[2] : '';
  const year = dayFirst ? dayFirst[3] : monthFirst ? monthFirst[3] : '';
  if (m && day && year) {
    const candidate = `${year}-${m}-${String(day).padStart(2, '0')}`;
    const d = new Date(candidate + 'T12:00:00Z');
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) return candidate;
  }
  return new Date().toISOString().slice(0, 10);
};
const detectReportCategory = (text: string) => {
  const t = text.toLowerCase();
  if (/crushing|crush margin|crushings|stocks|inventories|ending stocks|carryout/.test(t)) return 'Crushing & stocks';
  if (/harvest|crop progress|crop condition|planting|yield forecast|crop forecast/.test(t)) return 'Crop / harvest';
  if (/price assessment|daily assessment|price index|price range|benchmark price|fob price|cfr price|price indication/.test(t)) return 'Price assessment';
  if (/supply and demand|supply\/demand|balance sheet|production forecast|consumption forecast/.test(t)) return 'Supply & demand';
  if (/outlook|forecast|market view|market report|weekly report|monthly report/.test(t)) return 'Market outlook';
  if (/exports|imports|trade flows|shipment|cargo flows|export sales/.test(t)) return 'Trade flows';
  if (/regulation|policy|mandate|legislation|compliance/.test(t)) return 'Regulatory / policy';
  return 'Other';
};
const STANDARD_PUBLISHERS = ['Argus', 'S&P Global Platts', 'ICIS', 'IEA', 'EIA', 'USDA', 'FAO', 'World Bank', 'Fastmarkets', 'BloombergNEF', 'Rystad Energy', 'Wood Mackenzie', 'Kpler', 'Otro'];
const detectPublisher = (title: string, sourceUrl = '') => {
  const text = (title + ' ' + sourceUrl).toLowerCase().replace(/[._-]+/g, ' ');
  if (/\b(argus|argus media)\b/.test(text)) return 'Argus';
  if (/\b(platts|s\s*&?\s*p global|sp global)\b/.test(text)) return 'S&P Global Platts';
  if (/spglobal|commodityinsights/.test(text)) return 'S&P Global Platts';
  if (/\bicis\b/.test(text)) return 'ICIS';
  if (/\biea\b/.test(text)) return 'IEA';
  if (/\beia\b|u\.s\. energy information administration/.test(text)) return 'EIA';
  if (/\busda\b/.test(text)) return 'USDA';
  if (/\bfao\b/.test(text)) return 'FAO';
  if (/world bank/.test(text)) return 'World Bank';
  if (/fastmarkets/.test(text)) return 'Fastmarkets';
  if (/bloombergnef|bnef/.test(text)) return 'BloombergNEF';
  if (/rystad/.test(text)) return 'Rystad Energy';
  if (/wood mackenzie|woodmac/.test(text)) return 'Wood Mackenzie';
  if (/\bkpler\b/.test(text)) return 'Kpler';
  return null;
};
const emptyForm = (sectors: SectorKey[]): ReportForm => ({
  title: '', publisher: 'Por identificar', report_category: 'Market outlook', report_date: new Date().toISOString().slice(0, 10), sectors: sectors.length ? sectors : ['feedstock'],
  commodities: [], region: '', period_label: isoWeekLabel(new Date().toISOString().slice(0, 10)), summary: '', key_findings: '', source_url: '',
  source_kind: 'authorized_link', access_note: 'Acceso según licencia o permisos de la fuente.', file_path: '', file_name: '', file_size: 0, mime_type: '', created_by: 'Astra',
});
const labelForSector = (value: string) => SECTORS.find(s => s.value === value)?.label ?? value;
const cleanFilenameTitle = (name: string) => name.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const detectReportSectors = (text: string): SectorKey[] => {
  const t = text.toLowerCase();
  const found: SectorKey[] = [];
  if (/uco|used cooking oil|vegetable oil|soybean oil|soy oil|palm oil|olein|feedstock|biodiesel|biofuel|fatty acid|acid oil|crude glycerin/.test(t)) found.push('feedstock');
  if (/brent|wti|crude oil|diesel|gasoline|fuel oil|natural gas|lng|opec|refinery|petroleum|energy market/.test(t)) found.push('energy_commodities');
  if (/copper|lithium|iron ore|steel|gold|silver|aluminium|aluminum|mining|nickel|mineral concentrate/.test(t)) found.push('mining_commodities');
  if (/fertilizer|fertiliser|urea|ammonia|phosphate|potash|sulphur|sulfur|methanol|nitrogen market|chemical prices/.test(t)) found.push('fertilizers_chemicals');
  if (/crushing|crop|harvest|soybean|soybeans|wheat|corn|maize|grain|sugar|coffee|cocoa|cotton|stocks|oilseed|agricultural/.test(t)) found.push('agricultural_commodities');
  return [...new Set(found)];
};
async function extractPdfContent(file: File): Promise<{ title: string; text: string }> {
  // PDF.js is loaded only when a PDF is selected; no new build dependency or paid service.
  // @ts-ignore PDF.js is loaded as a browser ES module from its public CDN.
  const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  let text = '';
  for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 80); pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    text += content.items.map((item: { str?: string }) => item.str ?? '').join(' ') + '\n';
    if (text.length >= 160000) break;
  }
  let title = '';
  try {
    const metadata = await pdf.getMetadata();
    title = String(metadata?.info?.Title ?? '').trim();
  } catch { /* Some PDFs have no readable metadata. */ }
  return { title, text: text.replace(/\s+/g, ' ').trim() };
}
const displayDate = (value: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('es-CL') : '—';

export function IntelligenceReportsPage() {
  const { procurementDomain } = useNav();
  const client = getSupabaseClient();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>(procurementDomain ?? 'all');
  const [processingFile, setProcessingFile] = useState(false);
  const [fileMessage, setFileMessage] = useState('');

  useEffect(() => { setSelectedSector(procurementDomain ?? 'all'); }, [procurementDomain]);

  async function loadReports() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: loadError } = await client.from('intelligence_reports').select('*').order('report_date', { ascending: false }).order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    else setReports((data ?? []) as Report[]);
    setLoading(false);
  }
  useEffect(() => { void loadReports(); }, []);

  const latestByPublisher = useMemo(() => {
    const latest = new Map<string, string>();
    for (const report of [...reports].sort((a, b) => b.report_date.localeCompare(a.report_date) || b.created_at.localeCompare(a.created_at))) {
      const key = report.publisher.trim().toLowerCase();
      if (key && !latest.has(key)) latest.set(key, report.id);
    }
    return latest;
  }, [reports]);
  const visibleReports = useMemo(() => reports.filter(r => selectedSector === 'all' || r.sectors?.includes(selectedSector as SectorKey)), [reports, selectedSector]);

  async function handlePdfSelection(file?: File) {
    if (!file || !client || processingFile || saving) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileMessage('Selecciona un archivo PDF.'); return;
    }
    if (file.size > 25 * 1024 * 1024) { setFileMessage('El PDF supera el límite de 25 MB.'); return; }

    setProcessingFile(true); setSaving(true); setFileMessage('Procesando PDF…'); setError('');
    let fullText = '';
    let metadataTitle = '';
    let extractionFailed = false;
    let uploadedPath = '';
    try {
      try {
        const extracted = await extractPdfContent(file);
        fullText = extracted.text;
        metadataTitle = extracted.title;
      } catch {
        extractionFailed = true;
      }

      const proposedTitle = metadataTitle || cleanFilenameTitle(file.name) || file.name;
      const combinedText = proposedTitle + ' ' + file.name + ' ' + fullText;
      const proposedDate = fullText ? detectPublicationDate(fullText) : new Date().toISOString().slice(0, 10);
      const publisher = detectPublisher(combinedText) || 'Por identificar';
      const detectedSectors = detectReportSectors(combinedText);
      const sectors: SectorKey[] = detectedSectors.length ? detectedSectors : (procurementDomain ? [procurementDomain] : ['feedstock']);
      const sentences = fullText.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 35);
      const summary = sentences.slice(0, 3).join(' ').slice(0, 1200);
      const signalTerms = /price|pricing|stock|stocks|crush|crushing|crop|harvest|supply|demand|export|import|production|forecast|margin|spread|tonne|metric ton|brent|soy|oil|biodiesel|urea|copper|inventor/i;
      const findings = sentences.filter(x => signalTerms.test(x)).slice(0, 8).join('\n').slice(0, 1800);
      const commodities = ['UCO','soybean oil','cottonseed','Brent','diesel','urea','copper','wheat','corn','sugar'].filter(term => combinedText.toLowerCase().includes(term.toLowerCase()));
      uploadedPath = `reports/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await client.storage.from('intelligence-reports').upload(uploadedPath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw new Error('No se pudo adjuntar el PDF: ' + uploadError.message);

      const payload = {
        ...emptyForm(sectors),
        title: proposedTitle,
        publisher,
        report_category: detectReportCategory(combinedText),
        report_date: proposedDate,
        sectors,
        commodities,
        period_label: isoWeekLabel(proposedDate),
        summary,
        key_findings: findings,
        source_url: '',
        source_kind: 'internal_link' as const,
        access_note: 'Documento interno de Astra.',
        file_path: uploadedPath,
        file_name: file.name,
        file_size: file.size,
        mime_type: 'application/pdf',
        created_by: 'Astra',
        updated_at: new Date().toISOString(),
      };
      const { error: insertError } = await client.from('intelligence_reports').insert(payload).select('id').single();
      if (insertError) throw new Error('El PDF se subió, pero no se pudo registrar: ' + insertError.message);
      uploadedPath = '';
      setFileMessage(extractionFailed || !fullText
        ? 'PDF guardado. No se pudo extraer texto; la ficha usa el nombre del archivo.'
        : 'PDF guardado.');
      await loadReports();
    } catch (e) {
      if (uploadedPath) await client.storage.from('intelligence-reports').remove([uploadedPath]);
      setError(e instanceof Error ? e.message : 'No se pudo guardar el PDF.');
      setFileMessage('');
    } finally {
      setProcessingFile(false);
      setSaving(false);
    }
  }

  async function openAttachedFile(report: Report) {
    if (!client || !report.file_path) return;
    const tab = window.open('', '_blank');
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(report.file_path, 1800);
    if (signedError || !data?.signedUrl) { if (tab) tab.close(); setError(signedError?.message ?? 'No se pudo abrir el archivo.'); return; }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  async function deleteReport(report: Report) {
    if (!client || !confirm('¿Eliminar el registro de este informe y su PDF adjunto?')) return;
    const { error: deleteError } = await client.from('intelligence_reports').delete().eq('id', report.id);
    if (deleteError) { setError(deleteError.message); return; }
    if (report.file_path) await client.storage.from('intelligence-reports').remove([report.file_path]);
    await loadReports();
  }

  if (loading) return <LoadingSpinner />;
  if (error && reports.length === 0) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Biblioteca de informes" subtitle="" action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--astra-red)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"><Plus size={16} /> Agregar informe<input type="file" accept="application/pdf,.pdf" aria-label="Agregar informe PDF" disabled={processingFile || saving} onChange={e => { void handlePdfSelection(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" /></label>} />
      {(processingFile || fileMessage) && <p role="status" className="text-xs text-slate-500">{processingFile ? 'Procesando PDF…' : fileMessage}</p>}
      <section aria-label="Sectores de inteligencia">
        <div className="flex flex-wrap gap-2">
          {SECTOR_CARDS.map(({ value, Icon }) => {
            const count = reports.filter(r => r.sectors?.includes(value)).length;
            const active = selectedSector === value;
            return <button key={value} type="button" aria-pressed={active} onClick={() => setSelectedSector(active ? 'all' : value)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${active ? 'border-[var(--astra-red)] bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <Icon size={16} /><span>{SECTORS.find(s => s.value === value)?.label}</span><span className="text-xs text-slate-400">{count}</span>
            </button>;
          })}
        </div>
      </section>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {visibleReports.length === 0 ? <Card><EmptyState icon={<Newspaper size={24} />} title={selectedSector === 'all' ? 'La biblioteca está vacía' : `Sin informes de ${SECTORS.find(s => s.value === selectedSector)?.label ?? 'este sector'}`} message="Usa «Agregar informe» para cargar un PDF. Al seleccionar un sector verás solo los informes correspondientes." /></Card> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleReports.map(report => <Card key={report.id}><CardBody>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-slate-600"><FileText size={22} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{report.publisher || 'Fuente no indicada'}</span><Badge color="gray">{displayDate(report.report_date)}</Badge><Badge color="blue">{report.report_category || 'Other'}</Badge>{latestByPublisher.get(report.publisher.trim().toLowerCase()) === report.id && <Badge color="green">MÁS RECIENTE DE {report.publisher.toUpperCase()}</Badge>}<Badge color="blue">{report.period_label || isoWeekLabel(report.report_date)}</Badge></div>
                <h3 className="mt-1 font-semibold text-slate-900">{report.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{(report.sectors ?? []).map(s => <Badge key={s} color="gray">{labelForSector(s)}</Badge>)}</div>
                {(report.commodities?.length || report.region || report.period_label) ? <p className="mt-2 text-xs text-slate-500">{[report.commodities?.join(', '), report.region, report.period_label].filter(Boolean).join(' · ')}</p> : null}
              </div>
            </div>
            {report.summary && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{report.summary}</p>}
            {report.key_findings && <div className="mt-3 rounded-md bg-slate-50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Señales clave</p><p className="whitespace-pre-wrap text-sm text-slate-700">{report.key_findings}</p></div>}
            {report.file_name && <p className="mt-3 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"><FileText size={15} className="shrink-0 text-[var(--astra-red)]" /><span className="min-w-0 flex-1 truncate">{report.file_name}</span><span className="shrink-0">{formatFileSize(report.file_size)}</span></p>}
            {report.access_note && <p className="mt-2 text-xs text-slate-500">Acceso: {report.access_note}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-3">{report.file_path && <button onClick={() => void openAttachedFile(report)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--astra-red)] hover:underline"><Download size={15} /> Abrir PDF adjunto</button>}{report.source_url && <a href={report.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--astra-red)] hover:underline"><ExternalLink size={15} /> Abrir fuente</a>}{!report.source_url && !report.file_path && <span className="text-xs text-slate-400">Sin enlace ni archivo</span>}</div>
              <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => void deleteReport(report)}><Trash2 size={15} /> Eliminar</Button></div>
            </div>
          </CardBody></Card>)}
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={14} /> {visibleReports.length} informe(s) visibles · Ordenados por fecha de publicación. El distintivo «Más reciente» compara informes de la misma fuente.</p>
    </div>
  );
}
