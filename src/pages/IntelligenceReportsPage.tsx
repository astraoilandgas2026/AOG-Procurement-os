import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, FileText, Newspaper, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useNav } from '@/context/NavContext';
import { getSupabaseClient } from '@/data/supabase-client';
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type Report = {
  id: string; title: string; publisher: string; report_date: string; sectors: SectorKey[];
  commodities: string[]; region: string; period_label: string; summary: string; key_findings: string;
  source_url: string; source_kind: 'authorized_link' | 'public_pdf' | 'internal_link'; access_note: string;
  created_by: string; created_at: string; updated_at: string;
};
type ReportForm = Omit<Report, 'id' | 'created_at' | 'updated_at'>;
const SECTORS: { value: SectorKey; label: string }[] = [
  { value: 'feedstock', label: 'Vegetable Oils & Feedstocks' },
  { value: 'energy_commodities', label: 'Energy' },
  { value: 'mining_commodities', label: 'Mining' },
  { value: 'fertilizers_chemicals', label: 'Fertilizers & Chemicals' },
  { value: 'agricultural_commodities', label: 'Agricultural' },
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
const STANDARD_PUBLISHERS = ['Argus', 'S&P Global Platts', 'ICIS', 'IEA', 'EIA', 'USDA', 'FAO', 'Otro'];
const emptyForm = (sectors: SectorKey[]): ReportForm => ({
  title: '', publisher: 'Argus', report_date: new Date().toISOString().slice(0, 10), sectors: sectors.length ? sectors : ['feedstock'],
  commodities: [], region: '', period_label: isoWeekLabel(new Date().toISOString().slice(0, 10)), summary: '', key_findings: '', source_url: '',
  source_kind: 'authorized_link', access_note: 'Acceso según licencia o permisos de la fuente.', created_by: 'Astra',
});
const labelForSector = (value: string) => SECTORS.find(s => s.value === value)?.label ?? value;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReportForm | null>(null);
  const [publisherChoice, setPublisherChoice] = useState('Argus');
  const [customPublisher, setCustomPublisher] = useState('');

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
    setEditingId(null);
    setPublisherChoice('Argus');
    setCustomPublisher('');
    setForm(emptyForm(procurementDomain ? [procurementDomain] : []));
    setError('');
  }
  function startEdit(report: Report) {
    setEditingId(report.id);
    const isStandardPublisher = STANDARD_PUBLISHERS.slice(0, -1).includes(report.publisher);
    setPublisherChoice(isStandardPublisher ? report.publisher : 'Otro');
    setCustomPublisher(isStandardPublisher ? '' : report.publisher);
    setForm({
      title: report.title, publisher: report.publisher, report_date: report.report_date,
      sectors: report.sectors ?? [], commodities: report.commodities ?? [], region: report.region ?? '',
      period_label: report.period_label ?? '', summary: report.summary ?? '', key_findings: report.key_findings ?? '',
      source_url: report.source_url ?? '', source_kind: report.source_kind ?? 'authorized_link',
      access_note: report.access_note ?? '', created_by: report.created_by ?? 'Astra',
    });
    setError('');
  }
  function closeForm() { setForm(null); setEditingId(null); }
  function updateForm<K extends keyof ReportForm>(key: K, value: ReportForm[K]) {
    setForm(current => current ? { ...current, [key]: value } : current);
  }
  async function saveReport() {
    if (!client || !form) return;
    if (!form.title.trim()) { setError('El título es obligatorio.'); return; }
    if (!form.sectors.length) { setError('Selecciona al menos un sector.'); return; }
    if (form.source_url.trim()) {
      try { const url = new URL(form.source_url.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { setError('El enlace debe ser una URL válida que empiece por https:// o http://.'); return; }
    }
    setSaving(true); setError('');
    const finalPublisher = (publisherChoice === 'Otro' ? customPublisher : publisherChoice).trim();
    if (!finalPublisher) { setError('Selecciona o escribe la fuente del informe.'); setSaving(false); return; }
    const payload = { ...form, title: form.title.trim(), publisher: finalPublisher, period_label: isoWeekLabel(form.report_date), source_url: form.source_url.trim(), updated_at: new Date().toISOString() };
    const result = editingId
      ? await client.from('intelligence_reports').update(payload).eq('id', editingId).select('*').single()
      : await client.from('intelligence_reports').insert(payload).select('*').single();
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    await loadReports();
    setSaving(false); closeForm();
  }
  async function deleteReport(report: Report) {
    if (!client || !confirm('¿Eliminar el registro de este informe? No se elimina el PDF de la fuente original.')) return;
    const { error: deleteError } = await client.from('intelligence_reports').delete().eq('id', report.id);
    if (deleteError) { setError(deleteError.message); return; }
    await loadReports();
  }

  if (loading) return <LoadingSpinner />;
  if (error && reports.length === 0) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Intelligence Reports" subtitle="Una biblioteca central de informes de mercado, con acceso por sector y fuente." action={<Button onClick={startNew}><Plus size={16} /> Registrar informe</Button>} />
      <Card><CardBody>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">Buscar
            <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 px-3"><Search size={15} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Título, commodity, región…" className="w-full py-2 text-sm outline-none" /></div>
          </label>
          <label className="text-sm font-medium text-slate-700">Sector
            <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="all">Todos los sectores</option>{SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Fuente
            <select value={publisherFilter} onChange={e => setPublisherFilter(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="all">Todas las fuentes</option>{publishers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={() => void loadReports()}><RefreshCw size={15} /> Actualizar</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1">{reports.length} informes en la biblioteca</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{publishers.length} fuentes</span><span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Registro central: una sola vez para varios sectores</span></div>
      </CardBody></Card>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {form && <Card><CardBody>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{editingId ? 'Editar informe' : 'Registrar nuevo informe'}</h2><button onClick={closeForm} aria-label="Cerrar formulario" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Título del informe *
            <input autoFocus value={form.title} onChange={e => updateForm('title', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Ej. Argus European Products — Weekly" />
          </label>
          <label className="text-sm font-medium text-slate-700">Fuente del informe *
            <select value={publisherChoice} onChange={e => { setPublisherChoice(e.target.value); if (e.target.value !== 'Otro') setCustomPublisher(''); }} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2">
              {STANDARD_PUBLISHERS.map(p => <option key={p} value={p}>{p === 'Otro' ? 'Otra fuente…' : p}</option>)}
              {publishers.filter(p => !STANDARD_PUBLISHERS.includes(p)).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {publisherChoice === 'Otro' && <input value={customPublisher} onChange={e => setCustomPublisher(e.target.value)} className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Escribe el nombre de la fuente" />}
          </label>
          <label className="text-sm font-medium text-slate-700">Fecha de publicación *
            <input type="date" required value={form.report_date} onChange={e => { updateForm('report_date', e.target.value); updateForm('period_label', isoWeekLabel(e.target.value)); }} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
            <span className="mt-1 block text-xs font-semibold text-[var(--astra-red)]">{isoWeekLabel(form.report_date)}</span>
          </label>
          <fieldset className="md:col-span-2"><legend className="mb-2 text-sm font-medium text-slate-700">Sectores relacionados *</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map(s => <label key={s.value} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.sectors.includes(s.value)} onChange={e => updateForm('sectors', e.target.checked ? [...form.sectors, s.value] : form.sectors.filter(v => v !== s.value))} />{s.label}</label>)}
          </div></fieldset>
          <label className="text-sm font-medium text-slate-700">Commodities (separados por coma)
            <input value={form.commodities.join(', ')} onChange={e => updateForm('commodities', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Crude oil, diesel, LNG…" />
          </label>
          <label className="text-sm font-medium text-slate-700">Región / mercado
            <input value={form.region} onChange={e => updateForm('region', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Europe, Brazil, Global…" />
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm md:col-span-2"><span className="font-medium text-slate-700">Semana identificada automáticamente:</span> <span className="font-semibold text-[var(--astra-red)]">{isoWeekLabel(form.report_date)}</span><p className="mt-1 text-xs text-slate-500">Se calcula con la fecha de publicación; no tienes que escribirla manualmente.</p></div>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Resumen ejecutivo
            <textarea value={form.summary} onChange={e => updateForm('summary', e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="¿Qué debe saber el equipo sin leer todo el informe?" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Señales / datos clave
            <textarea value={form.key_findings} onChange={e => updateForm('key_findings', e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Precios, cambios semanales, riesgos, perspectivas…" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Enlace autorizado al PDF o documento
            <input value={form.source_url} onChange={e => updateForm('source_url', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="https://…" />
          </label>
          <label className="text-sm font-medium text-slate-700">Tipo de acceso
            <select value={form.source_kind} onChange={e => updateForm('source_kind', e.target.value as ReportForm['source_kind'])} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2">
              <option value="authorized_link">Enlace con permisos / licencia</option><option value="internal_link">Enlace interno de Astra</option><option value="public_pdf">PDF de acceso público</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Nota de acceso
            <input value={form.access_note} onChange={e => updateForm('access_note', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Quién puede abrirlo o restricciones" />
          </label>
        </div>
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">No cargues aquí un PDF licenciado como archivo público. Guarda el enlace autorizado de Argus/Platts o de la ubicación interna aprobada para el equipo.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={closeForm}>Cancelar</Button><Button onClick={() => void saveReport()} disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar informe'}</Button></div>
      </CardBody></Card>}

      {visibleReports.length === 0 ? <Card><EmptyState icon={<Newspaper size={28} />} title="Todavía no hay informes registrados" message="Registra el primer informe semanal y relaciónalo con uno o varios sectores. La biblioteca se irá ordenando por fecha de publicación." action={!form ? <Button onClick={startNew}><Plus size={16} /> Registrar primer informe</Button> : undefined} /></Card> : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleReports.map(report => <Card key={report.id}><CardBody>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-slate-600"><FileText size={22} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{report.publisher || 'Fuente no indicada'}</span><Badge color="gray">{displayDate(report.report_date)}</Badge>{latestByPublisher.get(report.publisher.trim().toLowerCase()) === report.id && <Badge color="green">MÁS RECIENTE DE {report.publisher.toUpperCase()}</Badge>}<Badge color="blue">{report.period_label || isoWeekLabel(report.report_date)}</Badge></div>
                <h3 className="mt-1 font-semibold text-slate-900">{report.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">{(report.sectors ?? []).map(s => <Badge key={s} color="gray">{labelForSector(s)}</Badge>)}</div>
                {(report.commodities?.length || report.region || report.period_label) ? <p className="mt-2 text-xs text-slate-500">{[report.commodities?.join(', '), report.region, report.period_label].filter(Boolean).join(' · ')}</p> : null}
              </div>
            </div>
            {report.summary && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{report.summary}</p>}
            {report.key_findings && <div className="mt-3 rounded-md bg-slate-50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Señales clave</p><p className="whitespace-pre-wrap text-sm text-slate-700">{report.key_findings}</p></div>}
            {report.access_note && <p className="mt-2 text-xs text-slate-500">Acceso: {report.access_note}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {report.source_url ? <a href={report.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--astra-red)] hover:underline"><ExternalLink size={15} /> Abrir informe / PDF</a> : <span className="text-xs text-slate-400">Sin enlace registrado</span>}
              <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => startEdit(report)}><Pencil size={15} /> Editar</Button><Button size="sm" variant="ghost" onClick={() => void deleteReport(report)}><Trash2 size={15} /> Eliminar</Button></div>
            </div>
          </CardBody></Card>)}
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-slate-400"><CalendarDays size={14} /> {visibleReports.length} informe(s) visibles · Ordenados por fecha de publicación. El distintivo «Más reciente» compara informes de la misma fuente.</p>
    </div>
  );
}
