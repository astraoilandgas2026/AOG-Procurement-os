import type { AppData, Supplier, Contact, Product, TechnicalSpec, CommercialOffer, Certification, DocumentRecord, DueDiligenceItem, LogisticsInfo, TimelineEvent, FollowUp, RedFlag } from '@/types';

export interface SupplierRepository { getAll(): Promise<Supplier[]>; getById(id:string):Promise<Supplier|null>; getByDomain(domainId:string):Promise<Supplier[]>; getByDomainKey(domainKey:'feedstock'|'energy_commodities'):Promise<Supplier[]>; createForDomain(domainKey:'feedstock'|'energy_commodities', data:Omit<Supplier,'id'|'created_at'|'updated_at'>):Promise<Supplier>; create(data:Omit<Supplier,'id'|'created_at'|'updated_at'>):Promise<Supplier>; update(id:string,data:Partial<Supplier>):Promise<Supplier>; remove(id:string):Promise<void>; }
export interface ContactRepository { getAll():Promise<Contact[]>; getByDomainKey(domainKey:'feedstock'|'energy_commodities'):Promise<Contact[]>; getBySupplier(supplierId:string):Promise<Contact[]>; create(data:Omit<Contact,'id'|'created_at'>):Promise<Contact>; update(id:string,data:Partial<Contact>):Promise<Contact>; remove(id:string):Promise<void>; }
export interface ProductRepository { getAll():Promise<Product[]>; getByDomainKey(domainKey:'feedstock'|'energy_commodities'):Promise<Product[]>; getBySupplier(supplierId:string):Promise<Product[]>; getById(id:string):Promise<Product|null>; create(data:Omit<Product,'id'|'created_at'|'updated_at'>):Promise<Product>; update(id:string,data:Partial<Product>):Promise<Product>; remove(id:string):Promise<void>; }
export interface TechnicalSpecRepository { getByProduct(productId:string):Promise<TechnicalSpec[]>; create(data:Omit<TechnicalSpec,'id'|'created_at'>):Promise<TechnicalSpec>; update(id:string,data:Partial<TechnicalSpec>):Promise<TechnicalSpec>; remove(id:string):Promise<void>; }
export interface CommercialOfferRepository { getAll():Promise<CommercialOffer[]>; getBySupplier(supplierId:string):Promise<CommercialOffer[]>; create(data:Omit<CommercialOffer,'id'|'created_at'|'updated_at'>):Promise<CommercialOffer>; update(id:string,data:Partial<CommercialOffer>):Promise<CommercialOffer>; remove(id:string):Promise<void>; }
export interface CertificationRepository { getAll():Promise<Certification[]>; getBySupplier(supplierId:string):Promise<Certification[]>; create(data:Omit<Certification,'id'|'created_at'>):Promise<Certification>; update(id:string,data:Partial<Certification>):Promise<Certification>; remove(id:string):Promise<void>; }
export interface DocumentRepository { getAll():Promise<DocumentRecord[]>; getBySupplier(supplierId:string):Promise<DocumentRecord[]>; create(data:Omit<DocumentRecord,'id'|'created_at'>):Promise<DocumentRecord>; update(id:string,data:Partial<DocumentRecord>):Promise<DocumentRecord>; remove(id:string):Promise<void>; }
export interface DueDiligenceRepository { getAll():Promise<DueDiligenceItem[]>; getBySupplier(supplierId:string):Promise<DueDiligenceItem[]>; create(data:Omit<DueDiligenceItem,'id'|'created_at'|'updated_at'>):Promise<DueDiligenceItem>; update(id:string,data:Partial<DueDiligenceItem>):Promise<DueDiligenceItem>; remove(id:string):Promise<void>; }
export interface LogisticsRepository { getAll():Promise<LogisticsInfo[]>; getBySupplier(supplierId:string):Promise<LogisticsInfo[]>; create(data:Omit<LogisticsInfo,'id'|'created_at'|'updated_at'>):Promise<LogisticsInfo>; update(id:string,data:Partial<LogisticsInfo>):Promise<LogisticsInfo>; remove(id:string):Promise<void>; }
export interface TimelineRepository { getBySupplier(supplierId:string):Promise<TimelineEvent[]>; create(data:Omit<TimelineEvent,'id'|'created_at'>):Promise<TimelineEvent>; remove(id:string):Promise<void>; }
export interface FollowUpRepository { getAll():Promise<FollowUp[]>; getBySupplier(supplierId:string):Promise<FollowUp[]>; create(data:Omit<FollowUp,'id'|'created_at'|'updated_at'>):Promise<FollowUp>; update(id:string,data:Partial<FollowUp>):Promise<FollowUp>; remove(id:string):Promise<void>; }
export interface RedFlagRepository { getBySupplier(supplierId:string):Promise<RedFlag[]>; create(data:Omit<RedFlag,'id'|'created_at'>):Promise<RedFlag>; update(id:string,data:Partial<RedFlag>):Promise<RedFlag>; remove(id:string):Promise<void>; }
export interface DataStore { suppliers:SupplierRepository; contacts:ContactRepository; products:ProductRepository; technicalSpecs:TechnicalSpecRepository; commercialOffers:CommercialOfferRepository; certifications:CertificationRepository; documents:DocumentRepository; dueDiligence:DueDiligenceRepository; logistics:LogisticsRepository; timeline:TimelineRepository; followUps:FollowUpRepository; redFlags:RedFlagRepository; getAll():Promise<AppData>; }

import { isSupabaseConfigured } from '@/data/supabase-client';
import { SupabaseStore } from '@/data/supabase-store';

let store: DataStore | null = null;
export function getStore(): DataStore {
  if (!store) {
    if (!isSupabaseConfigured()) throw new Error('Supabase is not configured. Production builds must provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    store = new SupabaseStore();
  }
  return store;
}
export function setStore(newStore: DataStore): void { store = newStore; }
