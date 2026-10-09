import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Newspaper, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { getSupabaseClient } from '@/data/supabase-client';
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, LoadingSpinner, PageHeader } from '@/components/ui';

type SectorKey = 'feedstock' | 'energy_commodities' | 'mining_commodities' | 'fertilizers_chemicals' | 'agricultural_commodities';
type NewspaperRecord = {
  id: string; title: string; publisher: string; published_date: string; sectors: SectorKey[];
  topics: string[]; region: string; summary: string; key_findings: string; article_text: string;
  source_url: string; access_note: string; created_by: string; created_at: string; updated_at: string;
};
type NewspaperForm = Omit<NewspaperRecord, 'id' | 'created_at' | 'updated_at'>;
const SECTORS: { value: SectorKey; label: string; keywords: string[] }[] = [
  { value: 'feedstock', label: 'Feedstock', keywords: ['biodiesel', 'biofuel', 'biofuel', 'used cooking oil', 'uco', 'vegetable oil', 'palm oil', 'soy oil', 'soybean oil', 'canola oil', 'rapeseed', 'olein', 'fatty acid', 'feedstock', 'tallow', 'renewable diesel'] },
  { value: 'energy_commodities', label: 'Energy', keywords: ['oil price', 'crude', 'brent', 'wti', 'diesel', 'gasoline', 'fuel oil', 'natural gas', 'lng', 'opec', 'energy', 'refinery', 'petroleum', 'electricity'] },
  { value: 'mining_commodities', label: 'Metals & Mining', keywords: ['copper', 'lithium', 'iron ore', 'iron', 'steel', 'gold', 'silver', 'aluminium', 'aluminum', 'mining', 'mineral', 'concentrate', 'nickel'] },
  { value: 'fertilizers_chemicals', label: 'Fertilizers & Chemicals', keywords: ['fertilizer', 'fertiliser', 'urea', 'ammonia', 'phosphate', 'potash', 'sulfur', 'sulphur', 'methanol', 'chemical', 'acid', 'nitrogen'] },
  { value: 'agricultural_commodities', label: 'Agriculture', keywords: ['wheat', 'corn', 'maize', 'soybean', 'soybeans', 'grain', 'crop', 'harvest', 'sugar', 'coffee', 'cocoa', 'cotton', 'agriculture', 'agricultural', 'export stocks'] },
];
const PUBLISHERS = [
  'The New York Times', 'The Jerusalem Post', 'Financial Times', 'The Wall Street Journal', 'Reuters',
  'Bloomberg', 'The Economist', 'CNBC', 'The Guardian', 'Nikkei Asia', 'Handelsblatt', 'El País',
  'La Nación', 'Folha de S.Paulo', 'Valor Econômico', 'Otro',
];
const detectPublisher = (text: string) => {
  const t = text.toLowerCase();
  const matches: [RegExp, string][] = [
    [/new york times|nytimes/, 'The New York Times'], [/jerusalem post/, 'The Jerusalem Post'],
    [/financial times|ft\.com/, 'Financial Times'], [/wall street journal|wsj\.com/, 'The Wall Street Journal'],
    [/\breuters\b/, 'Reuters'], [/\bbloomberg\b/, 'Bloomberg'], [/the economist|economist\.com/, 'The Economist'],
    [/\bcnbc\b/, 'CNBC'], [/the guardian|guardian\.com/, 'The Guardian'], [/nikkei asia|nikkei\.com/, 'Nikkei Asia'],
    [/handelsblatt/, 'Handelsblatt'], [/el país|elpais\.com/, 'El País'], [/la nación|lanacion\.com/, 'La Nación'],
    [/folha de s\.paulo|folha\.uol/, 'Folha de S.Paulo'], [/valor econômico|valor\.globo/, 'Valor Econômico'],
  ];
  return matches.find(([pattern]) => pattern.test(t))?.[1] ?? '';
};
const detectSectors = (text: string): SectorKey[] => {
  const normalized = text.toLowerCase();
  return SECTORS.filter(s => s.keywords.some(keyword => normalized.includes(keyword))).map(s => s.value);
};
const dateLabel = (value: string) => value ? new Date(value + 'T12:00:00').toLocaleDateString('es-CL') : '—';
const emptyForm = (): NewspaperForm => ({
  title: '', publisher: '', published_date: new Date().toISOString().slice(0, 10), sectors: [],
  topics: [], region: 'Global', summary: '', key_findings: '', article_text: '', source_url: '',
  access_note: 'Acceso según licencia o permisos de la fuente.', created_by: 'Astra',
});
const labelSector = (key: string) => SECTORS.find(s => s.value === key)?.label ?? key;

export function NewspapersPage() {
  const client = getSupabaseClient();
  const [records, setRecords] = useState<NewspaperRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('all');
  const [form, setForm] = useState<NewspaperForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sectorsManuallySelected, setSectorsManuallySelected] = useState(false);

  async function refresh() {
    if (!client) { setError('Supabase no está configurado.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await client.from('intelligence_newspapers').select('*').order('published_date', { ascending: false }).order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setRecords((data ?? []) as NewspaperRecord[]);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  const publishers = useMemo(() => [...new Set(records.map(r => r.publisher.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [records]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return records.filter(r => (publisherFilter === 'all' || r.publisher === publisherFilter) &&
      (!needle || [r.title, r.publisher, r.region, r.summary, r.key_findings, r.article_text, ...(r.topics ?? []), ...(r.sectors ?? [])].join(' ').toLowerCase().includes(needle)));
  }, [records, search, publisherFilter]);

  function startNew() { setEditingId(null); setSectorsManuallySelected(false); setForm(emptyForm()); setError(''); setNotice(''); }
  function startEdit(item: NewspaperRecord) {
    setEditingId(item.id); setSectorsManuallySelected(true);
    setForm({ title: item.title, publisher: item.publisher, published_date: item.published_date, sectors: item.sectors ?? [],
      topics: item.topics ?? [], region: item.region ?? '', summary: item.summary ?? '', key_findings: item.key_findings ?? '',
      article_text: item.article_text ?? '', source_url: item.source_url ?? '', access_note: item.access_note ?? '', created_by: item.created_by ?? 'Astra' });
    setError(''); setNotice('');
  }
  function closeForm() { setForm(null); setEditingId(null); }
  function update<K extends keyof NewspaperForm>(key: K, value: NewspaperForm[K]) {
    setForm(current => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (key === 'title' || key === 'article_text' || key === 'source_url') {
        const combined = [next.title, next.article_text, next.source_url].join(' ');
        const publisher = detectPublisher(combined);
        if (publisher) next.publisher = publisher;
        const suggested = detectSectors(combined);
        if (suggested.length && !sectorsManuallySelected) next.sectors = suggested;
      }
      return next;
    });
  }
  async function save() {
    if (!client || !form) return;
    if (form.title.trim().length < 2) { setError('El título o nombre de la edición es obligatorio.'); return; }
    if (!form.publisher.trim()) { setError('Indica el periódico o la fuente.'); return; }
    if (form.source_url.trim()) {
      try { const url = new URL(form.source_url.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { setError('El enlace debe comenzar por https:// o http://.'); return; }
    }
    if (!form.sectors.length) { setError('Selecciona al menos un sector; si no corresponde a ninguno, elige el más cercano y explícalo en las notas.'); return; }
    setSaving(true); setError(''); setNotice('');
    const payload = { ...form, article_text: '', title: form.title.trim(), publisher: form.publisher.trim(), source_url: form.source_url.trim(),
      topics: form.topics.map(x => x.trim()).filter(Boolean), updated_at: new Date().toISOString() };
    const result = editingId
      ? await client.from('intelligence_newspapers').update(payload).eq('id', editingId).select().single()
      : await client.from('intelligence_newspapers').insert(payload).select().single();
    setSaving(false);
    if (result.error) { setError(result.error.message.includes('intelligence_newspapers_source_date_unique') ? 'Ese enlace ya está registrado para esa fecha.' : result.error.message); return; }
    setNotice(editingId ? 'Entrada actualizada.' : 'Entrada guardada.');
    closeForm();
    await refresh();
  }
  async function remove(item: NewspaperRecord) {
    if (!client || !window.confirm('¿Eliminar esta entrada de Diarios? Esta acción no se puede deshacer.')) return;
    const { error: deleteError } = await client.from('intelligence_newspapers').delete().eq('id', item.id);
    if (deleteError) setError(deleteError.message);
    else { setNotice('Entrada eliminada.'); await refresh(); }
  }
  if (loading) return <LoadingSpinner />;
  if (error && !records.length) return <ErrorState message={error} />;

  return <div className="space-y-5">
    <PageHeader title="Diarios" subtitle="Prensa económica y global: registra ediciones, artículos y señales útiles para Astra." action={<Button onClick={startNew}><Plus size={16} /> Registrar diario / artículo</Button>} />
    <Card><CardBody>
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <label className="block text-sm font-medium text-slate-700">Buscar
          <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full py-2 outline-none" placeholder="Título, tema, periódico o sector" /></div>
        </label>
        <label className="block text-sm font-medium text-slate-700">Periódico
          <select value={publisherFilter} onChange={e => setPublisherFilter(e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"><option value="all">Todos</option>{publishers.map(p => <option key={p} value={p}>{p}</option>)}</select>
        </label>
        <div className="flex items-end"><Button variant="secondary" onClick={() => void refresh()}><RefreshCw size={15} /> Actualizar</Button></div>
      </div>
    </CardBody></Card>
    {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {form && <Card><CardBody>
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{editingId ? 'Editar entrada' : 'Nueva entrada de prensa'}</h2><p className="mt-1 text-sm text-slate-500">Puedes guardar un artículo individual o una edición diaria y asociarla a varios sectores.</p></div><Button size="sm" variant="ghost" onClick={closeForm}><X size={16} /> Cerrar</Button></div>
      {error && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Título / nombre de la edición *
          <input value={form.title} onChange={e => update('title', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Ej. Global Markets — edición del día" />
        </label>
        <label className="text-sm font-medium text-slate-700">Periódico / fuente *
          <input list="newspaper-publishers" value={form.publisher} onChange={e => update('publisher', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Ej. Financial Times" /><datalist id="newspaper-publishers">{PUBLISHERS.map(p => <option key={p} value={p} />)}</datalist>
        </label>
        <label className="text-sm font-medium text-slate-700">Fecha de publicación *
          <input type="date" value={form.published_date} onChange={e => update('published_date', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">Región
          <input value={form.region} onChange={e => update('region', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Global, EE. UU., Oriente Medio…" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Enlace autorizado al artículo / edición
          <input type="url" value={form.source_url} onChange={e => update('source_url', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="https://…" />
        </label>
        <div className="md:col-span-2"><p className="mb-2 text-sm font-medium text-slate-700">Sectores relacionados *</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{SECTORS.map(s => <label key={s.value} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm"><input type="checkbox" checked={form.sectors.includes(s.value)} onChange={e => { setSectorsManuallySelected(true); update('sectors', e.target.checked ? [...form.sectors, s.value] : form.sectors.filter(x => x !== s.value)); }} />{s.label}</label>)}</div><p className="mt-1 text-xs text-slate-400">Los sectores se sugieren por palabras clave del título/texto. Revísalos: la sugerencia no sustituye una lectura del contenido.</p></div>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Temas / commodities (separados por coma)
          <input value={form.topics.join(', ')} onChange={e => update('topics', e.target.value.split(',').map(x => x.trim()))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Brent, biodiésel, tipos de interés, comercio…" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Resumen ejecutivo
          <textarea value={form.summary} onChange={e => update('summary', e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Qué ocurrió, por qué importa y qué debe vigilar Astra." />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Datos / señales clave
          <textarea value={form.key_findings} onChange={e => update('key_findings', e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Cifras, dirección del mercado, riesgos, fuente y nivel de confianza." />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Texto del artículo o extracto para sugerir sectores (temporal)
          <textarea value={form.article_text} onChange={e => update('article_text', e.target.value)} rows={6} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Pega aquí un fragmento para sugerir sectores. Se usa solo en esta pantalla y no se guarda en la base de datos." />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Nota de acceso / licencia
          <input value={form.access_note} onChange={e => update('access_note', e.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Acceso según suscripción, licencia o fuente pública" />
        </label>
      </div>
      <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">No subas ediciones completas ni PDFs licenciados a un almacenamiento público. El texto pegado aquí solo ayuda a sugerir sectores y no se conserva. Registra el enlace autorizado y tu resumen; para que yo lea un PDF completo, adjúntalo en este chat. Esta pantalla todavía no envía contenido automáticamente a Emma.</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={closeForm}>Cancelar</Button><Button onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar entrada'}</Button></div>
    </CardBody></Card>}
    {visible.length === 0 ? <Card><EmptyState icon={<Newspaper size={28} />} title="No hay entradas registradas" message="Añade una edición o artículo con su fuente y fecha. Puedes relacionarlo con varios sectores de Astra." action={<Button onClick={startNew}><Plus size={16} /> Registrar diario / artículo</Button>} /></Card> : <div className="grid gap-3 xl:grid-cols-2">
      {visible.map(item => <Card key={item.id}><CardBody>
        <div className="flex items-start gap-3"><div className="rounded-lg bg-slate-50 p-3 text-slate-600"><Newspaper size={22} /></div><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.publisher}</span><Badge color="gray">{dateLabel(item.published_date)}</Badge></div>
          <h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{(item.sectors ?? []).map(s => <Badge key={s} color="gray">{labelSector(s)}</Badge>)}</div>
          {item.topics?.length > 0 && <p className="mt-2 text-xs text-slate-500">{item.topics.join(' · ')}</p>}
        </div></div>
        {item.summary && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.summary}</p>}
        {item.key_findings && <div className="mt-3 rounded-md bg-slate-50 p-3"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Señales clave</p><p className="whitespace-pre-wrap text-sm text-slate-700">{item.key_findings}</p></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--astra-red)] hover:underline"><ExternalLink size={15} /> Abrir fuente</a> : <span className="text-xs text-slate-400">Sin enlace</span>}
          <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => startEdit(item)}><Pencil size={15} /> Editar</Button><Button size="sm" variant="ghost" onClick={() => void remove(item)}><Trash2 size={15} /> Eliminar</Button></div>
        </div>
      </CardBody></Card>)}
    </div>}
    <p className="text-xs text-slate-400">{visible.length} entrada(s) visibles · Ordenadas por fecha de publicación.</p>
  </div>;
}
