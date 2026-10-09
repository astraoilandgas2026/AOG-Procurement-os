-- Restore no-login access only for non-sensitive Astra corporate documents.
-- KYC/CIS and all document writes remain restricted to explicitly authorized authenticated users.
grant select on public.astra_documents to anon;
revoke insert, update, delete on public.astra_documents from anon;
drop policy if exists astra_docs_select on storage.objects;
drop policy if exists astra_docs_insert on storage.objects;
drop policy if exists astra_docs_update on storage.objects;
drop policy if exists astra_docs_delete on storage.objects;
drop policy if exists astra_documents_select on public.astra_documents;
drop policy if exists astra_documents_insert on public.astra_documents;
drop policy if exists astra_documents_update on public.astra_documents;
drop policy if exists astra_documents_delete on public.astra_documents;
drop policy if exists astra_documents_public_safe_select on public.astra_documents;
drop policy if exists astra_docs_public_safe_select on storage.objects;

create policy astra_documents_public_safe_select
on public.astra_documents for select to anon
using (category in ('company_profile','corporate','other'));

create policy astra_docs_public_safe_select
on storage.objects for select to anon
using (
  bucket_id = 'astra-docs'
  and (
    name like 'corporate/company_profile/%'
    or name like 'corporate/corporate/%'
    or name like 'corporate/other/%'
  )
);

