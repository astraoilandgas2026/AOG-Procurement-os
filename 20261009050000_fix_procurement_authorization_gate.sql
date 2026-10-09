-- Keep authorization checks callable from the browser without exposing authorization rows.
-- The function only returns whether the caller's own auth.uid() is active.
grant usage on schema app_security to authenticated;

create or replace function public.emma_is_authorized()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select app_security.emma_is_authorized();
$function$;

revoke all on function public.emma_is_authorized() from public, anon;
grant execute on function public.emma_is_authorized() to authenticated;

-- PostgreSQL requires at least one PERMISSIVE policy for rows to be visible.
-- Keep emma_authorization_gate RESTRICTIVE, but make this matching allow-policy
-- PERMISSIVE so authorized Astra sessions can actually access procurement data.
do $fix$
declare
  t text;
  targets text[] := array[
    'astra_documents','certifications','commercial_offers','contacts','documents',
    'due_diligence','emma_graph_edges','emma_graph_nodes','follow_ups',
    'intelligence_facts','jarvis_global_context','logistics','procurement_domains',
    'products','red_flags','suppliers','technical_specs','timeline_events'
  ];
begin
  foreach t in array targets loop
    execute format('drop policy if exists emma_authorized_client on public.%I', t);
    execute format(
      'create policy emma_authorized_client on public.%I as permissive for all to authenticated using (app_security.emma_is_authorized()) with check (app_security.emma_is_authorized())',
      t
    );
  end loop;
end
$fix$;
