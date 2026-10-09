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
