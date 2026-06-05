-- Fix 1: Ensure temp_password and admin_notes are NOT readable by anon/authenticated.
-- Postgres column privileges only apply when table-level SELECT is not granted on the whole table.
-- Revoke broad SELECT and re-grant only on safe columns.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, full_name, avatar_url, bio, show_progression,
  username_changed, created_at, updated_at, has_software_access,
  followers_count, following_count
) ON public.profiles TO anon, authenticated;

-- Fix 2: Restrict chat-images uploads to the uploader's own folder.
DROP POLICY IF EXISTS "Authenticated upload chat images" ON storage.objects;

CREATE POLICY "Users upload own chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own chat images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);