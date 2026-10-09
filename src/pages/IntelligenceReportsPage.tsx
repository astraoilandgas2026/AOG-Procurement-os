import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Download, Droplets, ExternalLink, FileText, FlaskConical, Fuel, Newspaper, Pickaxe, Plus, RefreshCw, Search, Send, Trash2, Upload, Wheat, X, type LucideIcon } from 'lucide-react';
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
type ReportRequestForm = { sector: SectorKey; topic: string; report_type: 'daily' | 'weekly' | 'monthly' | 'one_off'; preferred_source: string; desired_period: string; requested_by: string; notes: string };
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
  const [search, setSearch] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('all');
  const [selectedSector, setSelectedSector] = useState<string>(procurementDomain ?? 'all');
  const [form, setForm] = useState<ReportForm | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [fileMessage, setFileMessage] = useState('');
  const [requestForm, setRequestForm] = useState<ReportRequestForm | null>(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestError, setRequestError] = useState('');

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

  const publishers = useMemo(() => [...new Set(reports.map(r => r.publisher.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b)), [reports]);
  const latestByPublisher = useMemo(() => {
    const latest = new Map<string, string>();
    for (const report of [...reports].sort((a, b) => b.report_date.localeCompare(a.report_date) || b.created_at.localeCompare(a.created_at))) {
      const key = report.publisher.trim().toLowerCase();
      if (key && !latest.has(key)) latest.set(key, report.id);
    }
    return latest;
  }, [reports]);
  const visibleReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter(r => {
      const sectorMatch = selectedSector === 'all' || r.sectors?.includes(selectedSector as SectorKey);
      const publisherMatch = publisherFilter === 'all' || r.publisher === publisherFilter;
      const haystack = [r.title, r.publisher, r.region, r.period_label, r.summary, r.key_findings, ...(r.commodities ?? [])].join(' ').toLowerCase();
      return sectorMatch && publisherMatch && (!needle || haystack.includes(needle));
    });
  }, [reports, search, selectedSector, publisherFilter]);

  function startNew() {
    setProcessingFile(false); setFileMessage('');
    setForm(emptyForm(procurementDomain ? [procurementDomain] : []));
    setError('');
  }
  function closeForm() { setForm(null); setProcessingFile(false); setFileMessage(''); }
  async function handlePdfSelection(file?: File) {
    if (!file || !form || !client || processingFile || saving) return;
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
      setForm(null);
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

  function startRequest(sector: SectorKey) {
    setRequestForm({ sector, topic: '', report_type: 'weekly', preferred_source: 'Argus', desired_period: '', requested_by: '', notes: '' });
    setRequestMessage(''); setRequestError('');
  }
  async function submitRequest() {
    if (!client || !requestForm || requestSaving) return;
    if (requestForm.topic.trim().length < 2 || requestForm.requested_by.trim().length < 2) {
      setRequestError('Indica el informe o commodity que necesitas y quién lo solicita.'); return;
    }
    setRequestSaving(true); setRequestError(''); setRequestMessage('');
    const { data, error: invokeError } = await client.functions.invoke('request-intelligence-report', { body: requestForm });
    setRequestSaving(false);
    if (invokeError || !data?.ok) {
      setRequestError(data?.error || invokeError?.message || 'No se pudo enviar la solicitud. Inténtalo de nuevo.'); return;
    }
    setRequestMessage(data.notification_sent
      ? 'Solicitud enviada. El equipo administrador recibirá un correo con los detalles.'
      : 'Solicitud registrada, pero no pudimos confirmar el envío del correo. El administrador deberá revisar la configuración de notificaciones.');
    setRequestForm(null);
  }

  async function deleteReport(report: Report) {
    if (!client || !confirm('¿Eliminar el registro de este informe y su PDF adjunto?')) return;
    const { error: deleteError } = await client.from('intelligence_reports').delete().eq('id', report.id);
    if (deleteError) { setError(deleteError.message); return; }
    if (report.file_path) await client.storage.from('intelligence-reports').remove([report.file_path]);
    await loadReports();
  }

  if (loading) return <LoadingSpinner />;
  if (error && reports.length === 0 && !form) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Intelligence Reports" subtitle="Una biblioteca central de informes de mercado, con acceso por sector y fuente." action={<Button onClick={startNew}><Plus size={16} /> Agregar informe</Button>} />
      {form && <Card><CardBody>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Upload size={16} />
            <span>{processingFile || saving ? 'Procesando PDF…' : 'Seleccionar PDF'}</span>
            <input type="file" accept="application/pdf,.pdf" aria-label="Seleccionar PDF" disabled={processingFile || saving} onChange={e => { void handlePdfSelection(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" />
          </label>
          <button onClick={closeForm} aria-label="Cerrar" className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        </div>
        {fileMessage && <p role="status" className="mt-2 text-xs text-slate-500">{fileMessage}</p>}
      </CardBody></Card>}
      <section aria-label="Sectores de inteligencia" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-semibold text-[var(--astra-dark)]">Explora por sector</h2><p className="mt-1 text-sm text-[var(--astra-muted)]">Selecciona un mercado para consultar los informes disponibles o solicitar uno nuevo.</p></div><button onClick={() => setSelectedSector('all')} className={`rounded-md border px-3 py-2 text-xs font-semibold ${selectedSector === 'all' ? 'border-[var(--astra-red)] bg-[var(--astra-red-soft)] text-[var(--astra-dark)]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Ver todos los sectores</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SECTOR_CARDS.map(({ value, subtitle, examples, Icon }) => {
            const count = reports.filter(r => r.sectors?.includes(value)).length;
            const active = selectedSector === value;
            return <Card key={value} className={`transition-all ${active ? 'border-[var(--astra-red)] ring-1 ring-[var(--astra-red)]/20' : 'hover:border-slate-300'}`}>
              <CardBody className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3"><div className={`rounded-lg p-3 ${active ? 'bg-[var(--astra-red-soft)] text-[var(--astra-red)]' : 'bg-slate-50 text-[var(--astra-dark)]'}`}><Icon size={22} /></div><div className="min-w-0 flex-1"><h3 className="font-semibold text-[var(--astra-dark)]">{SECTORS.find(s => s.value === value)?.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div>
                <div><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${count ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{count ? `${count} informe${count === 1 ? '' : 's'} disponible${count === 1 ? '' : 's'}` : 'Sin informes registrados'}</span><p className="mt-2 text-xs text-slate-500">{examples}</p></div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3"><Button size="sm" variant={active ? 'primary' : 'secondary'} onClick={() => setSelectedSector(value)}>{count ? 'Ver informes' : 'Explorar sector'} <span aria-hidden="true">→</span></Button><Button size="sm" variant="ghost" onClick={() => startRequest(value)}><ClipboardList size={14} /> Solicitar informe</Button></div>
              </CardBody>
            </Card>;
          })}
        </div>
      </section>

      {requestMessage && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" /><span>{requestMessage}</span><button className="ml-auto text-xs underline" onClick={() => setRequestMessage('')}>Cerrar</button></div>}
      {requestError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{requestError}</div>}
      {requestForm && <Card><CardBody>
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--astra-red)]">Solicitud de mercado</p><h2 className="mt-1 text-base font-semibold text-[var(--astra-dark)]">Solicitar informe de {SECTORS.find(s => s.value === requestForm.sector)?.label}</h2><p className="mt-1 text-sm text-slate-500">La solicitud se registra y se envía al administrador por correo.</p></div><button onClick={() => setRequestForm(null)} aria-label="Cerrar solicitud" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
        <div className="grid gap-3 md:grid-cols-2">


          <label className="text-sm font-medium text-slate-700 md:col-span-2">¿Qué informe o commodity necesitas? *
            <input autoFocus value={requestForm.topic} onChange={e => setRequestForm(v => v ? {...v, topic:e.target.value} : v)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder={requestForm.sector === 'energy_commodities' ? 'Ej. Fuel oil, LNG, diesel, crude…' : requestForm.sector === 'feedstock' ? 'Ej. UCO / AVU, acid oil, oleínas…' : 'Ej. Argus weekly, precios, flujos…'} />
          </label>
          <label className="text-sm font-medium text-slate-700">Frecuencia
            <select value={requestForm.report_type} onChange={e => setRequestForm(v => v ? {...v, report_type:e.target.value as ReportRequestForm['report_type']} : v)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"><option value="daily">Diario</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="one_off">Puntual / una vez</option></select>
          </label>
          <label className="text-sm font-medium text-slate-700">Fuente preferida
            <select value={requestForm.preferred_source} onChange={e => setRequestForm(v => v ? {...v, preferred_source:e.target.value} : v)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"><option>Argus</option><option>S&P Global Platts</option><option>ICIS</option><option>IEA</option><option>EIA</option><option>USDA</option><option>FAO</option><option>No preference</option><option>Otra</option></select>
          </label>
          <label className="text-sm font-medium text-slate-700">Semana / periodo deseado
            <input value={requestForm.desired_period} onChange={e => setRequestForm(v => v ? {...v, desired_period:e.target.value} : v)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Ej. Semana actual, octubre 2026…" />
          </label>
          <label className="text-sm font-medium text-slate-700">¿Quién lo solicita? *
            <input value={requestForm.requested_by} onChange={e => setRequestForm(v => v ? {...v, requested_by:e.target.value} : v)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Nombre (ej. Daniel)" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Contexto adicional (opcional)
            <textarea value={requestForm.notes} onChange={e => setRequestForm(v => v ? {...v, notes:e.target.value} : v)} rows={2} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Uso comercial, mercado destino, urgencia…" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setRequestForm(null)}>Cancelar</Button><Button onClick={() => void submitRequest()} disabled={requestSaving}><Send size={15} /> {requestSaving ? 'Enviando…' : 'Enviar solicitud'}</Button></div>
      </CardBody></Card>}

      <Card><CardBody>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">Buscar en los informes
            <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 px-3"><Search size={15} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Título, commodity, región…" className="w-full py-2 text-sm outline-none" /></div>
          </label>
          <label className="text-sm font-medium text-slate-700">Fuente
            <select value={publisherFilter} onChange={e => setPublisherFilter(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="all">Todas las fuentes</option>{publishers.map(p => <option key={p} value={p}>{p}</option>)}</select>
          </label>
          <Button variant="secondary" onClick={() => void loadReports()}><RefreshCw size={15} /> Actualizar</Button>
        </div>
        
      </CardBody></Card>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {visibleReports.length === 0 ? <Card><EmptyState icon={<Newspaper size={28} />} title={selectedSector === 'all' ? 'La biblioteca todavía está vacía' : `Aún no hay informes de ${SECTORS.find(s => s.value === selectedSector)?.label ?? 'este sector'}`} message={selectedSector === 'all' ? 'Selecciona un sector para consultar sus informes o solicita el primero que necesites.' : 'Puedes solicitar un informe para este sector. Cuando se registre, aparecerá aquí automáticamente.'} action={<div className="flex flex-wrap justify-center gap-2">{selectedSector !== 'all' && <Button variant="secondary" onClick={() => startRequest(selectedSector as SectorKey)}><ClipboardList size={15} /> Solicitar informe</Button>}<Button onClick={startNew}><Plus size={16} /> Agregar informe</Button></div>} /></Card> : (
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
