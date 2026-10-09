import { useEffect, useMemo, useState } from 'react';
import { Download, Droplets, Eye, FileText, FlaskConical, Fuel, Newspaper, Pickaxe, Plus, Trash2, Wheat, type LucideIcon } from 'lucide-react';
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
  const t = text.toLowerCase().replace(/[._-]+/g, ' ');
  // Publisher-specific/commodity-specific overrides prevent incidental mentions across sectors.
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
const displayReportTitle = (report: Report) => {
  const source = [report.title, report.file_name, report.publisher, report.summary].filter(Boolean).join(' ').toLowerCase();
  if (/bunker\s*wire|bunkerwire/.test(source)) return 'Bunker Wire Platts';
  if (/^hr[\s-]*26[\s-]*09[\s-]*30|weekly harvest report/.test(source)) return 'Harvest Report ' + (shortDate(report.report_date) || '30 09 26');
  if (/^pr[\s-]*26[\s-]*10[\s-]*02|wheat fob\s*(?:&|and)?\s*export basis/.test(source)) return 'Wheat ' + (shortDate(report.report_date) || '02 10 26');
  return (report.title || cleanFilenameTitle(report.file_name || '') || 'Informe').replace(/\s+/g, ' ').trim();
};
