-- Keep newspaper PDFs and extracted content linked to the same database record.
alter table public.intelligence_newspapers
  add column if not exists file_path text not null default '',
  add column if not exists file_name text not null default '',
  add column if not exists file_size bigint not null default 0,
  add column if not exists mime_type text not null default '';
