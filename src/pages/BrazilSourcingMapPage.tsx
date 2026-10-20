import { useEffect, useMemo, useState } from 'react';
import { getStore } from '@/data/store';
import type { Supplier, Product } from '@/types';

type FeedstockGroup = 'Ácidos grasos'|'UCO / AVU'|'Aceites vegetales'|'Borra / soapstock'|'Por clasificar';
const GROUP_ORDER:FeedstockGroup[]=['Ácidos grasos','UCO / AVU','Aceites vegetales','Borra / soapstock','Por clasificar'];
const groupForType=(type:string,name:string):FeedstockGroup=>{const t=(type+' '+name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(/fatty_acids|acid_oils|acid oil|fatty acid|acidos grasos|oleina|oleins/.test(t))return 'Ácidos grasos';if(/uco|used cooking|used cooking oil|avu|aceite usado/.test(t))return 'UCO / AVU';if(/vegetable_oil|degummed_oil|off_spec_oil|aceite vegetal|soja|algodon|vegetal/.test(t))return 'Aceites vegetales';if(/soapstock|borra/.test(t))return 'Borra / soapstock';return 'Por clasificar'};

type GeoFeature = { type:string; properties:Record<string,unknown>; geometry:{type:string;coordinates:any} };
type GeoCollection = { type:string; features:GeoFeature[] };
const UF_NAMES:Record<string,string> = {
 'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE','distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR','santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO'
};
const UF_LABELS:Record<string,string> = {AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const UF_COLORS:Record<string,string> = {AC:'#d8f3dc',AL:'#ffd6a5',AP:'#caffbf',AM:'#84a59d',BA:'#ffadad',CE:'#fdffb6',DF:'#e4c1f9',ES:'#ffc6ff',GO:'#a0c4ff',MA:'#cdeac0',MT:'#f1c0e8',MS:'#c9e4de',MG:'#ffcfdf',PA:'#b9fbc0',PB:'#f8edeb',PR:'#cdb4db',PE:'#fcefb4',PI:'#b8c0ff',RJ:'#f4acb7',RN:'#d0f4de',RS:'#a9def9',RO:'#e2ece9',RR:'#f9dcc4',SC:'#c3bef7',SP:'#ffd166',SE:'#e5989b',TO:'#90be6d'};
const normalizeUF=(v:unknown)=>{const s=String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return UF_NAMES[s]||(/^[A-Z]{2}$/.test(String(v??''))?String(v):'')};
function supplierUF(city:string,address:string){const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const source=' '+normalize(city+' '+address)+' ';for(const [name,uf] of Object.entries(UF_NAMES)){if(source.includes(' '+name+' '))return uf;}const tokens=(city+' '+address).toUpperCase().split(/[^A-Z]+/);for(const uf of tokens){if(UF_LABELS[uf])return uf;}return ''}
function featureUF(f:GeoFeature){const p=f.properties||{};return normalizeUF(p.sigla||p.SIGLA_UF||p.uf||p.UF||p.abbrev||p.name||p.nome||p.NM_UF||p.NAME_1||p.state)}
function featureRings(f:GeoFeature):number[][][][]{const g=f.geometry;if(!g)return[];if(g.type==='Polygon')return [g.coordinates];if(g.type==='MultiPolygon')return g.coordinates;return[]}
function featureCenter(f:GeoFeature,project:(x:number,y:number)=>number[]){const pts=featureRings(f).flat(2);const center=pts.reduce((a:number[],p:number[])=>[a[0]+p[0]/pts.length,a[1]+p[1]/pts.length],[0,0]);return project(center[0],center[1])}
export function BrazilSourcingMapPage(){
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<string>('');
 const [geo,setGeo]=useState<GeoCollection|null>(null);
 const [geoError,setGeoError]=useState('');
 const [selectedUF,setSelectedUF]=useState('PR');
 const [productFilter,setProductFilter]=useState('Todos');
 const [stateFilter,setStateFilter]=useState('PR');
 useEffect(()=>{let alive=true;(async()=>{const urls=['https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson','https://raw.githubusercontent.com/fititnt/gis-dataset-brasil/master/uf/geojson/uf.json'];for(const url of urls){try{const r=await fetch(url);if(!r.ok)continue;const d=await r.json() as GeoCollection;if(Array.isArray(d.features)&&d.features.length>=25){if(alive)setGeo(d);return}}catch{}}if(alive)setGeoError('No se pudo cargar la cartografía estatal. Comprueba la conexión.');})();return()=>{alive=false}},[]);
 useEffect(()=>{let alive=true;(async()=>{try{const store=getStore();const [s,p]=await Promise.all([store.suppliers.getByDomainKey('feedstock'),store.products.getByDomainKey('feedstock')]);if(alive){setSuppliers(s);setProducts(p)}}catch(e){if(alive)setError(e instanceof Error?e.message:'No se pudieron cargar los proveedores de Astra')}})();return()=>{alive=false}},[]);
 const rows=useMemo(()=>suppliers.filter(s=>String(s.country||'').toLowerCase()==='brazil').map(s=>{const ps=products.filter(p=>p.supplier_id===s.id);const groups=Array.from(new Set(ps.map(p=>groupForType(p.feedstock_type,p.name)))).sort((a,b)=>GROUP_ORDER.indexOf(a)-GROUP_ORDER.indexOf(b));return {name:s.trading_name||s.legal_name,city:(s.city||'').split(',')[0],state:supplierUF(s.city||'',s.address||''),locationStatus:s.address?'Dirección registrada':'Ubicación pendiente',products:ps.map(p=>p.name).join(', ')||'Producto no registrado',productGroups:groups,iscc:'',stage:'',notes:''}}).filter(x=>x.name),[suppliers,products]);
 const visibleRows=rows.filter(p=>(stateFilter==='Todos'||p.state===stateFilter)&&(productFilter==='Todos'||p.productGroups.includes(productFilter as FeedstockGroup))).sort((a,b)=>{const ga=Math.min(...a.productGroups.map(g=>GROUP_ORDER.indexOf(g)),GROUP_ORDER.length-1),gb=Math.min(...b.productGroups.map(g=>GROUP_ORDER.indexOf(g)),GROUP_ORDER.length-1);return ga-gb||a.name.localeCompare(b.name)});
 const chooseState=(uf:string)=>{setSelectedUF(uf);setStateFilter(uf);const match=rows.find(p=>p.state===uf);setSelected(match?.name||'');};
  return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--astra-red)]">Procurement · Feedstock Brasil</p><h2 className="mt-1 text-2xl font-semibold text-[var(--astra-dark)]">Mapa operativo de sourcing</h2></div><div className="rounded-lg border px-3 py-2 text-sm"><b>{rows.length}</b> proveedores en seguimiento</div></div>
  <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
   <section className="rounded-xl border border-[var(--astra-border)] bg-white p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Mapa geográfico de Brasil · 27 unidades federativas</h3></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{geo?geo.features.length+' estados cargados':'Cargando cartografía…'}</span></div>
    {geoError&&<div className="mb-3 rounded-md bg-amber-50 p-2 text-sm text-amber-800">{geoError}</div>}
    <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
     <div className="min-w-0 rounded-lg border bg-sky-50/60 p-2">
      {geo?(()=>{const features=geo.features.map(f=>({f,uf:featureUF(f)})).filter(x=>x.uf);const coords=features.flatMap(({f})=>featureRings(f).flatMap(poly=>poly.flatMap(ring=>ring.map(([x,y])=>[x,y]))));const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const project=(x:number,y:number)=>[16+(x-minX)/(maxX-minX)*488,16+(maxY-y)/(maxY-minY)*440];return <svg viewBox="0 0 520 470" className="w-full" role="img" aria-label="Mapa real de los estados de Brasil, seleccionables">
       {features.map(({f,uf})=><g key={uf} onClick={()=>chooseState(uf)} className="cursor-pointer"><title>{UF_LABELS[uf]||uf}</title>{featureRings(f).map((poly,pi)=>poly.map((ring,ri)=><polygon key={pi+'-'+ri} points={ring.map(([x,y])=>project(x,y).join(',')).join(' ')} fill={rows.some(p=>p.state===uf)?(UF_COLORS[uf]||'#dbeafe'):'#d1d5db'} stroke={selectedUF===uf?'#b91c1c':'#ffffff'} strokeWidth={selectedUF===uf?'2.8':'1.4'} strokeLinejoin="round" opacity={stateFilter!=='Todos'&&stateFilter!==uf?0.48:1}/>))}<text x={featureCenter(f,project)[0]} y={featureCenter(f,project)[1]} fill="#1f2937" fontSize="9" fontWeight="700" textAnchor="middle" pointerEvents="none">{uf}</text></g>)}
      </svg>})():<div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Cargando límites estatales reales…</div>}
      <div className="flex flex-wrap gap-1.5 border-t pt-2">{Object.keys(UF_LABELS).map(uf=><button key={uf} onClick={()=>chooseState(uf)} className={'rounded border px-2 py-1 text-[11px] '+(selectedUF===uf?'border-red-400 bg-red-50 font-bold':'border-slate-200 bg-white')}>{uf}</button>)}</div>
     </div>
     <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3"><p className="text-xs uppercase tracking-wide text-slate-500">Estado seleccionado</p><h4 className="mt-1 text-xl font-semibold">{UF_LABELS[selectedUF]||selectedUF} ({selectedUF})</h4><p className="text-sm text-slate-600">{rows.filter(p=>p.state===selectedUF).length} proveedor(es) con estado registrado. Sin asignar coordenadas de planta no verificadas.</p><button onClick={()=>setStateFilter(stateFilter===selectedUF?'Todos':selectedUF)} className="mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold">{stateFilter===selectedUF?'Mostrar todos los estados':'Filtrar por '+selectedUF}</button></div>
      <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Filtrar por producto</label><select value={productFilter} onChange={e=>{setProductFilter(e.target.value);const match=rows.find(p=>(stateFilter==='Todos'||p.state===stateFilter)&&(e.target.value==='Todos'||p.productGroups.includes(e.target.value as FeedstockGroup)));setSelected(match?.name||'')}} className="w-full rounded-md border bg-white px-3 py-2 text-sm"><option>Todos</option>{GROUP_ORDER.filter(g=>g!=='Por clasificar'&&rows.some(p=>p.productGroups.includes(g))).map(g=><option key={g}>{g}</option>)}</select></div>
      <div><label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Zona / estado</label><select value={stateFilter} onChange={e=>{if(e.target.value==='Todos'){setStateFilter('Todos');setSelected('')}else chooseState(e.target.value)}} className="w-full rounded-md border bg-white px-3 py-2 text-sm"><option>Todos</option>{Object.keys(UF_LABELS).sort((a,b)=>UF_LABELS[a].localeCompare(UF_LABELS[b])).map(uf=><option key={uf} value={uf}>{UF_LABELS[uf]} ({uf})</option>)}</select></div>
      <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Proveedores por producto y zona</p><div className="max-h-64 space-y-2 overflow-y-auto">{visibleRows.length?visibleRows.map(p=><button key={p.name} onClick={()=>{setSelected(p.name);if(p.state){setSelectedUF(p.state);setStateFilter(p.state)}}} className={'block w-full rounded-md border bg-white p-2 text-left '+(selected===p.name?'border-red-300 ring-1 ring-red-100':'border-slate-200')}><span className="block text-sm font-semibold">{p.name}</span><span className="block text-xs text-slate-600">{p.productGroups.filter(g=>g!=='Por clasificar').join(' · ')||'Producto por clasificar'}</span><span className="mt-1 block text-[11px] text-slate-500">{p.city||'Municipio pendiente'}{p.state?' · '+UF_LABELS[p.state]+' ('+p.state+')':' · Estado pendiente'}</span></button>):<p className="rounded border border-dashed p-4 text-sm text-slate-500">No hay proveedores registrados para esta zona y producto. No se mostrarán proveedores de otros estados.</p>}</div></div>
     </div>
    </div>
   </section>
   
  </div>
  
  {error&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
 </div>
}
