-- Astra Oil & Gas — public application access
-- The Procurement Intelligence OS is intentionally accessible without application login.
-- RLS remains enabled; anon is granted CRUD on the operational procurement tables.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'procurement_domains','suppliers','contacts','products','technical_specs',
    'commercial_offers','certifications','documents','due_diligence','logistics',
    'timeline_events','follow_ups','red_flags','intelligence_facts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_anon_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY public_anon_all ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS public_anon_documents_all ON storage.objects;

CREATE POLICY public_anon_documents_all
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');
