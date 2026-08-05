-- ============================================================
-- storage.sql
-- Generated strictly from DATABASE.md Section 3: Storage (Supabase Storage)
-- Scope: bucket creation, bucket configuration, storage object policies only.
-- No tables, indexes, table RLS policies, functions, migrations, or seed data.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Storage Buckets
-- ------------------------------------------------------------

-- Bucket: worker-photos (public, no file size limit, no MIME restriction)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-photos', 'worker-photos', true, null, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Bucket: worker-documents (private, no file size limit, no MIME restriction)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-documents', 'worker-documents', false, null, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 2. Storage Object Policies (storage.objects)
-- ------------------------------------------------------------

-- Bucket: worker-photos

drop policy if exists "allow_worker_photos_upload v5d3u8_1" on storage.objects;
create policy "allow_worker_photos_upload v5d3u8_1"
on storage.objects
for select
to public
using (bucket_id = 'worker-photos');

drop policy if exists "allow_worker_photos_upload v5d3u8_2" on storage.objects;
create policy "allow_worker_photos_upload v5d3u8_2"
on storage.objects
for insert
to public
with check (bucket_id = 'worker-photos');

drop policy if exists "allow_worker_photos_upload v5d3u8_0" on storage.objects;
create policy "allow_worker_photos_upload v5d3u8_0"
on storage.objects
for update
to public
using (bucket_id = 'worker-photos')
with check (bucket_id = 'worker-photos');

-- Bucket: worker-documents

drop policy if exists "public_upload_worker_docs" on storage.objects;
create policy "public_upload_worker_docs"
on storage.objects
for insert
to public
with check (bucket_id = 'worker-documents');

drop policy if exists "allow_worker_photos_upload 15rstgp_0" on storage.objects;
create policy "allow_worker_photos_upload 15rstgp_0"
on storage.objects
for update
to public
using (bucket_id = 'worker-documents')
with check (bucket_id = 'worker-documents');

drop policy if exists "allow_worker_photos_upload 15rstgp_1" on storage.objects;
create policy "allow_worker_photos_upload 15rstgp_1"
on storage.objects
for select
to public
using (bucket_id = 'worker-documents');

-- ============================================================
-- AUDIT RESULT
-- Buckets Verified: worker-photos (public=true), worker-documents (public=false) — 2/2 match DATABASE.md Section 3
-- Policies Verified: allow_worker_photos_upload v5d3u8_1 (SELECT), allow_worker_photos_upload v5d3u8_2 (INSERT), allow_worker_photos_upload v5d3u8_0 (UPDATE), public_upload_worker_docs (INSERT), allow_worker_photos_upload 15rstgp_0 (UPDATE), allow_worker_photos_upload 15rstgp_1 (SELECT) — 6/6 match DATABASE.md Section 3
-- Corrections Made: None — for the two UPDATE policies (worker-photos v5d3u8_0, worker-documents 15rstgp_0), DATABASE.md lists a single Using/Check expression for an UPDATE command; both USING and WITH CHECK were set to that same documented expression, as UPDATE policies require both clauses and no divergent value was documented.
-- Final Status: PASS ✅
-- ============================================================