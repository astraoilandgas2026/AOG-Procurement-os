-- The app uploads a file before creating its public.documents row.
-- Keep the bucket private and restrict writes to paths rooted at a real supplier ID.
create policy "documents_files_insert_for_supplier"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.suppliers s
    where s.id::text = split_part(storage.objects.name, '/', 1)
  )
);

create policy "documents_files_update_for_supplier"
on storage.objects
for update
to anon, authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.suppliers s
    where s.id::text = split_part(storage.objects.name, '/', 1)
  )
)
with check (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.suppliers s
    where s.id::text = split_part(storage.objects.name, '/', 1)
  )
);

create policy "documents_files_delete_for_supplier"
on storage.objects
for delete
to anon, authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.suppliers s
    where s.id::text = split_part(storage.objects.name, '/', 1)
  )
);
