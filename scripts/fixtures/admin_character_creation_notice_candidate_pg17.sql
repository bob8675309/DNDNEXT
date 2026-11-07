-- DNDNext Admin creation-notice candidate: isolated PostgreSQL 17 assertions.
-- Simulated role claims only, NOT real GoTrue; no production migrations.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public TO authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE public.characters (id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL DEFAULT 'npc');
CREATE TABLE public.character_level_events (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE private.test_admins (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $uid$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$uid$;
CREATE FUNCTION private.current_user_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private', 'auth'
AS $isadmin$
  SELECT EXISTS(SELECT 1 FROM private.test_admins a WHERE a.id=auth.uid())
$isadmin$;

INSERT INTO auth.users(id,email) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','gm-one@example.invalid'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','gm-two@example.invalid'),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','creator@example.invalid'),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','outsider@example.invalid');
INSERT INTO private.test_admins(id) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO public.characters(id,name) VALUES
 ('00000000-0000-0000-0000-000000000101','Test Underling'),
 ('00000000-0000-0000-0000-000000000102','Test Alternate');
INSERT INTO public.character_level_events(id,character_id,event_type,created_by,details)
VALUES
 ('00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101','player_character_created',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '{"SENSITIVE_TEST_DETAILS":"DO-NOT-RETURN"}'),
 ('00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000102','player_character_created',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '{"SENSITIVE_TEST_DETAILS":"DO-NOT-RETURN"}');
\i sql/candidates/20261104_admin_character_creation_notices_v1.sql

DO $acl$
BEGIN
 IF has_table_privilege('authenticated',
   'private.admin_character_creation_notice_reviews','SELECT')
 OR has_table_privilege('authenticated',
   'private.admin_character_creation_notice_reviews','INSERT')
 OR has_function_privilege('anon',
   'public.get_admin_character_creation_notices_v1(integer)','EXECUTE')
 OR has_function_privilege('anon',
   'public.review_admin_character_creation_notice_v1(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Notice candidate leaked direct data or anon EXECUTE';
 END IF;
END $acl$;

-- A failed creation transaction must never appear in the Admin inbox.
BEGIN;
INSERT INTO public.characters(id,name)
VALUES ('00000000-0000-0000-0000-000000000103','Rolled Back');
INSERT INTO public.character_level_events(id,character_id,event_type,created_by)
VALUES ('00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000103',
 'player_character_created','cccccccc-cccc-cccc-cccc-cccccccccccc');
ROLLBACK;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
DO $gm_one$
DECLARE v_all bigint;v_unread bigint;v_reviewed timestamptz;v_repeat timestamptz;
BEGIN
 SELECT count(*),coalesce(max(unread_total),0)
 INTO v_all,v_unread
 FROM public.get_admin_character_creation_notices_v1(80);
 IF v_all<>2 OR v_unread<>2 THEN
  RAISE EXCEPTION 'Expected two committed creation notices, got %, unread %',
    v_all,v_unread;
 END IF;
 IF (SELECT count(*) FROM public.get_admin_character_creation_notices_v1(1))<>1
  OR (SELECT unread_total FROM public.get_admin_character_creation_notices_v1(1))<>2 THEN
  RAISE EXCEPTION 'Limit must not corrupt unread total';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.get_admin_character_creation_notices_v1(80)
  WHERE character_name='Test Underling'
    AND creator_email='creator@example.invalid'
    AND created_by='cccccccc-cccc-cccc-cccc-cccccccccccc'
 ) THEN RAISE EXCEPTION 'Admin projection missing expected safe event fields'; END IF;
 v_reviewed:=public.review_admin_character_creation_notice_v1(
  '00000000-0000-0000-0000-000000000001');
 v_repeat:=public.review_admin_character_creation_notice_v1(
  '00000000-0000-0000-0000-000000000001');
 IF v_reviewed IS NULL OR v_repeat IS DISTINCT FROM v_reviewed THEN
   RAISE EXCEPTION 'Per-admin review must be idempotent';
 END IF;
 SELECT coalesce(max(unread_total),0) INTO v_unread
 FROM public.get_admin_character_creation_notices_v1(80);
 IF v_unread<>1 THEN RAISE EXCEPTION 'GM one unread count expected 1, got %',v_unread; END IF;
END $gm_one$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $gm_two$
DECLARE n bigint;
BEGIN
 SELECT coalesce(max(unread_total),0) INTO n
 FROM public.get_admin_character_creation_notices_v1(80);
 IF n<>2 THEN RAISE EXCEPTION 'GM two reviews must be independent; got %',n; END IF;
END $gm_two$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 'dddddddd-dddd-dddd-dddd-dddddddddddd',false);
DO $outsider$
BEGIN
 BEGIN
  PERFORM * FROM public.get_admin_character_creation_notices_v1(80);
  RAISE EXCEPTION 'Non-Admin unexpectedly viewed notices';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM public.review_admin_character_creation_notice_v1(
   '00000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'Non-Admin unexpectedly reviewed a notice';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  PERFORM 1 FROM private.admin_character_creation_notice_reviews;
  RAISE EXCEPTION 'Non-Admin unexpectedly accessed the receipt table';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $outsider$;
RESET ROLE;
DO $final$
BEGIN
 IF (SELECT count(*) FROM private.admin_character_creation_notice_reviews)<>1 THEN
  RAISE EXCEPTION 'Unexpected notice receipt count';
 END IF;
END $final$;
\echo 'Admin creation notices PG17 candidate: committed-only events, independent per-Admin unread, idempotent review and outsider denial PASS'
