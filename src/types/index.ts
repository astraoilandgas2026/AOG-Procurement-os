// ============================================================
// ASTRA OIL AND GAS — PROCUREMENT INTELLIGENCE OS
// Domain Types & Interfaces
// ============================================================

export type ProcurementDomain = 'feedstock' | 'energy_commodities' | 'mining_commodities';

// --- Verification Model ---

export type VerificationStatus =
  | 'claimed'
  | 'documented'
  | 'independently_verified'
  | 'physically_verified';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  claimed: 'Declarado',
  documented: 'Documentado',
  independently_verified: 'Verificado independientemente',
  physically_verified: 'Verificado físicamente',
};

export const VERIFICATION_ORDER: VerificationStatus[] = [
  'claimed',
  'documented',
  'independently_verified',
  'physically_verified',
];

// --- Supplier Lifecycle ---

export type SupplierLifecycle =
  | 'prospect'
  | 'active'
  | 'dd_pending'
  | 'qualified'
  | 'trial'
  | 'recurring'
  | 'paused'
  | 'rejected'
  | 'archived';

export const LIFECYCLE_LABELS: Record<SupplierLifecycle, string> = {
  prospect: 'Prospecto',
  active: 'Activo',
  dd_pending: 'DD pendiente',
  qualified: 'Calificado',
  trial: 'Prueba',
  recurring: 'Recurrente',
  paused: 'Pausado',
  rejected: 'Rechazado',
  archived: 'Archivado',
};

// --- Due Diligence ---

export type DDStatus =
  | 'pending'
  | 'claimed'
  | 'documented'
  | 'independently_verified'
  | 'physically_verified'
  | 'rejected'
  | 'not_applicable';

export const DD_STATUS_LABELS: Record<DDStatus, string> = {
  pending: 'Pendiente',
  claimed: 'Declarado',
  documented: 'Documentado',
  independently_verified: 'Verificado independientemente',
  physically_verified: 'Verificado físicamente',
  rejected: 'Rechazado',
  not_applicable: 'No aplica',
};

export type DDCategory =
  | 'legal'
  | 'operational'
  | 'product'
  | 'export'
  | 'commercial_risk'
  | 'compliance';

export const DD_CATEGORY_LABELS: Record<DDCategory, string> = {
  legal: 'Existencia legal',
  operational: 'Operación / capacidad',
  product: 'Producto / calidad',
  export: 'Historial exportador',
  commercial_risk: 'Riesgo comercial',
  compliance: 'Cumplimiento',
};

// --- Feedstock Types ---

export type FeedstockType =
  | 'uco'
  | 'vegetable_oil'
  | 'degummed_oil'
  | 'off_spec_oil'
  | 'oleins'
  | 'fatty_acids'
  | 'acid_oils'
  | 'soapstock'
  | 'industrial_returns'
  | 'oilseed_residues'
  | 'other';

export const FEEDSTOCK_LABELS: Record<FeedstockType, string> = {
  uco: 'UCO / AVU',
  vegetable_oil: 'Aceite vegetal',
  degummed_oil: 'Aceite desgomado',
  off_spec_oil: 'Aceite fuera de especificación',
  oleins: 'Oleínas',
  fatty_acids: 'Ácidos grasos',
  acid_oils: 'Aceites ácidos',
  soapstock: 'Borra',
  industrial_returns: 'Retornos industriales',
  oilseed_residues: 'Residuos de procesamiento oleaginoso',
  other: 'Otro',
};

// --- Priority ---

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

// --- Follow-up Status ---

export type FollowUpStatus = 'open' | 'in_progress' | 'completed' | 'overdue';

export const FOLLOWUP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  open: 'Abierto',
  in_progress: 'En curso',
  completed: 'Completado',
  overdue: 'Vencido',
};

// --- Incoterms ---

export type Incoterm =
  | 'EXW'
  | 'FCA'
  | 'FOB'
  | 'FAS'
  | 'CFR'
  | 'CIF'
  | 'CPT'
  | 'CIP'
  | 'DAP'
  | 'DPU'
  | 'DDP';

// --- Transport Mode ---

export type TransportMode = 'road' | 'rail' | 'sea' | 'multimodal';

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  road: 'Carretera',
  rail: 'Ferrocarril',
  sea: 'Marítimo',
  multimodal: 'Multimodal',
};

// --- Container Type ---

export type ContainerType = 'flexitank' | 'iso_tank' | 'dry_container' | 'bulk' | 'other';

export const CONTAINER_TYPE_LABELS: Record<ContainerType, string> = {
  flexitank: 'Flexitank',
  iso_tank: 'Tanque ISO',
  dry_container: 'Contenedor seco',
  bulk: 'Granel',
  other: 'Otro',
};

// --- Document Type ---

export type DocumentType =
  | 'cnpj_rut'
  | 'coa'
  | 'sgs'
  | 'tds'
  | 'sds_fds'
  | 'iscc'
  | 'license'
  | 'photograph'
  | 'video'
  | 'bill_of_lading'
  | 'inspection_report'
  | 'visit_report'
  | 'contract'
  | 'other';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cnpj_rut: 'CNPJ / RUT',
  coa: 'COA',
  sgs: 'Informe SGS',
  tds: 'TDS',
  sds_fds: 'SDS / FDS',
  iscc: 'Certificado ISCC',
  license: 'Licencia',
  photograph: 'Fotografía',
  video: 'Video',
  bill_of_lading: 'Conocimiento de embarque',
  inspection_report: 'Informe de inspección',
  visit_report: 'Informe de visita',
  contract: 'Contrato',
  other: 'Otro',
};

// --- Timeline Event Type ---

export type TimelineEventType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'visit'
  | 'offer_received'
  | 'offer_revised'
  | 'sample_requested'
  | 'sample_received'
  | 'document_received'
  | 'dd_update'
  | 'logistics_update'
  | 'note'
  | 'status_change';

export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  call: 'Llamada',
  email: 'Correo',
  meeting: 'Reunión',
  visit: 'Visita a planta',
  offer_received: 'Oferta recibida',
  offer_revised: 'Oferta revisada',
  sample_requested: 'Muestra solicitada',
  sample_received: 'Muestra recibida',
  document_received: 'Documento recibido',
  dd_update: 'Actualización de DD',
  logistics_update: 'Actualización logística',
  note: 'Nota',
  status_change: 'Cambio de estado',
};

// ============================================================
// Core Entities
// ============================================================

export interface Supplier {
  id: string;
  domain_id?: string;
  // Identity
  legal_name: string;
  trading_name: string;
  country: string;
  city: string;
  address: string;
  tax_id: string;
  cnae: string;
  administrator: string;
  legal_status: string;
  // Operation
  facility: string;
  operation_status: string;
  theoretical_capacity: string;
  real_production: string;
  available_volume: string;
  volume_to_astra: string;
  trial_volume: string;
  recurring_volume: string;
  infrastructure: string;
  // Lifecycle
  lifecycle: SupplierLifecycle;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  supplier_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  whatsapp: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
}

export interface Product {
  id: string;
  domain_id?: string;
  supplier_id: string;
  name: string;
  feedstock_type: FeedstockType;
  commodity_category?: string;
  origin: string;
  composition: string;
  available_volume: string;
  unit: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface TechnicalSpec {
  id: string;
  product_id: string;
  parameter: string;
  value: string;
  unit: string;
  method: string;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface CommercialOffer {
  id: string;
  domain_id?: string;
  supplier_id: string;
  product_id: string;
  price: string;
  currency: string;
  price_basis: string;
  incoterm: Incoterm;
  loading_point: string;
  port: string;
  destination: string;
  payment_terms: string;
  offered_volume: string;
  trial_quantity: string;
  recurring_quantity: string;
  certification_premium: string;
  commercial_validity: string;
  verification_status: VerificationStatus;
  price_unit: string;
  price_date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  supplier_id: string;
  cert_type: string;
  cert_number: string;
  status: 'active' | 'expired' | 'pending' | 'revoked';
  issue_date: string;
  expiration_date: string;
  issuing_body: string;
  notes: string;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  supplier_id: string;
  product_id: string | null;
  dd_item_id: string | null;
  doc_type: DocumentType;
  title: string;
  description: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface DueDiligenceItem {
  id: string;
  supplier_id: string;
  category: DDCategory;
  status: DDStatus;
  findings: string;
  evidence_ref: string;
  reviewer: string;
  review_date: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsInfo {
  id: string;
  supplier_id: string;
  origin_location: string;
  loading_location: string;
  port: string;
  transport_mode: TransportMode;
  container_type: ContainerType;
  estimated_shipment_size: string;
  lead_time: string;
  export_readiness: VerificationStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  supplier_id: string;
  event_type: TimelineEventType;
  title: string;
  description: string;
  actor: string;
  event_date: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  supplier_id: string;
  title: string;
  description: string;
  responsible_person: string;
  due_date: string;
  priority: Priority;
  status: FollowUpStatus;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceFact {
  id: string;
  domain_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  value_text: string;
  unit: string;
  fact_date: string | null;
  source_type: string;
  source_ref: string;
  verification_status: VerificationStatus;
  is_contradiction: boolean;
  contradiction_key: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RedFlag {
  id: string;
  supplier_id: string;
  flag_type: string;
  description: string;
  evidence: string;
  source: string;
  reviewer: string;
  flag_date: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  created_at: string;
}

// ============================================================
// Data Collections
// ============================================================

export interface AppData {
  suppliers: Supplier[];
  contacts: Contact[];
  products: Product[];
  technical_specs: TechnicalSpec[];
  commercial_offers: CommercialOffer[];
  certifications: Certification[];
  documents: DocumentRecord[];
  due_diligence: DueDiligenceItem[];
  logistics: LogisticsInfo[];
  timeline: TimelineEvent[];
  follow_ups: FollowUp[];
  red_flags: RedFlag[];
}

export type PageKey =
  | 'dashboard'
  | 'suppliers'
  | 'contacts'
  | 'products'

  | 'commercial'
  | 'certifications'
  | 'documents'
  | 'due_diligence'
  | 'logistics'
  | 'timeline'
  | 'follow_ups'
  | 'intelligence';
