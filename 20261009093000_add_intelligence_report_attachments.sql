-- Attachments for Intelligence Reports. Private bucket; browser accesses files through short-lived signed URLs.
alter table public.intelligence_reports
  add column if not exists file_path text not null default '',
  add column if not exists file_name text not null default '',
  add column if not exists file_size bigint not null default 0,
  add column if not exists mime_type text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('intelligence-reports', 'intelligence-reports', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

drop policy if exists intelligence_reports_files_anon_insert on storage.objects;
create policy intelligence_reports_files_anon_insert on storage.objects
for insert to anon with check (bucket_id = 'intelligence-reports');

drop policy if exists intelligence_reports_files_anon_select on storage.objects;
create policy intelligence_reports_files_anon_select on storage.objects
for select to anon using (bucket_id = 'intelligence-reports');

drop policy if exists intelligence_reports_files_anon_update on storage.objects;
create policy intelligence_reports_files_anon_update on storage.objects
for update to anon using (bucket_id = 'intelligence-reports') with check (bucket_id = 'intelligence-reports');

drop policy if exists intelligence_reports_files_anon_delete on storage.objects;
create policy intelligence_reports_files_anon_delete on storage.objects
for delete to anon using (bucket_id = 'intelligence-reports');
