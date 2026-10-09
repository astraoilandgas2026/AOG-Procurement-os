import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Newspaper, Plus, Trash2 } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { getSupabaseClient } from '@/data/supabase-client';
import { Badge, Button, Card, CardBody, EmptyState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type Report = {
  id: string; title: string; publisher: string; report_category: string; report_date: string; sectors: SectorKey[];
  commodities: string[]; region: string; period_label: string; summary: string; key_findings: string;
  source_url: string; source_kind: 'authorized_link' | 'public_pdf' | 'internal_link' | 'other'; access_note: string;
  file_path: string; file_name: string; file_size: number; mime_type: string;
  created_by: string; created_at: string; updated_at: string;
};
type ReportForm = Omit<Report, 'id' | 'created_at' | 'updated_at'>;
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
// Fecha documental confirmada manualmente cuando la imagen no permite leerla con fiabilidad.
const CONFIRMED_DOCUMENT_DATES: Record<string, string> = {
  'IMG_20261009_032131_794.jpg': '2026-10-07',
};
const detectPublicationDate = (text: string): string | null => {
  const validDate = (year: string | number, month: string | number, day: string | number) => {
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(candidate + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100 &&
      d.getUTCMonth() + 1 === Number(month) && d.getUTCDate() === Number(day) ? candidate : null;
  };
  const iso = text.match(/\\b(20\\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\\d|3[01])\\b/);
  if (iso) { const date = validDate(iso[1], iso[2], iso[3]); if (date) return date; }
  const compact = text.match(/\\b(20\\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\b/);
  if (compact) { const date = validDate(compact[1], compact[2], compact[3]); if (date) return date; }
  const months: Record<string, string> = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12', enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06', julio:'07', agosto:'08', septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' };
  const monthNames = 'January|February|March|April|May|June|July|August|September|October|November|December|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
  const dayFirst = text.match(new RegExp('\\\\b(0?[1-9]|[12]\\\\d|3[01])\\\\s+(?:de\\\\s+)?(' + monthNames + ')(?:\\\\s+de)?\\\\s+(20\\\\d{2})\\\\b', 'i'));
  const monthFirst = text.match(new RegExp('\\\\b(' + monthNames + ')\\\\s+(0?[1-9]|[12]\\\\d|3[01]),?\\\\s+(20\\\\d{2})\\\\b', 'i'));
  const m = dayFirst ? months[dayFirst[2].toLowerCase()] : monthFirst ? months[monthFirst[1].toLowerCase()] : '';
  const day = dayFirst ? dayFirst[1] : monthFirst ? monthFirst[2] : '';
  const year = dayFirst ? dayFirst[3] : monthFirst ? monthFirst[3] : '';
  if (m && day && year) { const date = validDate(year, m, day); if (date) return date; }
  // Filenames such as "Argus 30.09.pdf" contain the issue day/month without a year.
  const dayMonth = text.match(/\\b([0-3]?\\d)[./-]([01]?\\d)(?:[./-](20\\d{2}|\\d{2}))?\\b/);
  if (dayMonth) {
    const y = dayMonth[3] ? Number(dayMonth[3].length === 2 ? `20${dayMonth[3]}` : dayMonth[3]) : new Date().getUTCFullYear();
    const date = validDate(y, dayMonth[2], dayMonth[1]);
    if (date) return date;
  }
  return null;
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
const cleanFilenameTitle = (name: string) => name.replace(/\.pdf$/i, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
type ReportGroup = { key: string; label: string; rank: number };
const getReportGroup = (report: Report): ReportGroup => {
  const titleAndFile = `${report.title || ''} ${report.file_name || ''}`.toLowerCase().replace(/[._-]+/g, ' ');
  const publisher = (report.publisher || '').trim();
  if (/harvest report|\bhr\s*26\s*09\s*30\b/.test(titleAndFile)) return { key: 'harvest-report', label: 'Harvest Report', rank: 3 };
  if (/\bai\b|artificial intelligence/.test(titleAndFile)) return { key: 'ai', label: 'AI', rank: 2 };
  if (/\beia\b/.test(titleAndFile)) return { key: 'publisher:eia', label: 'EIA', rank: 4 };
  // Latin American Wire Platts is a Platts publication; its publisher metadata may incorrectly say Argus.
  if (/latin american wire|\blw\s*20\d{6}\b/.test(titleAndFile)) return { key: 'platts', label: 'Platts', rank: 0 };
  if (/\bplatts\b|bunker\s+wire/.test(`${titleAndFile} ${publisher.toLowerCase()}`)) return { key: 'platts', label: 'Platts', rank: 0 };
  if (/\bargus\b/.test(`${titleAndFile} ${publisher.toLowerCase()}`)) return { key: 'argus', label: 'Argus', rank: 1 };
  if (publisher && !/^por identificar$/i.test(publisher)) return { key: `publisher:${publisher.toLowerCase()}`, label: publisher, rank: 5 };
  return { key: 'other', label: 'Otros', rank: 6 };
};
const detectReportSectors = (text: string): SectorKey[] => {
  const t = text.toLowerCase().replace(/[._-]+/g, ' ');
  // Publisher/commodity overrides stop incidental terms from assigning a report to unrelated sectors.
  if (/bunker\s*wire|bunkerwire|bunker fuel|marine fuel|vlsfo|hsfo/.test(t)) return ['energy_commodities'];
  if (/weekly harvest report|crop progress report|wheat fob\s*(?:&|and)?\s*export basis|wheat export basis estimates/.test(t)) return ['agricultural_commodities'];
  const found: SectorKey[] = [];
  if (/used cooking oil|\buco\b|vegetable oil|soybean oil|soy oil|palm oil|olein|feedstock|biodiesel|biofuel|fatty acid|acid oil|crude glycerin|renewable diesel/.test(t)) found.push('feedstock');
  if (/brent|\bwti\b|crude oil|diesel|gasoline|fuel oil|natural gas|\blng\b|\bopec\b|refinery|petroleum|energy market|bunker/.test(t)) found.push('energy_commodities');
  if (/copper|lithium|iron ore|steel|gold|silver|aluminium|aluminum|mining|nickel|mineral concentrate/.test(t)) found.push('mining_commodities');
  if (/fertilizer|fertiliser|urea|ammonia|phosphate|potash|sulphur|sulfur|methanol|nitrogen market|chemical prices/.test(t)) found.push('fertilizers_chemicals');
  if (/wheat|corn|maize|grain|harvest|crop progress|planting|yield forecast|sugar|coffee|cocoa|cotton|oilseed|agricultural commodities|soybean|soybeans/.test(t)) found.push('agricultural_commodities');
  return [...new Set(found)];
};
async function extractImageText(file: File): Promise<string> {
  // OCR gratuito en el navegador; si la CDN o el reconocimiento fallan, la carga del archivo continúa.
  // @ts-ignore Tesseract se carga solo al adjuntar una imagen.
  const tesseract = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const result = await tesseract.recognize(file, 'eng+spa');
  return String(result?.data?.text ?? '').replace(/\\s+/g, ' ').trim();
}

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
const displayDate = (value: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
const shortDate = (value: string) => {
  if (!value) return '';
  const parts = value.slice(0, 10).split('-');
  return parts.length === 3 ? parts[2] + ' ' + parts[1] + ' ' + parts[0].slice(-2) : '';
};
const normalizeDuplicateKey = (value: string) => value.toLowerCase().replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
type DuplicateLevel = 'duplicate' | 'possible';
const getDuplicateLevel = (report: Report, allReports: Report[]): DuplicateLevel | null => {
  const fileName = normalizeDuplicateKey(report.file_name || '');
  const title = normalizeDuplicateKey(displayReportTitle(report));
  const publisher = normalizeDuplicateKey(report.publisher || '');
  const exactMatch = allReports.some(other => {
    if (other.id === report.id) return false;
    const otherFileName = normalizeDuplicateKey(other.file_name || '');
    const sameFileName = !!fileName && fileName === otherFileName;
    const sameIdentity = !!title && title === normalizeDuplicateKey(displayReportTitle(other)) && report.report_date === other.report_date && publisher === normalizeDuplicateKey(other.publisher || '');
    return sameFileName || sameIdentity;
  });
  if (exactMatch) return 'duplicate';
  const possibleMatch = allReports.some(other => other.id !== report.id && report.file_size > 0 && report.file_size === other.file_size && report.report_date === other.report_date && publisher !== '' && publisher === normalizeDuplicateKey(other.publisher || ''));
  return possibleMatch ? 'possible' : null;
};
const detectDocumentLanguage = (text: string): { code: string; label: string } | null => {
  const sample = (text || '').slice(0, 12000).trim();
  if (!sample) return null;
  const cyrillic = (sample.match(/[А-Яа-яЁё]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  if (cyrillic >= 20 && cyrillic > latin * 0.15) return { code: 'ru', label: 'RUSO' };
  const spanishScore = (sample.match(/\b(el|la|los|las|de|del|para|con|mercado|precios|informe|producto|combustible|petróleo|aceite|cosecha|exportación|importación)\b/gi) || []).length;
  const englishScore = (sample.match(/\b(the|and|of|for|with|market|markets|prices|report|supply|demand|volume|issue|products|crude|oil|energy|forecast|exports|imports)\b/gi) || []).length;
  if (spanishScore >= 3 && spanishScore > englishScore * 1.2) return { code: 'es', label: 'ESPAÑOL' };
  if (englishScore >= 3 && englishScore > spanishScore) return { code: 'en', label: 'INGLÉS' };
  return null;
};
const getShortReportDescription = (report: Report): string => {
  const text = [report.summary, report.key_findings, report.title, report.file_name].filter(Boolean).join(' ');
  if (detectDocumentLanguage(text)?.code !== 'ru') return '';
  if (/газ|природн\w* газ|natural gas/i.test(text)) return 'Mercado de gas en el Caspio y Asia Central.';
  if (/нефт|бензин|керосин|битум|топлив/i.test(text)) return 'Precios y novedades de petróleo y combustibles en el Caspio y Asia Central.';
  return 'Informe de mercado en ruso.';
};

const displayReportTitle = (report: Report) => {
  const source = [report.title, report.file_name, report.publisher, report.summary].filter(Boolean).join(' ').toLowerCase().replace(/[._-]+/g, ' ');
  if (/bunker\s*wire|bunkerwire/.test(source)) return 'Bunker Wire Platts';
  if (/harvest report|\bhr\s*26\s*09\s*30\b/.test(source)) return 'Harvest Report';
  if (/\beia\b|short term energy outlook|short-term energy outlook/.test(source)) return 'EIA Energy Outlook';
  if (/\bwet\b/.test(source)) return 'WET';
  if (/\bopr\b|oilgram price report/.test(source)) return 'Oilgram Price Report';
  if (/\beum\b|european marketscan/.test(source)) return 'European Marketscan';
  if (/\bapag\b|asia pacific.{0,12}arab gulf marketscan/.test(source)) return 'Asia-Pacific Marketscan';
  if (/latin american wire|\blw\s*20\d{6}\b/.test(source)) return 'Latin American Wire Platts';
  if (/wheat fob\s*(?:&|and)?\s*export basis/.test(source) || /^wheat\b/.test(source)) return 'Wheat';
  const title = (report.title || cleanFilenameTitle(report.file_name || '') || 'Informe').replace(/\s+/g, ' ').trim();
  return title.replace(/\b20\d{6}\b/g, '').replace(/\s+/g, ' ').trim() || 'Informe';
};

export function IntelligenceReportsPage() {
  const { procurementDomain } = useNav();
  const client = getSupabaseClient();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [processingFile, setProcessingFile] = useState(false);
  const [fileMessage, setFileMessage] = useState('');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);


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
  const reportGroups = useMemo(() => {
    const groups = new Map<string, ReportGroup & { count: number }>();
    for (const report of reports) {
      const group = getReportGroup(report);
      const existing = groups.get(group.key);
      if (existing) existing.count += 1;
      else groups.set(group.key, { ...group, count: 1 });
    }
    return [...groups.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }, [reports]);
  const visibleReports = useMemo(
    () => reports.filter(report => selectedGroup === 'all' || getReportGroup(report).key === selectedGroup),
    [reports, selectedGroup],
  );
  const duplicateLevels = useMemo(() => new Map(reports.map(report => [report.id, getDuplicateLevel(report, reports)])), [reports]);

  async function handleFileSelection(file?: File) {
    if (!file || !client || processingFile || saving) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = /^image\/(png|jpeg|webp|gif)$/.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (!isPdf && !isImage) { setFileMessage('Adjunta un PDF o una imagen (PNG, JPG o WEBP).'); return; }
    if (file.size > 25 * 1024 * 1024) { setFileMessage('El archivo supera el límite de 25 MB.'); return; }

    setProcessingFile(true); setSaving(true); setFileMessage(isPdf ? 'Procesando PDF…' : 'Leyendo fecha y texto de la imagen…'); setError('');
    let fullText = '';
    let metadataTitle = '';
    let extractionFailed = false;
    let imageOcrFailed = false;
    let uploadedPath = '';
    try {
      if (isPdf) {
        try {
          const extracted = await extractPdfContent(file);
          fullText = extracted.text;
          metadataTitle = extracted.title;
        } catch {
          extractionFailed = true;
        }
      } else if (isImage) {
        try {
          fullText = await extractImageText(file);
        } catch {
          imageOcrFailed = true;
        }
      }

      const proposedTitle = metadataTitle || cleanFilenameTitle(file.name) || file.name;
      const combinedText = proposedTitle + ' ' + file.name + ' ' + fullText;
      const confirmedDate = CONFIRMED_DOCUMENT_DATES[file.name];
      // Prioridad: fecha confirmada explícitamente, fecha leída del documento, nombre/metadata y por último fecha actual.
      const proposedDate = confirmedDate || detectPublicationDate(fullText) || detectPublicationDate(metadataTitle) || detectPublicationDate(file.name) || new Date().toISOString().slice(0, 10);
      const publisher = detectPublisher(combinedText) || 'Por identificar';
      const detectedSectors = detectReportSectors(combinedText);
      const sectors: SectorKey[] = detectedSectors.length ? detectedSectors : (procurementDomain ? [procurementDomain] : ['feedstock']);
      const sentences = fullText.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 35);
      const summary = sentences.slice(0, 3).join(' ').slice(0, 1200);
      const signalTerms = /price|pricing|stock|stocks|crush|crushing|crop|harvest|supply|demand|export|import|production|forecast|margin|spread|tonne|metric ton|brent|soy|oil|biodiesel|urea|copper|inventor/i;
      const findings = sentences.filter(x => signalTerms.test(x)).slice(0, 8).join('\n').slice(0, 1800);
      const commodities = ['UCO','soybean oil','cottonseed','Brent','diesel','urea','copper','wheat','corn','sugar'].filter(term => combinedText.toLowerCase().includes(term.toLowerCase()));
      uploadedPath = `reports/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await client.storage.from('intelligence-reports').upload(uploadedPath, file, { contentType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'), upsert: false });
      if (uploadError) throw new Error('No se pudo adjuntar el archivo: ' + uploadError.message);

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
        mime_type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        created_by: 'Astra',
        updated_at: new Date().toISOString(),
      };
      const { error: insertError } = await client.from('intelligence_reports').insert(payload).select('id').single();
      if (insertError) throw new Error('El PDF se subió, pero no se pudo registrar: ' + insertError.message);
      uploadedPath = '';
      setFileMessage(isImage
        ? (confirmedDate ? 'Imagen guardada. Fecha documental confirmada: ' + confirmedDate + '.' : imageOcrFailed || !fullText ? 'Imagen guardada, pero no se pudo leer el texto. Revisa la fecha documental.' : 'Imagen guardada; fecha y texto procesados por OCR. Verifica la fecha documental.')
        : extractionFailed || !fullText
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
    setPreviewReport(report);
    setPreviewUrl('');
    setPreviewLoading(true);
    setError('');
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(report.file_path, 1800);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? 'No se pudo abrir el archivo.');
      setPreviewReport(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewUrl(data.signedUrl);
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewReport(null);
    setPreviewUrl('');
  }

  async function downloadAttachedFile(report: Report) {
    if (!client || !report.file_path) return;
    const { data, error: signedError } = await client.storage.from('intelligence-reports').createSignedUrl(report.file_path, 1800, { download: report.file_name || true });
    if (signedError || !data?.signedUrl) { setError(signedError?.message ?? 'No se pudo descargar el PDF.'); return; }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = report.file_name || 'informe.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function deleteReport(report: Report) {
    if (!client || !confirm('¿Eliminar el registro de este informe y su PDF adjunto?')) return;
    const { error: deleteError } = await client.from('intelligence_reports').delete().eq('id', report.id);
    if (deleteError) { setError(deleteError.message); return; }
    if (report.file_path) await client.storage.from('intelligence-reports').remove([report.file_path]);
    await loadReports();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="Biblioteca de informes" subtitle="" action={<label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus size={15} /> Agregar informe<input type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" aria-label="Agregar informe o imagen" disabled={processingFile || saving} onChange={e => { void handleFileSelection(e.target.files?.[0]); e.currentTarget.value = ''; }} className="sr-only" /></label>} />
      {(processingFile || fileMessage) && <p role="status" className="text-xs text-slate-500">{processingFile ? 'Procesando PDF…' : fileMessage}</p>}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <section aria-label="Tipos de informes"><div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={selectedGroup === 'all'} onClick={() => setSelectedGroup('all')} className={'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ' + (selectedGroup === 'all' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
          <span>Todos</span><span className={selectedGroup === 'all' ? 'text-slate-300' : 'text-slate-400'}>{reports.length}</span>
        </button>
        {reportGroups.map(group => {
          const active = selectedGroup === group.key;
          return <button key={group.key} type="button" aria-pressed={active} onClick={() => setSelectedGroup(active ? 'all' : group.key)} className={'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ' + (active ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
            <span>{group.label}</span><span className={active ? 'text-slate-300' : 'text-slate-400'}>{group.count}</span>
          </button>;
        })}
      </div></section>
      {visibleReports.length === 0 ? <Card><EmptyState icon={<Newspaper size={22} />} title={reports.length === 0 ? 'La biblioteca está vacía' : 'No hay informes en este grupo'} message="Pulsa «Agregar informe» para adjuntar un PDF o una imagen." /></Card> : (
        <div className="space-y-2">
          {visibleReports.map(report => {
            const duplicateLevel = duplicateLevels.get(report.id);
            const rowStyle = duplicateLevel === 'duplicate' ? 'border-red-300 bg-red-50' : duplicateLevel === 'possible' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white';
            return <div key={report.id} className={'flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-sm ' + rowStyle}>
            <FileText size={17} className={'shrink-0 ' + (duplicateLevel === 'duplicate' ? 'text-red-500' : duplicateLevel === 'possible' ? 'text-amber-600' : 'text-slate-400')} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800" title={displayReportTitle(report)}>{displayReportTitle(report)}</p>
              <p className="truncate text-[11px] text-slate-400">{shortDate(report.report_date)}{getShortReportDescription(report) ? ' · ' + getShortReportDescription(report) : ''}</p>
            </div>
            {detectDocumentLanguage([report.summary, report.key_findings, report.title, report.file_name].filter(Boolean).join(' ')) && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{detectDocumentLanguage([report.summary, report.key_findings, report.title, report.file_name].filter(Boolean).join(' '))?.label}</span>}
            {duplicateLevel && <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ' + (duplicateLevel === 'duplicate' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>{duplicateLevel === 'duplicate' ? 'Duplicado' : 'Posible duplicado'}</span>}
            <div className="flex shrink-0 items-center gap-1">
              {report.file_path && <button type="button" aria-label="Visualizar archivo" title="Visualizar archivo" onClick={() => void openAttachedFile(report)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><Eye size={16} /></button>}
              {report.file_path && <button type="button" aria-label="Descargar archivo" title="Descargar archivo" onClick={() => void downloadAttachedFile(report)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100"><Download size={16} /></button>}
              <button type="button" aria-label="Eliminar informe" title="Eliminar informe" onClick={() => void deleteReport(report)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>;
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">{visibleReports.length} {visibleReports.length === 1 ? 'informe' : 'informes'} — nuevos informes cada 48 horas</p>
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/60 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label="Vista previa del informe">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <p className="min-w-0 truncate text-sm font-medium text-slate-800" title={displayReportTitle(previewReport)}>{displayReportTitle(previewReport)}</p>
              <button type="button" onClick={closePreview} aria-label="Cerrar vista previa" title="Cerrar" className="ml-3 rounded p-1.5 text-slate-600 hover:bg-slate-100"><span aria-hidden="true">×</span></button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-1 sm:p-3">
              {previewLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500">Cargando PDF…</div>
                : previewUrl ? (previewReport.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(previewReport.file_name || '') ? <div className="flex h-full w-full items-center justify-center overflow-auto"><img src={previewUrl} alt={displayReportTitle(previewReport)} className="max-h-full max-w-full object-contain" /></div> : <iframe title="Vista previa del documento" src={previewUrl} className="h-full w-full rounded border border-slate-200 bg-white" />)
                : <p className="p-4 text-sm text-slate-600">No se pudo cargar la vista previa.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
