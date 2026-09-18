-- Private bucket for family proof photos.
-- Object layout: {family_id}/{child_profile_id}/{task_id}/{completed_on}_{uuid}.jpg

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-photos',
  'proof-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.storage_proof_family_id(object_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid;
$$;

DROP POLICY IF EXISTS "proof_photos_select_family" ON storage.objects;
DROP POLICY IF EXISTS "proof_photos_insert_family" ON storage.objects;
DROP POLICY IF EXISTS "proof_photos_update_family" ON storage.objects;
DROP POLICY IF EXISTS "proof_photos_delete_family" ON storage.objects;

CREATE POLICY "proof_photos_select_family"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proof-photos'
  AND public.is_family_member(public.storage_proof_family_id(name))
);

CREATE POLICY "proof_photos_insert_family"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proof-photos'
  AND public.is_family_member(public.storage_proof_family_id(name))
);

CREATE POLICY "proof_photos_update_family"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'proof-photos'
  AND public.is_family_member(public.storage_proof_family_id(name))
)
WITH CHECK (
  bucket_id = 'proof-photos'
  AND public.is_family_member(public.storage_proof_family_id(name))
);

CREATE POLICY "proof_photos_delete_family"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proof-photos'
  AND public.is_family_member(public.storage_proof_family_id(name))
);

-- Harden helper search_path (advisor)
CREATE OR REPLACE FUNCTION public.storage_proof_family_id(object_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid;
$$;
