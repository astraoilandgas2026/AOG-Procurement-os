alter table public.intelligence_reports
  add column if not exists report_category text not null default 'Market report';
