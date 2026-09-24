import { getSupabaseClient } from '@/data/supabase-client';
import type {
  AppData, Supplier, Contact, Product, TechnicalSpec, CommercialOffer,
  Certification, DocumentRecord, DueDiligenceItem, LogisticsInfo, TimelineEvent,
  FollowUp, RedFlag, IntelligenceFact,
} from '@/types';
import type {
  SupplierRepository, ContactRepository, ProductRepository,
  TechnicalSpecRepository, CommercialOfferRepository,
  CertificationRepository, DocumentRepository, DueDiligenceRepository,
  LogisticsRepository, TimelineRepository, FollowUpRepository, RedFlagRepository, IntelligenceFactRepository,
  DataStore,
} from '@/data/store';

// ============================================================
// SUPABASE-BACKED DATA STORE
// ============================================================
// Implements the same DataStore interface as InMemoryStore,
// but all operations go to Supabase. The UI does not know
// which backend is active — it just calls getStore().
// ============================================================

const _client = getSupabaseClient();
if (!_client) throw new Error('Supabase client not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
const client = _client;

type Row = Record<string, unknown>;

function toISO(ts: string): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

// -- Suppliers --

function mapSupplier(r: Row): Supplier {
  return {
    id: r.id as string,
    domain_id: r.domain_id as string | undefined,
    legal_name: r.legal_name as string ?? '',
    trading_name: r.trading_name as string ?? '',
    country: r.country as string ?? '',
    city: r.city as string ?? '',
    address: r.address as string ?? '',
    tax_id: r.tax_id as string ?? '',
    cnae: r.cnae as string ?? '',
    administrator: r.administrator as string ?? '',
    legal_status: r.legal_status as string ?? '',
    facility: r.facility as string ?? '',
    operation_status: r.operation_status as string ?? '',
    theoretical_capacity: r.theoretical_capacity as string ?? '',
    real_production: r.real_production as string ?? '',
    available_volume: r.available_volume as string ?? '',
    volume_to_astra: r.volume_to_astra as string ?? '',
    trial_volume: r.trial_volume as string ?? '',
    recurring_volume: r.recurring_volume as string ?? '',
    infrastructure: r.infrastructure as string ?? '',
    lifecycle: r.lifecycle as Supplier['lifecycle'] ?? 'prospect',
    created_at: r.created_at as string ?? '',
    updated_at: r.updated_at as string ?? '',
  };
}

function mapContact(r: Row): Contact {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    name: r.name as string ?? '', title: r.title as string ?? '',
    email: r.email as string ?? '', phone: r.phone as string ?? '',
    whatsapp: r.whatsapp as string ?? '', is_primary: Boolean(r.is_primary),
    notes: r.notes as string ?? '', created_at: r.created_at as string ?? '',
  };
}

function mapProduct(r: Row): Product {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    name: r.name as string ?? '', feedstock_type: r.feedstock_type as Product['feedstock_type'] ?? 'other',
    origin: r.origin as string ?? '', composition: r.composition as string ?? '',
    available_volume: r.available_volume as string ?? '', unit: r.unit as string ?? 'MT',
    verification_status: r.verification_status as Product['verification_status'] ?? 'claimed',
    created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}

function mapTechSpec(r: Row): TechnicalSpec {
  return {
    id: r.id as string, product_id: r.product_id as string,
    parameter: r.parameter as string ?? '', value: r.value as string ?? '',
    unit: r.unit as string ?? '', method: r.method as string ?? '',
    verification_status: r.verification_status as TechnicalSpec['verification_status'] ?? 'claimed',
    created_at: r.created_at as string ?? '',
  };
}

function mapOffer(r: Row): CommercialOffer {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    product_id: r.product_id as string ?? '',
    price: r.price as string ?? '', currency: r.currency as string ?? 'USD',
    price_basis: r.price_basis as string ?? '', incoterm: r.incoterm as CommercialOffer['incoterm'] ?? 'FOB',
    loading_point: r.loading_point as string ?? '', port: r.port as string ?? '',
    destination: r.destination as string ?? '', payment_terms: r.payment_terms as string ?? '',
    offered_volume: r.offered_volume as string ?? '', trial_quantity: r.trial_quantity as string ?? '',
    recurring_quantity: r.recurring_quantity as string ?? '', certification_premium: r.certification_premium as string ?? '',
    commercial_validity: r.commercial_validity as string ?? '',
    verification_status: r.verification_status as CommercialOffer['verification_status'] ?? 'claimed',
    created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}

function mapCert(r: Row): Certification {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    cert_type: r.cert_type as string ?? '', cert_number: r.cert_number as string ?? '',
    status: r.status as Certification['status'] ?? 'pending',
    issue_date: r.issue_date as string ?? '', expiration_date: r.expiration_date as string ?? '',
    issuing_body: r.issuing_body as string ?? '', notes: r.notes as string ?? '',
    created_at: r.created_at as string ?? '',
  };
}

function mapDoc(r: Row): DocumentRecord {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    product_id: r.product_id as string | null, dd_item_id: r.dd_item_id as string | null,
    doc_type: r.doc_type as DocumentRecord['doc_type'] ?? 'other',
    title: r.title as string ?? '', description: r.description as string ?? '',
    file_name: r.file_name as string ?? '', file_url: r.file_url as string ?? '',
    uploaded_by: r.uploaded_by as string ?? '',
    verification_status: r.verification_status as DocumentRecord['verification_status'] ?? 'claimed',
    created_at: r.created_at as string ?? '',
  };
}

function mapDD(r: Row): DueDiligenceItem {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    category: r.category as DueDiligenceItem['category'] ?? 'legal',
    status: r.status as DueDiligenceItem['status'] ?? 'pending',
    findings: r.findings as string ?? '', evidence_ref: r.evidence_ref as string ?? '',
    reviewer: r.reviewer as string ?? '', review_date: r.review_date as string ?? '',
    created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}

function mapLogistics(r: Row): LogisticsInfo {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    origin_location: r.origin_location as string ?? '', loading_location: r.loading_location as string ?? '',
    port: r.port as string ?? '', transport_mode: r.transport_mode as LogisticsInfo['transport_mode'] ?? 'sea',
    container_type: r.container_type as LogisticsInfo['container_type'] ?? 'flexitank',
    estimated_shipment_size: r.estimated_shipment_size as string ?? '', lead_time: r.lead_time as string ?? '',
    export_readiness: r.export_readiness as LogisticsInfo['export_readiness'] ?? 'claimed',
    notes: r.notes as string ?? '', created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}

function mapTimeline(r: Row): TimelineEvent {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    event_type: r.event_type as TimelineEvent['event_type'] ?? 'note',
    title: r.title as string ?? '', description: r.description as string ?? '',
    actor: r.actor as string ?? '', event_date: r.event_date as string ?? '',
    created_at: r.created_at as string ?? '',
  };
}

function mapFollowUp(r: Row): FollowUp {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    title: r.title as string ?? '', description: r.description as string ?? '',
    responsible_person: r.responsible_person as string ?? '', due_date: r.due_date as string ?? '',
    priority: r.priority as FollowUp['priority'] ?? 'medium',
    status: r.status as FollowUp['status'] ?? 'open',
    created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}

function mapRedFlag(r: Row): RedFlag {
  return {
    id: r.id as string, supplier_id: r.supplier_id as string,
    flag_type: r.flag_type as string ?? '', description: r.description as string ?? '',
    evidence: r.evidence as string ?? '', source: r.source as string ?? '',
    reviewer: r.reviewer as string ?? '', flag_date: r.flag_date as string ?? '',
    status: r.status as RedFlag['status'] ?? 'open',
    created_at: r.created_at as string ?? '',
  };
}

function mapIntelligenceFact(r: Row): IntelligenceFact {
  return {
    id: r.id as string, domain_id: r.domain_id as string, entity_type: r.entity_type as string ?? '',
    entity_id: r.entity_id as string, field_name: r.field_name as string ?? '',
    value_text: r.value_text as string ?? '', unit: r.unit as string ?? '',
    fact_date: r.fact_date as string | null, source_type: r.source_type as string ?? '',
    source_ref: r.source_ref as string ?? '',
    verification_status: r.verification_status as IntelligenceFact['verification_status'] ?? 'claimed',
    is_contradiction: Boolean(r.is_contradiction), contradiction_key: r.contradiction_key as string ?? '',
    notes: r.notes as string ?? '', created_at: r.created_at as string ?? '', updated_at: r.updated_at as string ?? '',
  };
}


// Helper: strip id/created_at/updated_at for insert
function strip<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

export class SupabaseStore implements DataStore {
  suppliers: SupplierRepository = {
    getAll: async () => {
      const { data, error } = await client.from('suppliers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapSupplier);
    },
    getById: async (id: string) => {
      const { data, error } = await client.from('suppliers').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapSupplier(data as Row) : null;
    },
    getByDomain: async (domainId: string) => {
      const { data, error } = await client.from('suppliers').select('*').eq('domain_id', domainId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapSupplier);
    },
    createForDomain: async (domainKey: 'feedstock' | 'energy_commodities', data) => {
      const domainName = domainKey === 'feedstock' ? 'Feedstock' : 'Energy Commodities';
      const { data: domain, error: domainError } = await client.from('procurement_domains').select('id').eq('name', domainName).maybeSingle();
      if (domainError) throw domainError;
      if (!domain) throw new Error(`Procurement domain not found: ${domainName}`);
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      payload.domain_id = domain.id;
      const { data: row, error } = await client.from('suppliers').insert(payload).select().single();
      if (error) throw error;
      return mapSupplier(row as Row);
    },
    getByDomainKey: async (domainKey: 'feedstock' | 'energy_commodities') => {
      const domainName = domainKey === 'feedstock' ? 'Feedstock' : 'Energy Commodities';
      const { data: domain, error: domainError } = await client.from('procurement_domains').select('id').eq('name', domainName).maybeSingle();
      if (domainError) throw domainError;
      if (!domain) return [];
      const { data, error } = await client.from('suppliers').select('*').eq('domain_id', domain.id as string).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapSupplier);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('suppliers').insert(payload).select().single();
      if (error) throw error;
      return mapSupplier(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('suppliers').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapSupplier(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
  };

  contacts: ContactRepository = {
    getAll: async () => {
      const { data, error } = await client.from('contacts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapContact);
    },
    getByDomainKey: async (domainKey: 'feedstock' | 'energy_commodities') => {
      const domainName = domainKey === 'feedstock' ? 'Feedstock' : 'Energy Commodities';
      const { data: domain, error: domainError } = await client.from('procurement_domains').select('id').eq('name', domainName).maybeSingle();
      if (domainError) throw domainError;
      if (!domain) return [];
      const { data: suppliers, error: supplierError } = await client.from('suppliers').select('id').eq('domain_id', domain.id as string);
      if (supplierError) throw supplierError;
      const ids = (suppliers as Row[]).map(s => s.id as string);
      if (!ids.length) return [];
      const { data, error } = await client.from('contacts').select('*').in('supplier_id', ids).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapContact);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('contacts').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapContact);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('contacts').insert(payload).select().single();
      if (error) throw error;
      return mapContact(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('contacts').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapContact(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
  };

  products: ProductRepository = {
    getAll: async () => {
      const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapProduct);
    },
    getByDomainKey: async (domainKey: 'feedstock' | 'energy_commodities') => {
      const domainName = domainKey === 'feedstock' ? 'Feedstock' : 'Energy Commodities';
      const { data: domain, error: domainError } = await client.from('procurement_domains').select('id').eq('name', domainName).maybeSingle();
      if (domainError) throw domainError;
      if (!domain) return [];
      const { data: suppliers, error: supplierError } = await client.from('suppliers').select('id').eq('domain_id', domain.id as string);
      if (supplierError) throw supplierError;
      const ids = (suppliers as Row[]).map(s => s.id as string);
      if (!ids.length) return [];
      const { data, error } = await client.from('products').select('*').in('supplier_id', ids).order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapProduct);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('products').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapProduct);
    },
    getById: async (id: string) => {
      const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapProduct(data as Row) : null;
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('products').insert(payload).select().single();
      if (error) throw error;
      return mapProduct(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('products').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapProduct(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) throw error;
    },
  };

  technicalSpecs: TechnicalSpecRepository = {
    getByProduct: async (productId: string) => {
      const { data, error } = await client.from('technical_specs').select('*').eq('product_id', productId);
      if (error) throw error;
      return (data as Row[]).map(mapTechSpec);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('technical_specs').insert(payload).select().single();
      if (error) throw error;
      return mapTechSpec(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('technical_specs').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapTechSpec(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('technical_specs').delete().eq('id', id);
      if (error) throw error;
    },
  };

  commercialOffers: CommercialOfferRepository = {
    getAll: async () => {
      const { data, error } = await client.from('commercial_offers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapOffer);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('commercial_offers').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapOffer);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('commercial_offers').insert(payload).select().single();
      if (error) throw error;
      return mapOffer(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('commercial_offers').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapOffer(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('commercial_offers').delete().eq('id', id);
      if (error) throw error;
    },
  };

  certifications: CertificationRepository = {
    getAll: async () => {
      const { data, error } = await client.from('certifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapCert);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('certifications').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapCert);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('certifications').insert(payload).select().single();
      if (error) throw error;
      return mapCert(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('certifications').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapCert(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('certifications').delete().eq('id', id);
      if (error) throw error;
    },
  };

  documents: DocumentRepository = {
    getAll: async () => {
      const { data, error } = await client.from('documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapDoc);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('documents').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapDoc);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('documents').insert(payload).select().single();
      if (error) throw error;
      return mapDoc(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('documents').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapDoc(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
  };

  dueDiligence: DueDiligenceRepository = {
    getAll: async () => {
      const { data, error } = await client.from('due_diligence').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapDD);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('due_diligence').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapDD);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('due_diligence').insert(payload).select().single();
      if (error) throw error;
      return mapDD(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('due_diligence').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapDD(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('due_diligence').delete().eq('id', id);
      if (error) throw error;
    },
  };

  logistics: LogisticsRepository = {
    getAll: async () => {
      const { data, error } = await client.from('logistics').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapLogistics);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('logistics').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapLogistics);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('logistics').insert(payload).select().single();
      if (error) throw error;
      return mapLogistics(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('logistics').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapLogistics(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('logistics').delete().eq('id', id);
      if (error) throw error;
    },
  };

  timeline: TimelineRepository = {
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('timeline_events').select('*').eq('supplier_id', supplierId).order('event_date', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapTimeline);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('timeline_events').insert(payload).select().single();
      if (error) throw error;
      return mapTimeline(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('timeline_events').delete().eq('id', id);
      if (error) throw error;
    },
  };

  followUps: FollowUpRepository = {
    getAll: async () => {
      const { data, error } = await client.from('follow_ups').select('*').order('due_date', { ascending: true });
      if (error) throw error;
      return (data as Row[]).map(mapFollowUp);
    },
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('follow_ups').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapFollowUp);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('follow_ups').insert(payload).select().single();
      if (error) throw error;
      return mapFollowUp(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at', 'updated_at']);
      const { data: row, error } = await client.from('follow_ups').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapFollowUp(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('follow_ups').delete().eq('id', id);
      if (error) throw error;
    },
  };

  redFlags: RedFlagRepository = {
    getBySupplier: async (supplierId: string) => {
      const { data, error } = await client.from('red_flags').select('*').eq('supplier_id', supplierId);
      if (error) throw error;
      return (data as Row[]).map(mapRedFlag);
    },
    create: async (data) => {
      const payload = strip(data as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('red_flags').insert(payload).select().single();
      if (error) throw error;
      return mapRedFlag(row as Row);
    },
    update: async (id: string, updates) => {
      const payload = strip(updates as unknown as Record<string, unknown>, ['id', 'created_at']);
      const { data: row, error } = await client.from('red_flags').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return mapRedFlag(row as Row);
    },
    remove: async (id: string) => {
      const { error } = await client.from('red_flags').delete().eq('id', id);
      if (error) throw error;
    },
  };

  intelligenceFacts: IntelligenceFactRepository = {
    getByEntity: async (entityType: string, entityId: string) => {
      const { data, error } = await client.from('intelligence_facts').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('fact_date', { ascending: false });
      if (error) throw error;
      return (data as Row[]).map(mapIntelligenceFact);
    },
  };

  getAll = async (): Promise<AppData> => {
    const [suppliers, contacts, products, technical_specs, commercial_offers, certifications, documents, due_diligence, logistics, timeline, follow_ups, red_flags] = await Promise.all([
      this.suppliers.getAll(),
      this.contacts.getAll(),
      this.products.getAll(),
      client.from('technical_specs').select('*').then(r => r.data ? (r.data as Row[]).map(mapTechSpec) : []),
      this.commercialOffers.getAll(),
      this.certifications.getAll(),
      this.documents.getAll(),
      this.dueDiligence.getAll(),
      this.logistics.getAll(),
      client.from('timeline_events').select('*').then(r => r.data ? (r.data as Row[]).map(mapTimeline) : []),
      this.followUps.getAll(),
      client.from('red_flags').select('*').then(r => r.data ? (r.data as Row[]).map(mapRedFlag) : []),
    ]);
    return { suppliers, contacts, products, technical_specs, commercial_offers, certifications, documents, due_diligence, logistics, timeline, follow_ups, red_flags };
  };
}
