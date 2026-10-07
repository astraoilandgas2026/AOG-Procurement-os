create table if not exists public.astra_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'corporate',
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  version integer not null default 1,
  is_current boolean not null default true,
  uploaded_by text not null default 'Astra',
  created_at timestamptz default now()
);

alter table public.astra_documents enable row level security;
grant select, insert, update, delete on public.astra_documents to anon, authenticated;

create policy astra_documents_select on public.astra_documents for select to anon, authenticated using (true);
create policy astra_documents_insert on public.astra_documents for insert to anon, authenticated with check (true);
create policy astra_documents_update on public.astra_documents for update to anon, authenticated using (true) with check (true);
create policy astra_documents_delete on public.astra_documents for delete to anon, authenticated using (true);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
select 'astra-docs','astra-docs',false,52428800,array[
'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'image/png','image/jpeg'
]
where not exists (select 1 from storage.buckets where id='astra-docs');

create policy astra_docs_select on storage.objects for select to anon, authenticated using (bucket_id='astra-docs');
create policy astra_docs_insert on storage.objects for insert to anon, authenticated with check (bucket_id='astra-docs');
create policy astra_docs_update on storage.objects for update to anon, authenticated using (bucket_id='astra-docs') with check (bucket_id='astra-docs');
create policy astra_docs_delete on storage.objects for delete to anon, authenticated using (bucket_id='astra-docs');