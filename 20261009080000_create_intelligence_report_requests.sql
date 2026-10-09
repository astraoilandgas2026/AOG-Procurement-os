create table if not exists public.intelligence_report_requests (
  id uuid primary key default gen_random_uuid(),
  sector text not null check (sector in ('feedstock','energy_commodities','mining_commodities','fertilizers_chemicals','agricultural_commodities')),
  topic text not null check (length(trim(topic)) between 2 and 180),
  report_type text not null default 'weekly' check (report_type in ('daily','weekly','monthly','one_off')),
  preferred_source text not null default 'No preference',
  desired_period text not null default '',
  requested_by text not null check (length(trim(requested_by)) between 2 and 100),
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','in_progress','delivered','declined')),
  ip_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intelligence_report_requests_created_at_idx on public.intelligence_report_requests (created_at desc);
create index if not exists intelligence_report_requests_ip_created_idx on public.intelligence_report_requests (ip_hash, created_at desc);
alter table public.intelligence_report_requests enable row level security;
revoke all on public.intelligence_report_requests from anon, authenticated;
grant all on public.intelligence_report_requests to service_role;