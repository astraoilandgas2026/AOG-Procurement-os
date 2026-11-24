import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, ExternalLink, Globe2 } from 'lucide-react';

type Assessment = { id:string; market:string; basis:string; price:number; currency:string; unit:string; date:string; source:string; confidence:string; url:string; spec:string; note:string };
type HistoryPoint = { date:string; label:string; price:number; currency:string; unit:string; basis:string; source:string; url:string; note:string };
type MarketData = { asOf:string; title:string; latestPublicData:string; note:string; assessments:Assessment[]; historical:HistoryPoint[]; tradeFlows:{label:string;value:string;period:string;detail:string;source:string;url:string}[]; internalTarget:{price:number;currency:string;unit:string;basis:string;status:string} };
const DATA_URL='https://raw.githubusercontent.com/astraoilandgas2026/AOG-Procurement-os/data/uco-market-intelligence.json';
const money=(v:number,c:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:0}).format(v);
const dateLabel=(v:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)?new Date(v+'T12:00:00Z').toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):v;

export function UcoMarketDashboard(){
 const [data,setData]=useState<MarketData|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;fetch(DATA_URL+'?v=20261124',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Feed no disponible');return r.json() as Promise<MarketData>}).then(d=>{if(active)setData(d)}).catch(()=>{if(active)setError('No se pudo cargar el snapshot de mercado. Reintenta más tarde.')});return()=>{active=false}},[]);
 if(error)return <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>;
 if(!data)return <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500">Cargando inteligencia UCO…</div>;
 return <section className="mb-8 space-y-5" aria-label="UCO market intelligence">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--astra-red)]"><Activity size={14}/> Feedstock · Market Intelligence</div><h2 className="mt-1 text-xl font-bold text-slate-900">UCO — China vs. Europa ARA</h2><p className="mt-1 text-xs text-slate-500">Snapshot actualizado en sistema: {dateLabel(data.asOf)} · Último dato público de China: {dateLabel(data.latestPublicData)}</p></div>
   <span className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Datos fechados · no live</span>
  </div>
  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><p>{data.note}</p></div></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {data.assessments.map(q=><article key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{q.market}</div><div className="mt-1 text-sm font-semibold text-slate-800">{q.basis}</div><div className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{money(q.price,q.currency)}<span className="ml-1 text-xs font-medium text-slate-500">/{q.unit}</span></div><div className="mt-2 text-xs text-slate-500">Fecha: {dateLabel(q.date)}</div><div className="mt-1 text-xs text-slate-500">Confianza: {q.confidence}</div><p className="mt-2 text-xs leading-relaxed text-slate-600">{q.note}</p><a className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline" href={q.url} target="_blank" rel="noreferrer">{q.source} <ExternalLink size={11}/></a></article>)}
  </div>
  <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
   <article className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-center gap-2"><BarChart3 size={17}/><h3 className="text-sm font-bold text-slate-900">Histórico documentado</h3></div>
    <p className="mb-3 text-xs text-slate-500">Cada observación conserva su moneda y base comercial. No es una serie continua homogénea.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Referencia</th><th className="py-2 pr-3">Precio</th><th className="py-2 pr-3">Base</th><th className="py-2">Fuente</th></tr></thead><tbody>{data.historical.map((h,i)=><tr key={h.date+'-'+i} className="border-b border-slate-100 align-top"><td className="py-2.5 pr-3 whitespace-nowrap">{h.date}</td><td className="py-2.5 pr-3 font-medium text-slate-800">{h.label}</td><td className="py-2.5 pr-3 whitespace-nowrap font-semibold tabular-nums">{money(h.price,h.currency)}/{h.unit}</td><td className="py-2.5 pr-3">{h.basis}</td><td className="py-2.5"><a className="underline" href={h.url} target="_blank" rel="noreferrer">{h.source}</a></td></tr>)}</tbody></table></div>
   </article>
   <div className="space-y-4">
    <article className="rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center gap-2"><Globe2 size={17}/><h3 className="text-sm font-bold text-slate-900">Flujos de exportación China</h3></div>{data.tradeFlows.map(x=><div key={x.label} className="border-b border-slate-100 py-2 last:border-0"><div className="flex items-baseline justify-between gap-2"><span className="text-xs font-medium text-slate-700">{x.label}</span><strong className="text-sm tabular-nums">{x.value}</strong></div><p className="text-[11px] text-slate-500">{x.period} · {x.detail}</p><a className="text-[11px] underline text-slate-600" href={x.url} target="_blank" rel="noreferrer">{x.source}</a></div>)}</article>
    <article className="rounded-lg border border-[var(--astra-red)]/30 bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[var(--astra-red)]">Astra · objetivo interno</div><div className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{money(data.internalTarget.price,data.internalTarget.currency)}/{data.internalTarget.unit}</div><p className="mt-1 text-xs font-semibold text-slate-700">{data.internalTarget.basis}</p><p className="mt-2 text-xs text-slate-600">{data.internalTarget.status}</p><p className="mt-2 text-xs text-slate-500">No se presenta como precio de mercado ni como oferta ejecutable. Debe validarse mediante netback completo y calidad real.</p></article>
   </div>
  </div>
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><strong>Regla de comparabilidad:</strong> FOB China, CIF ARA, FOB ARA/NWE y DDP Europa son bases distintas. Normalizar FFA, MIU, azufre, índice de yodo, certificación RED/ISCC, volumen, laycan, flete, seguro, inspección, financiación y costes de destino antes de inferir un diferencial o netback.</div>
 </section>;
}
