import { useEffect, useMemo, useState } from 'react';
import { getStore } from '@/data/store';
import { useNav } from '@/context/NavContext';
import { Search, Building2, AlertTriangle, ExternalLink } from 'lucide-react';
import type { Supplier, Contact, Product, CommercialOffer } from '@/types';

type Prospect = { name:string; city:string; state:string; locationStatus:'Antecedente por confirmar'|'Dirección pública localizada'|'Ubicación pendiente'; products:string; stage:string; notes:string };
const PROSPECTS: Prospect[] = [
 {name:'JF Andrade',city:'Prado Ferreira',state:'PR',locationStatus:'Antecedente por confirmar',products:'Ácidos grasos; acidez 50%, humedad 3%, impurezas 3%',stage:'En evaluación técnica',notes:'Precio pendiente de mejorar'},
 {name:'Olam Agroindustrial',city:'Tarumã',state:'SP',locationStatus:'Antecedente por confirmar',products:'Corrientes grasas mixtas de algodón y soja',stage:'En evaluación comercial',notes:'Referencia histórica: 28 MT/día y 500 MT/mes; capacidad por confirmar'},
 {name:'BR.O Biorrefinería',city:'Arapongas',state:'PR',locationStatus:'Dirección pública localizada',products:'Oleoquímica, ésteres y glicerina',stage:'Prospecto / DD pendiente',notes:'Rua Pássaro Preto, 121, Parque Industrial II'},
 {name:'Renovar',city:'',state:'',locationStatus:'Ubicación pendiente',products:'Corrientes mixtas; composición vegetal por confirmar',stage:'Proveedor activo en evaluación',notes:'No asignar marcador hasta confirmar planta exacta'},
 {name:'OilioTrax',city:'',state:'',locationStatus:'Ubicación pendiente',products:'Feedstock por confirmar',stage:'Seguimiento pendiente',notes:'Nombre comercial por verificar'},
 {name:'Oilio Sul — Rubén Pinto',city:'Nossa Senhora das Graças',state:'PR',locationStatus:'Antecedente por confirmar',products:'Por reconfirmar',stage:'Relación por revisar',notes:'Conservar historial; reconfirmar ubicación'},
 {name:'H2 Oilio Carol',city:'',state:'',locationStatus:'Ubicación pendiente',products:'Por confirmar',stage:'Prospecto',notes:'Ficha por completar'},
 {name:'BioSul / Ademir Ankara',city:'',state:'',locationStatus:'Ubicación pendiente',products:'Por confirmar',stage:'Contacto sin identificación suficiente',notes:'No asociar a empresas homónimas sin evidencia'},
 {name:'MG Oils',city:'',state:'',locationStatus:'Ubicación pendiente',products:'Por confirmar',stage:'Prospecto',notes:'Ficha por completar'},
];
const statusColor=(s:string)=>s.includes('pendiente')||s.includes('confirmar')?'bg-amber-50 text-amber-800':s.includes('evaluación')?'bg-orange-50 text-orange-800':'bg-emerald-50 text-emerald-800';
export function BrazilSourcingMapPage(){
 const {selectSupplier}=useNav();
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [offers,setOffers]=useState<CommercialOffer[]>([]);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<string>('JF Andrade');
 useEffect(()=>{let alive=true;(async()=>{try{const store=getStore();const [s,c,p,o]=await Promise.all([store.suppliers.getByDomainKey('feedstock'),store.contacts.getByDomainKey('feedstock'),store.products.getByDomainKey('feedstock'),store.commercialOffers.getByDomainKey('feedstock')]);if(alive){setSuppliers(s);setContacts(c);setProducts(p);setOffers(o)}}catch(e){if(alive)setError(e instanceof Error?e.message:'No se pudo cargar el repositorio')}})();return()=>{alive=false}},[]);
 const rows=useMemo(()=>{const db:Prospect[]=suppliers.map(s=>({name:s.trading_name||s.legal_name,city:s.city,state:'',locationStatus:s.city?'Antecedente por confirmar':'Ubicación pendiente',products:products.filter(p=>p.supplier_id===s.id).map(p=>p.name).join(', ')||'Productos no registrados',stage:s.lifecycle,notes:s.address||'Ficha desde el repositorio Astra'}));const all=[...PROSPECTS,...db.filter(s=>!PROSPECTS.some(p=>p.name.toLowerCase()===(s.name||'').toLowerCase()))];return all.filter(x=>(x.name+' '+x.city+' '+x.state+' '+x.products+' '+x.stage).toLowerCase().includes(query.toLowerCase()))},[suppliers,products,query]);
 const active=rows.find(x=>x.name===selected)||rows[0];
 return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--astra-red)]">Procurement · Feedstock Brasil</p><h2 className="mt-1 text-2xl font-semibold text-[var(--astra-dark)]">Mapa operativo de sourcing</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Plantas, estados, contactos, productos y etapa comercial. Estados separados por color; las ubicaciones de plantas requieren validación documental.</p></div><div className="rounded-lg border px-3 py-2 text-sm"><b>{rows.length}</b> proveedores en seguimiento</div></div>
  <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
   <section className="rounded-xl border border-[var(--astra-border)] bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Brasil · foco Sur y Sudeste</h3><span className="text-xs text-slate-500">Esquema operativo, no cartografía catastral</span></div>
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-3">
     <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Norte · verde</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Centro-Oeste · amarillo</span><span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800">Sudeste · naranja</span><span className="rounded-full bg-violet-100 px-2 py-1 text-violet-800">Sur · violeta</span></div>
     <svg viewBox="0 0 520 450" className="w-full" role="img" aria-label="Mapa esquemático de Brasil con estados separados y coloreados por región">
      <g stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
       <polygon points="120,28 190,20 224,47 211,94 155,110 112,78" fill="#86efac"/><text x="165" y="66" fill="#14532d" stroke="none" textAnchor="middle" fontSize="14" fontWeight="700">AM</text>
       <polygon points="224,47 286,38 314,75 292,121 236,119 211,94" fill="#4ade80"/><text x="263" y="86" fill="#14532d" stroke="none" textAnchor="middle" fontSize="14" fontWeight="700">PA</text>
       <polygon points="314,75 355,91 365,128 334,148 292,121" fill="#bbf7d0"/><text x="333" y="119" fill="#14532d" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">TO</text>
       <polygon points="355,91 408,104 435,140 409,174 365,162 365,128" fill="#86efac"/><text x="395" y="143" fill="#14532d" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">BA</text>
       <polygon points="112,78 155,110 155,158 112,172 83,133" fill="#d9f99d"/><text x="119" y="139" fill="#365314" stroke="none" textAnchor="middle" fontSize="11" fontWeight="700">AC/RO</text>
       <polygon points="155,110 211,94 236,119 221,163 176,177 155,158" fill="#fcd34d"/><text x="193" y="140" fill="#78350f" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">MT</text>
       <polygon points="236,119 292,121 299,164 260,184 221,163" fill="#fde68a"/><text x="261" y="151" fill="#78350f" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">GO</text>
       <polygon points="299,164 334,148 365,162 355,201 322,215 299,193" fill="#fdba74"/><text x="333" y="186" fill="#7c2d12" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">MG</text>
       <polygon points="260,184 299,193 322,215 308,248 269,246 246,218" fill="#fb923c"/><text x="286" y="221" fill="#7c2d12" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">SP</text>
       <polygon points="246,218 269,246 262,276 228,276 216,249" fill="#c4b5fd"/><text x="243" y="258" fill="#4c1d95" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">PR</text>
       <polygon points="228,276 262,276 271,301 247,319 219,305" fill="#a78bfa"/><text x="246" y="300" fill="#4c1d95" stroke="none" textAnchor="middle" fontSize="12" fontWeight="700">SC</text>
       <polygon points="219,305 247,319 239,357 203,370 185,344 195,320" fill="#8b5cf6"/><text x="215" y="342" fill="#ffffff" stroke="none" textAnchor="middle" fontSize="13" fontWeight="700">RS</text>
       <polygon points="322,215 355,201 375,222 359,248 327,244" fill="#fdba74"/><text x="350" y="229" fill="#7c2d12" stroke="none" textAnchor="middle" fontSize="11" fontWeight="700">RJ</text>
       <polygon points="365,162 389,159 402,178 383,196 355,201 365,162" fill="#fed7aa"/><text x="381" y="180" fill="#7c2d12" stroke="none" textAnchor="middle" fontSize="10" fontWeight="700">ES</text>
       <polygon points="176,177 221,163 246,218 216,249 180,230 166,204" fill="#fbbf24"/><text x="202" y="208" fill="#78350f" stroke="none" textAnchor="middle" fontSize="12" fontWeight="700">MS</text>
      </g>
      <text x="20" y="410" fill="#64748b" fontSize="12">Esquema regional orientativo · no usar para navegación</text>
     </svg>
     <div className="flex flex-wrap items-center gap-2 px-2 pb-1 text-xs text-slate-700"><span className="font-semibold">Estados prioritarios:</span><span className="rounded bg-violet-100 px-2 py-1 text-violet-900">PR · Paraná</span><span className="rounded bg-orange-100 px-2 py-1 text-orange-900">SP · São Paulo</span></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">Mapa regional esquemático con estados separados por color; no representa límites cartográficos oficiales. No se muestran pines de plantas hasta verificar su dirección exacta.</p>
   </section>
   <section className="rounded-xl border border-[var(--astra-border)] bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Expediente del proveedor</h3><Building2 size={18} className="text-slate-500"/></div>{active?<><h4 className="text-lg font-semibold">{active.name}</h4><div className="mt-2 flex flex-wrap gap-2"><span className={'rounded-full px-2 py-1 text-xs '+statusColor(active.locationStatus)}>{active.locationStatus}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{active.stage}</span></div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs uppercase text-slate-500">Municipio / estado</dt><dd className="mt-1">{active.city||'Pendiente'}{active.state?', '+active.state:''}</dd></div><div><dt className="text-xs uppercase text-slate-500">Productos / parámetros</dt><dd className="mt-1">{active.products}</dd></div><div><dt className="text-xs uppercase text-slate-500">Notas y pendientes</dt><dd className="mt-1">{active.notes}</dd></div><div><dt className="text-xs uppercase text-slate-500">Contactos / ofertas registrados en Astra</dt><dd className="mt-1">{contacts.filter(c=>suppliers.some(s=>s.id===c.supplier_id&&(s.trading_name||s.legal_name)===active.name)).length} contactos · {offers.filter(o=>suppliers.some(s=>s.id===o.supplier_id&&(s.trading_name||s.legal_name)===active.name)).length} ofertas</dd></div></dl><button onClick={()=>{const s=suppliers.find(s=>(s.trading_name||s.legal_name)===active.name);if(s)selectSupplier(s.id)}} className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-slate-50">Abrir ficha en Proveedores <ExternalLink size={14}/></button></>:<p>Selecciona un proveedor.</p>}</section>
  </div>
  <section className="rounded-xl border border-[var(--astra-border)] bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Pipeline de sourcing</h3><label className="flex items-center gap-2 rounded-md border px-3 py-2"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar proveedor, ciudad o producto" className="w-56 max-w-full text-sm outline-none"/></label></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3">Ubicación</th><th className="px-3 py-3">Productos</th><th className="px-3 py-3">Etapa</th><th className="px-3 py-3">Evidencia geográfica</th></tr></thead><tbody>{rows.map((p,i)=><tr key={p.name+i} onClick={()=>setSelected(p.name)} className={'cursor-pointer border-b last:border-0 hover:bg-slate-50 '+(selected===p.name?'bg-red-50/40':'')}><td className="px-3 py-3 font-medium">{p.name}</td><td className="px-3 py-3">{p.city?p.city+(p.state?', '+p.state:''):'Pendiente'}</td><td className="max-w-xs px-3 py-3">{p.products}</td><td className="px-3 py-3">{p.stage}</td><td className="px-3 py-3"><span className={'inline-flex rounded-full px-2 py-1 text-xs '+statusColor(p.locationStatus)}>{p.locationStatus}</span></td></tr>)}</tbody></table></div></section>
  {error&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline" size={16}/>{error}. Se muestran los antecedentes iniciales, sin modificar ni reemplazar datos existentes.</div>}
  <p className="text-xs text-slate-500">Fuente operativa: antecedentes de sourcing aportados para Astra y registros actuales del repositorio. CLAIMED ≠ DOCUMENTED ≠ INDEPENDENTLY VERIFIED ≠ PHYSICALLY VERIFIED. Las capacidades históricas no se consideran disponibilidad confirmada.</p>
 </div>
}
