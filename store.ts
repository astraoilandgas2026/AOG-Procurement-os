import type {
  AppData,
  Supplier,
  Contact,
  Product,
  TechnicalSpec,
  CommercialOffer,
  Certification,
  DocumentRecord,
  DueDiligenceItem,
  LogisticsInfo,
  TimelineEvent,
  FollowUp,
  RedFlag,
} from '@/types';

// ============================================================
// DATA ACCESS ABSTRACTION LAYER
// ============================================================
// This module defines the repository interface that the UI
// interacts with. The current implementation is an in-memory
// store. When the Supabase backend is connected, a new
// implementation of this same interface will be created —
// the UI components will not need to change.
// ============================================================

export interface SupplierRepository {
  getAll(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  create(data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier>;
  update(id: string, data: Partial<Supplier>): Promise<Supplier>;
  remove(id: string): Promise<void>;
}

export interface ContactRepository {
  getAll(): Promise<Contact[]>;
  getBySupplier(supplierId: string): Promise<Contact[]>;
  create(data: Omit<Contact, 'id' | 'created_at'>): Promise<Contact>;
  update(id: string, data: Partial<Contact>): Promise<Contact>;
  remove(id: string): Promise<void>;
}

export interface ProductRepository {
  getAll(): Promise<Product[]>;
  getBySupplier(supplierId: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  create(data: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product>;
  update(id: string, data: Partial<Product>): Promise<Product>;
  remove(id: string): Promise<void>;
}

export interface TechnicalSpecRepository {
  getByProduct(productId: string): Promise<TechnicalSpec[]>;
  create(data: Omit<TechnicalSpec, 'id' | 'created_at'>): Promise<TechnicalSpec>;
  update(id: string, data: Partial<TechnicalSpec>): Promise<TechnicalSpec>;
  remove(id: string): Promise<void>;
}

export interface CommercialOfferRepository {
  getAll(): Promise<CommercialOffer[]>;
  getBySupplier(supplierId: string): Promise<CommercialOffer[]>;
  create(data: Omit<CommercialOffer, 'id' | 'created_at' | 'updated_at'>): Promise<CommercialOffer>;
  update(id: string, data: Partial<CommercialOffer>): Promise<CommercialOffer>;
  remove(id: string): Promise<void>;
}

export interface CertificationRepository {
  getAll(): Promise<Certification[]>;
  getBySupplier(supplierId: string): Promise<Certification[]>;
  create(data: Omit<Certification, 'id' | 'created_at'>): Promise<Certification>;
  update(id: string, data: Partial<Certification>): Promise<Certification>;
  remove(id: string): Promise<void>;
}

export interface DocumentRepository {
  getAll(): Promise<DocumentRecord[]>;
  getBySupplier(supplierId: string): Promise<DocumentRecord[]>;
  create(data: Omit<DocumentRecord, 'id' | 'created_at'>): Promise<DocumentRecord>;
  update(id: string, data: Partial<DocumentRecord>): Promise<DocumentRecord>;
  remove(id: string): Promise<void>;
}

export interface DueDiligenceRepository {
  getAll(): Promise<DueDiligenceItem[]>;
  getBySupplier(supplierId: string): Promise<DueDiligenceItem[]>;
  create(data: Omit<DueDiligenceItem, 'id' | 'created_at' | 'updated_at'>): Promise<DueDiligenceItem>;
  update(id: string, data: Partial<DueDiligenceItem>): Promise<DueDiligenceItem>;
  remove(id: string): Promise<void>;
}

export interface LogisticsRepository {
  getAll(): Promise<LogisticsInfo[]>;
  getBySupplier(supplierId: string): Promise<LogisticsInfo[]>;
  create(data: Omit<LogisticsInfo, 'id' | 'created_at' | 'updated_at'>): Promise<LogisticsInfo>;
  update(id: string, data: Partial<LogisticsInfo>): Promise<LogisticsInfo>;
  remove(id: string): Promise<void>;
}

export interface TimelineRepository {
  getBySupplier(supplierId: string): Promise<TimelineEvent[]>;
  create(data: Omit<TimelineEvent, 'id' | 'created_at'>): Promise<TimelineEvent>;
  remove(id: string): Promise<void>;
}

export interface FollowUpRepository {
  getAll(): Promise<FollowUp[]>;
  getBySupplier(supplierId: string): Promise<FollowUp[]>;
  create(data: Omit<FollowUp, 'id' | 'created_at' | 'updated_at'>): Promise<FollowUp>;
  update(id: string, data: Partial<FollowUp>): Promise<FollowUp>;
  remove(id: string): Promise<void>;
}

export interface RedFlagRepository {
  getBySupplier(supplierId: string): Promise<RedFlag[]>;
  create(data: Omit<RedFlag, 'id' | 'created_at'>): Promise<RedFlag>;
  update(id: string, data: Partial<RedFlag>): Promise<RedFlag>;
  remove(id: string): Promise<void>;
}

export interface DataStore {
  suppliers: SupplierRepository;
  contacts: ContactRepository;
  products: ProductRepository;
  technicalSpecs: TechnicalSpecRepository;
  commercialOffers: CommercialOfferRepository;
  certifications: CertificationRepository;
  documents: DocumentRepository;
  dueDiligence: DueDiligenceRepository;
  logistics: LogisticsRepository;
  timeline: TimelineRepository;
  followUps: FollowUpRepository;
  redFlags: RedFlagRepository;
  getAll(): Promise<AppData>;
}

// ============================================================
// In-Memory Implementation
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

class InMemoryStore implements DataStore {
  private data: AppData = {
    suppliers: [],
    contacts: [],
    products: [],
    technical_specs: [],
    commercial_offers: [],
    certifications: [],
    documents: [],
    due_diligence: [],
    logistics: [],
    timeline: [],
    follow_ups: [],
    red_flags: [],
  };

  suppliers: SupplierRepository = {
    getAll: async () => [...this.data.suppliers],
    getById: async (id) => this.data.suppliers.find((s) => s.id === id) ?? null,
    create: async (data) => {
      const supplier: Supplier = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.suppliers.push(supplier);
      return supplier;
    },
    update: async (id, updates) => {
      const idx = this.data.suppliers.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Supplier ${id} not found`);
      this.data.suppliers[idx] = { ...this.data.suppliers[idx], ...updates, updated_at: nowISO() };
      return this.data.suppliers[idx];
    },
    remove: async (id) => {
      this.data.suppliers = this.data.suppliers.filter((s) => s.id !== id);
      this.data.contacts = this.data.contacts.filter((c) => c.supplier_id !== id);
      this.data.products = this.data.products.filter((p) => p.supplier_id !== id);
      this.data.commercial_offers = this.data.commercial_offers.filter((o) => o.supplier_id !== id);
      this.data.certifications = this.data.certifications.filter((c) => c.supplier_id !== id);
      this.data.documents = this.data.documents.filter((d) => d.supplier_id !== id);
      this.data.due_diligence = this.data.due_diligence.filter((d) => d.supplier_id !== id);
      this.data.logistics = this.data.logistics.filter((l) => l.supplier_id !== id);
      this.data.timeline = this.data.timeline.filter((t) => t.supplier_id !== id);
      this.data.follow_ups = this.data.follow_ups.filter((f) => f.supplier_id !== id);
      this.data.red_flags = this.data.red_flags.filter((r) => r.supplier_id !== id);
    },
  };

  contacts: ContactRepository = {
    getAll: async () => [...this.data.contacts],
    getBySupplier: async (supplierId) =>
      this.data.contacts.filter((c) => c.supplier_id === supplierId),
    create: async (data) => {
      const contact: Contact = { ...data, id: generateId(), created_at: nowISO() };
      this.data.contacts.push(contact);
      return contact;
    },
    update: async (id, updates) => {
      const idx = this.data.contacts.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Contact ${id} not found`);
      this.data.contacts[idx] = { ...this.data.contacts[idx], ...updates };
      return this.data.contacts[idx];
    },
    remove: async (id) => {
      this.data.contacts = this.data.contacts.filter((c) => c.id !== id);
    },
  };

  products: ProductRepository = {
    getAll: async () => [...this.data.products],
    getBySupplier: async (supplierId) =>
      this.data.products.filter((p) => p.supplier_id === supplierId),
    getById: async (id) => this.data.products.find((p) => p.id === id) ?? null,
    create: async (data) => {
      const product: Product = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.products.push(product);
      return product;
    },
    update: async (id, updates) => {
      const idx = this.data.products.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`Product ${id} not found`);
      this.data.products[idx] = { ...this.data.products[idx], ...updates, updated_at: nowISO() };
      return this.data.products[idx];
    },
    remove: async (id) => {
      this.data.products = this.data.products.filter((p) => p.id !== id);
      this.data.technical_specs = this.data.technical_specs.filter((t) => t.product_id !== id);
    },
  };

  technicalSpecs: TechnicalSpecRepository = {
    getByProduct: async (productId) =>
      this.data.technical_specs.filter((t) => t.product_id === productId),
    create: async (data) => {
      const spec: TechnicalSpec = { ...data, id: generateId(), created_at: nowISO() };
      this.data.technical_specs.push(spec);
      return spec;
    },
    update: async (id, updates) => {
      const idx = this.data.technical_specs.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error(`TechnicalSpec ${id} not found`);
      this.data.technical_specs[idx] = { ...this.data.technical_specs[idx], ...updates };
      return this.data.technical_specs[idx];
    },
    remove: async (id) => {
      this.data.technical_specs = this.data.technical_specs.filter((t) => t.id !== id);
    },
  };

  commercialOffers: CommercialOfferRepository = {
    getAll: async () => [...this.data.commercial_offers],
    getBySupplier: async (supplierId) =>
      this.data.commercial_offers.filter((o) => o.supplier_id === supplierId),
    create: async (data) => {
      const offer: CommercialOffer = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.commercial_offers.push(offer);
      return offer;
    },
    update: async (id, updates) => {
      const idx = this.data.commercial_offers.findIndex((o) => o.id === id);
      if (idx === -1) throw new Error(`CommercialOffer ${id} not found`);
      this.data.commercial_offers[idx] = {
        ...this.data.commercial_offers[idx],
        ...updates,
        updated_at: nowISO(),
      };
      return this.data.commercial_offers[idx];
    },
    remove: async (id) => {
      this.data.commercial_offers = this.data.commercial_offers.filter((o) => o.id !== id);
    },
  };

  certifications: CertificationRepository = {
    getAll: async () => [...this.data.certifications],
    getBySupplier: async (supplierId) =>
      this.data.certifications.filter((c) => c.supplier_id === supplierId),
    create: async (data) => {
      const cert: Certification = { ...data, id: generateId(), created_at: nowISO() };
      this.data.certifications.push(cert);
      return cert;
    },
    update: async (id, updates) => {
      const idx = this.data.certifications.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Certification ${id} not found`);
      this.data.certifications[idx] = { ...this.data.certifications[idx], ...updates };
      return this.data.certifications[idx];
    },
    remove: async (id) => {
      this.data.certifications = this.data.certifications.filter((c) => c.id !== id);
    },
  };

  documents: DocumentRepository = {
    getAll: async () => [...this.data.documents],
    getBySupplier: async (supplierId) =>
      this.data.documents.filter((d) => d.supplier_id === supplierId),
    create: async (data) => {
      const doc: DocumentRecord = { ...data, id: generateId(), created_at: nowISO() };
      this.data.documents.push(doc);
      return doc;
    },
    update: async (id, updates) => {
      const idx = this.data.documents.findIndex((d) => d.id === id);
      if (idx === -1) throw new Error(`Document ${id} not found`);
      this.data.documents[idx] = { ...this.data.documents[idx], ...updates };
      return this.data.documents[idx];
    },
    remove: async (id) => {
      this.data.documents = this.data.documents.filter((d) => d.id !== id);
    },
  };

  dueDiligence: DueDiligenceRepository = {
    getAll: async () => [...this.data.due_diligence],
    getBySupplier: async (supplierId) =>
      this.data.due_diligence.filter((d) => d.supplier_id === supplierId),
    create: async (data) => {
      const item: DueDiligenceItem = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.due_diligence.push(item);
      return item;
    },
    update: async (id, updates) => {
      const idx = this.data.due_diligence.findIndex((d) => d.id === id);
      if (idx === -1) throw new Error(`DueDiligenceItem ${id} not found`);
      this.data.due_diligence[idx] = {
        ...this.data.due_diligence[idx],
        ...updates,
        updated_at: nowISO(),
      };
      return this.data.due_diligence[idx];
    },
    remove: async (id) => {
      this.data.due_diligence = this.data.due_diligence.filter((d) => d.id !== id);
    },
  };

  logistics: LogisticsRepository = {
    getAll: async () => [...this.data.logistics],
    getBySupplier: async (supplierId) =>
      this.data.logistics.filter((l) => l.supplier_id === supplierId),
    create: async (data) => {
      const info: LogisticsInfo = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.logistics.push(info);
      return info;
    },
    update: async (id, updates) => {
      const idx = this.data.logistics.findIndex((l) => l.id === id);
      if (idx === -1) throw new Error(`LogisticsInfo ${id} not found`);
      this.data.logistics[idx] = { ...this.data.logistics[idx], ...updates, updated_at: nowISO() };
      return this.data.logistics[idx];
    },
    remove: async (id) => {
      this.data.logistics = this.data.logistics.filter((l) => l.id !== id);
    },
  };

  timeline: TimelineRepository = {
    getBySupplier: async (supplierId) =>
      [...this.data.timeline]
        .filter((t) => t.supplier_id === supplierId)
        .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()),
    create: async (data) => {
      const event: TimelineEvent = { ...data, id: generateId(), created_at: nowISO() };
      this.data.timeline.push(event);
      return event;
    },
    remove: async (id) => {
      this.data.timeline = this.data.timeline.filter((t) => t.id !== id);
    },
  };

  followUps: FollowUpRepository = {
    getAll: async () => [...this.data.follow_ups],
    getBySupplier: async (supplierId) =>
      this.data.follow_ups.filter((f) => f.supplier_id === supplierId),
    create: async (data) => {
      const fu: FollowUp = {
        ...data,
        id: generateId(),
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      this.data.follow_ups.push(fu);
      return fu;
    },
    update: async (id, updates) => {
      const idx = this.data.follow_ups.findIndex((f) => f.id === id);
      if (idx === -1) throw new Error(`FollowUp ${id} not found`);
      this.data.follow_ups[idx] = { ...this.data.follow_ups[idx], ...updates, updated_at: nowISO() };
      return this.data.follow_ups[idx];
    },
    remove: async (id) => {
      this.data.follow_ups = this.data.follow_ups.filter((f) => f.id !== id);
    },
  };

  redFlags: RedFlagRepository = {
    getBySupplier: async (supplierId) =>
      this.data.red_flags.filter((r) => r.supplier_id === supplierId),
    create: async (data) => {
      const flag: RedFlag = { ...data, id: generateId(), created_at: nowISO() };
      this.data.red_flags.push(flag);
      return flag;
    },
    update: async (id, updates) => {
      const idx = this.data.red_flags.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`RedFlag ${id} not found`);
      this.data.red_flags[idx] = { ...this.data.red_flags[idx], ...updates };
      return this.data.red_flags[idx];
    },
    remove: async (id) => {
      this.data.red_flags = this.data.red_flags.filter((r) => r.id !== id);
    },
  };

  getAll = async (): Promise<AppData> => ({
    suppliers: [...this.data.suppliers],
    contacts: [...this.data.contacts],
    products: [...this.data.products],
    technical_specs: [...this.data.technical_specs],
    commercial_offers: [...this.data.commercial_offers],
    certifications: [...this.data.certifications],
    documents: [...this.data.documents],
    due_diligence: [...this.data.due_diligence],
    logistics: [...this.data.logistics],
    timeline: [...this.data.timeline],
    follow_ups: [...this.data.follow_ups],
    red_flags: [...this.data.red_flags],
  });
}

// ============================================================
// Singleton — uses Supabase when configured, falls back to in-memory.
// ============================================================

import { isSupabaseConfigured } from '@/data/supabase-client';
import { SupabaseStore } from '@/data/supabase-store';

let store: DataStore | null = null;

export function getStore(): DataStore {
  if (!store) {
    if (isSupabaseConfigured()) {
      store = new SupabaseStore();
    } else {
      store = new InMemoryStore();
    }
  }
  return store;
}

export function setStore(newStore: DataStore): void {
  store = newStore;
}
