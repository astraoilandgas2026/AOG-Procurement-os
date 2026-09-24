/*
# Procurement Intelligence OS — Full Schema

Creates the complete database schema for Astra Oil and Gas procurement intelligence.

1. Enum Types (15): verification_status, supplier_lifecycle, dd_status, dd_category,
   feedstock_type, priority_level, follow_up_status, transport_mode, container_type,
   document_type, timeline_event_type, cert_status, red_flag_status, incoterm_type

2. Tables (12): suppliers, contacts, products, technical_specs, commercial_offers,
   certifications, due_diligence, documents, logistics, timeline_events, follow_ups, red_flags

3. Relationships: All child tables FK to suppliers.id ON DELETE CASCADE.
   technical_specs FK to products.id ON DELETE CASCADE.
   commercial_offers optional FK to products.id.
   documents optional FK to products.id and due_diligence.id.

4. Security: RLS on all 12 tables, 4 policies each (48 total), TO anon, authenticated.

5. Triggers: updated_at auto-update on 6 tables.
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('claimed', 'documented', 'independently_verified', 'physically_verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE supplier_lifecycle AS ENUM ('prospect', 'active', 'dd_pending', 'qualified', 'trial', 'recurring', 'paused', 'rejected', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dd_status AS ENUM ('pending', 'claimed', 'documented', 'independently_verified', 'physically_verified', 'rejected', 'not_applicable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dd_category AS ENUM ('legal', 'operational', 'product', 'export', 'commercial_risk', 'compliance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE feedstock_type AS ENUM ('uco', 'vegetable_oil', 'degummed_oil', 'off_spec_oil', 'oleins', 'fatty_acids', 'acid_oils', 'soapstock', 'industrial_returns', 'oilseed_residues', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE follow_up_status AS ENUM ('open', 'in_progress', 'completed', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transport_mode AS ENUM ('road', 'rail', 'sea', 'multimodal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE container_type AS ENUM ('flexitank', 'iso_tank', 'dry_container', 'bulk', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_type AS ENUM ('cnpj_rut', 'coa', 'sgs', 'tds', 'sds_fds', 'iscc', 'license', 'photograph', 'video', 'bill_of_lading', 'inspection_report', 'visit_report', 'contract', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE timeline_event_type AS ENUM ('call', 'email', 'meeting', 'visit', 'offer_received', 'offer_revised', 'sample_requested', 'sample_received', 'document_received', 'dd_update', 'logistics_update', 'note', 'status_change'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cert_status AS ENUM ('active', 'expired', 'pending', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE red_flag_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incoterm_type AS ENUM ('EXW', 'FCA', 'FOB', 'FAS', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';

-- ============================================================
-- TABLES (order: due_diligence before documents for FK)
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT '', trading_name text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '', cnae text NOT NULL DEFAULT '', administrator text NOT NULL DEFAULT '',
  legal_status text NOT NULL DEFAULT '', facility text NOT NULL DEFAULT '', operation_status text NOT NULL DEFAULT '',
  theoretical_capacity text NOT NULL DEFAULT '', real_production text NOT NULL DEFAULT '',
  available_volume text NOT NULL DEFAULT '', volume_to_astra text NOT NULL DEFAULT '',
  trial_volume text NOT NULL DEFAULT '', recurring_volume text NOT NULL DEFAULT '',
  infrastructure text NOT NULL DEFAULT '', lifecycle supplier_lifecycle NOT NULL DEFAULT 'prospect',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '', title text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '', whatsapp text NOT NULL DEFAULT '', is_primary boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '', feedstock_type feedstock_type NOT NULL DEFAULT 'other',
  origin text NOT NULL DEFAULT '', composition text NOT NULL DEFAULT '',
  available_volume text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT 'MT',
  verification_status verification_status NOT NULL DEFAULT 'claimed',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technical_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  parameter text NOT NULL DEFAULT '', value text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '', verification_status verification_status NOT NULL DEFAULT 'claimed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commercial_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  price text NOT NULL DEFAULT '', currency text NOT NULL DEFAULT 'USD', price_basis text NOT NULL DEFAULT '',
  incoterm incoterm_type NOT NULL DEFAULT 'FOB', loading_point text NOT NULL DEFAULT '', port text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '', payment_terms text NOT NULL DEFAULT '',
  offered_volume text NOT NULL DEFAULT '', trial_quantity text NOT NULL DEFAULT '',
  recurring_quantity text NOT NULL DEFAULT '', certification_premium text NOT NULL DEFAULT '',
  commercial_validity text NOT NULL DEFAULT '', verification_status verification_status NOT NULL DEFAULT 'claimed',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  cert_type text NOT NULL DEFAULT '', cert_number text NOT NULL DEFAULT '',
  status cert_status NOT NULL DEFAULT 'pending', issue_date text NOT NULL DEFAULT '',
  expiration_date text NOT NULL DEFAULT '', issuing_body text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS due_diligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category dd_category NOT NULL DEFAULT 'legal', status dd_status NOT NULL DEFAULT 'pending',
  findings text NOT NULL DEFAULT '', evidence_ref text NOT NULL DEFAULT '',
  reviewer text NOT NULL DEFAULT '', review_date text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  dd_item_id uuid REFERENCES due_diligence(id) ON DELETE SET NULL,
  doc_type document_type NOT NULL DEFAULT 'other', title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '', file_name text NOT NULL DEFAULT '', file_url text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '', verification_status verification_status NOT NULL DEFAULT 'claimed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  origin_location text NOT NULL DEFAULT '', loading_location text NOT NULL DEFAULT '', port text NOT NULL DEFAULT '',
  transport_mode transport_mode NOT NULL DEFAULT 'sea', container_type container_type NOT NULL DEFAULT 'flexitank',
  estimated_shipment_size text NOT NULL DEFAULT '', lead_time text NOT NULL DEFAULT '',
  export_readiness verification_status NOT NULL DEFAULT 'claimed', notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  event_type timeline_event_type NOT NULL DEFAULT 'note', title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '', actor text NOT NULL DEFAULT '', event_date text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  responsible_person text NOT NULL DEFAULT '', due_date text NOT NULL DEFAULT '',
  priority priority_level NOT NULL DEFAULT 'medium', status follow_up_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS red_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  flag_type text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '', source text NOT NULL DEFAULT '', reviewer text NOT NULL DEFAULT '',
  flag_date text NOT NULL DEFAULT '', status red_flag_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contacts_supplier ON contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_tech_specs_product ON technical_specs(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier ON commercial_offers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_certs_supplier ON certifications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_docs_supplier ON documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_dd_supplier ON due_diligence(supplier_id);
CREATE INDEX IF NOT EXISTS idx_logistics_supplier ON logistics(supplier_id);
CREATE INDEX IF NOT EXISTS idx_timeline_supplier ON timeline_events(supplier_id);
CREATE INDEX IF NOT EXISTS idx_followups_supplier ON follow_ups(supplier_id);
CREATE INDEX IF NOT EXISTS idx_redflags_supplier ON red_flags(supplier_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_suppliers_updated ON suppliers;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_offers_updated ON commercial_offers;
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON commercial_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_dd_updated ON due_diligence;
CREATE TRIGGER trg_dd_updated BEFORE UPDATE ON due_diligence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_logistics_updated ON logistics;
CREATE TRIGGER trg_logistics_updated BEFORE UPDATE ON logistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_followups_updated ON follow_ups;
CREATE TRIGGER trg_followups_updated BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS ENABLE
-- ============================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_diligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_flags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (48 total, 4 per table)
-- ============================================================

-- suppliers
DROP POLICY IF EXISTS "anon_select_suppliers" ON suppliers; CREATE POLICY "anon_select_suppliers" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_suppliers" ON suppliers; CREATE POLICY "anon_insert_suppliers" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_suppliers" ON suppliers; CREATE POLICY "anon_update_suppliers" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_suppliers" ON suppliers; CREATE POLICY "anon_delete_suppliers" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- contacts
DROP POLICY IF EXISTS "anon_select_contacts" ON contacts; CREATE POLICY "anon_select_contacts" ON contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contacts" ON contacts; CREATE POLICY "anon_insert_contacts" ON contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contacts" ON contacts; CREATE POLICY "anon_update_contacts" ON contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contacts" ON contacts; CREATE POLICY "anon_delete_contacts" ON contacts FOR DELETE TO anon, authenticated USING (true);

-- products
DROP POLICY IF EXISTS "anon_select_products" ON products; CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products; CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products; CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products; CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- technical_specs
DROP POLICY IF EXISTS "anon_select_technical_specs" ON technical_specs; CREATE POLICY "anon_select_technical_specs" ON technical_specs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_technical_specs" ON technical_specs; CREATE POLICY "anon_insert_technical_specs" ON technical_specs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_technical_specs" ON technical_specs; CREATE POLICY "anon_update_technical_specs" ON technical_specs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_technical_specs" ON technical_specs; CREATE POLICY "anon_delete_technical_specs" ON technical_specs FOR DELETE TO anon, authenticated USING (true);

-- commercial_offers
DROP POLICY IF EXISTS "anon_select_offers" ON commercial_offers; CREATE POLICY "anon_select_offers" ON commercial_offers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_offers" ON commercial_offers; CREATE POLICY "anon_insert_offers" ON commercial_offers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_offers" ON commercial_offers; CREATE POLICY "anon_update_offers" ON commercial_offers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_offers" ON commercial_offers; CREATE POLICY "anon_delete_offers" ON commercial_offers FOR DELETE TO anon, authenticated USING (true);

-- certifications
DROP POLICY IF EXISTS "anon_select_certs" ON certifications; CREATE POLICY "anon_select_certs" ON certifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_certs" ON certifications; CREATE POLICY "anon_insert_certs" ON certifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_certs" ON certifications; CREATE POLICY "anon_update_certs" ON certifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_certs" ON certifications; CREATE POLICY "anon_delete_certs" ON certifications FOR DELETE TO anon, authenticated USING (true);

-- documents
DROP POLICY IF EXISTS "anon_select_documents" ON documents; CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents; CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents; CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents; CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated USING (true);

-- due_diligence
DROP POLICY IF EXISTS "anon_select_dd" ON due_diligence; CREATE POLICY "anon_select_dd" ON due_diligence FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dd" ON due_diligence; CREATE POLICY "anon_insert_dd" ON due_diligence FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dd" ON due_diligence; CREATE POLICY "anon_update_dd" ON due_diligence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dd" ON due_diligence; CREATE POLICY "anon_delete_dd" ON due_diligence FOR DELETE TO anon, authenticated USING (true);

-- logistics
DROP POLICY IF EXISTS "anon_select_logistics" ON logistics; CREATE POLICY "anon_select_logistics" ON logistics FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_logistics" ON logistics; CREATE POLICY "anon_insert_logistics" ON logistics FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_logistics" ON logistics; CREATE POLICY "anon_update_logistics" ON logistics FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_logistics" ON logistics; CREATE POLICY "anon_delete_logistics" ON logistics FOR DELETE TO anon, authenticated USING (true);

-- timeline_events
DROP POLICY IF EXISTS "anon_select_timeline" ON timeline_events; CREATE POLICY "anon_select_timeline" ON timeline_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_timeline" ON timeline_events; CREATE POLICY "anon_insert_timeline" ON timeline_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_timeline" ON timeline_events; CREATE POLICY "anon_update_timeline" ON timeline_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_timeline" ON timeline_events; CREATE POLICY "anon_delete_timeline" ON timeline_events FOR DELETE TO anon, authenticated USING (true);

-- follow_ups
DROP POLICY IF EXISTS "anon_select_followups" ON follow_ups; CREATE POLICY "anon_select_followups" ON follow_ups FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_followups" ON follow_ups; CREATE POLICY "anon_insert_followups" ON follow_ups FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_followups" ON follow_ups; CREATE POLICY "anon_update_followups" ON follow_ups FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_followups" ON follow_ups; CREATE POLICY "anon_delete_followups" ON follow_ups FOR DELETE TO anon, authenticated USING (true);

-- red_flags
DROP POLICY IF EXISTS "anon_select_redflags" ON red_flags; CREATE POLICY "anon_select_redflags" ON red_flags FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_redflags" ON red_flags; CREATE POLICY "anon_insert_redflags" ON red_flags FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_redflags" ON red_flags; CREATE POLICY "anon_update_redflags" ON red_flags FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_redflags" ON red_flags; CREATE POLICY "anon_delete_redflags" ON red_flags FOR DELETE TO anon, authenticated USING (true);