-- Astra Oil & Gas — add Mining Commodities procurement universe
-- Safe seed: creates the domain only if it does not already exist.
INSERT INTO public.procurement_domains (name)
SELECT 'Mining Commodities'
WHERE NOT EXISTS (
  SELECT 1 FROM public.procurement_domains WHERE name = 'Mining Commodities'
);
