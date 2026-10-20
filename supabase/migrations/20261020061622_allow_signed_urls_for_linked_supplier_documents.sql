-- Permit the public procurement UI to create signed URLs only for files
-- referenced by a document record. The bucket remains private.
create policy "documents_files_select_linked"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.documents d
    where d.file_url = storage.objects.name
      and d.file_url <> ''
  )
);
