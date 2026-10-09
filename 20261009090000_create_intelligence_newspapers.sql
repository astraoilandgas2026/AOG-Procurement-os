-- Astra Procurement Intelligence OS: newspaper and daily press library
create table if not exists public.intelligence_newspapers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 240),
  publisher text not null default '',
  published_date date not null default current_date,
  sectors text[] not null default '{}',
  topics text[] not null default '{}',
  region text not null default '',
  summary text not null default '',
  key_findings text not null default '',
  article_text text not null default '',
  source_url text not null default '',
  access_note text not null default '',
  created_by text not null default 'Astra',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intelligence_newspapers_published_date_idx
  on public.intelligence_newspapers (published_date desc, created_at desc);
create index if not exists intelligence_newspapers_publisher_idx
  on public.intelligence_newspapers (publisher);
create unique index if not exists intelligence_newspapers_source_date_unique
  on public.intelligence_newspapers (lower(source_url), published_date)
  where length(trim(source_url)) > 0;
alter table public.intelligence_newspapers enable row level security;
drop policy if exists intelligence_newspapers_public_access on public.intelligence_newspapers;
create policy intelligence_newspapers_public_access
  on public.intelligence_newspapers for all to anon, authenticated
  using (true) with check (true);
grant select, insert, update, delete on public.intelligence_newspapers to anon, authenticated;
