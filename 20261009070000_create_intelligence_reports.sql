-- Intelligence Reports library. Metadata and authorized source links only.
create table if not exists public.intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null default '',
  report_date date not null default current_date,
  sectors text[] not null default '{}'::text[],
  commodities text[] not null default '{}'::text[],
  region text not null default '',
  period_label text not null default '',
  summary text not null default '',
  key_findings text not null default '',
  source_url text not null default '',
  source_kind text not null default 'authorized_link',
  access_note text not null default '',
  created_by text not null default 'Astra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_reports_title_nonempty check (length(trim(title)) > 0),
  constraint intelligence_reports_source_kind_check check (source_kind in ('authorized_link','public_pdf','internal_link'))
);
create index if not exists intelligence_reports_report_date_idx on public.intelligence_reports (report_date desc);
create index if not exists intelligence_reports_publisher_idx on public.intelligence_reports (publisher);
create index if not exists intelligence_reports_sectors_idx on public.intelligence_reports using gin (sectors);
alter table public.intelligence_reports enable row level security;
drop policy if exists intelligence_reports_public_access on public.intelligence_reports;
create policy intelligence_reports_public_access on public.intelligence_reports
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.intelligence_reports to anon, authenticated;
