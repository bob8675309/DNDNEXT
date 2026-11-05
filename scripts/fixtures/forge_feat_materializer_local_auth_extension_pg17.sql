-- DNDNext held research PR #324. Original immediate feat-instance materializer,
-- exact grant table column/constraint shapes and original downstream triggers.
-- Only after J00–J38 in FREE disposable Supabase local GoTrue PostgreSQL17.
-- NEVER APPLY TO PRODUCTION, main, or a persistent staging DB.
\set ON_ERROR_STOP on
DO $local_guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int <170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.character_option_catalog_preferred') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgname='character_progression_validate_player_forge_authority_v1')
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgname='character_sheets_authority_fields_guard_v1')
 OR to_regclass('public.character_option_grant_instances') IS NOT NULL
 OR to_regclass('public.character_option_grants') IS NOT NULL
 THEN RAISE EXCEPTION 'Refuse non-disposable or out-of-order source grant-materializer fixture';
 END IF;
END $local_guard$;

-- Original live grant tables: exact columns, defaults, NOT NULL, FKs, checks,
-- and unique keys inspected read-only from information_schema/pg_constraint.
CREATE TABLE public.character_option_grant_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 option_id uuid REFERENCES public.character_option_catalog(id) ON DELETE RESTRICT,
 option_key text,
 option_type text NOT NULL DEFAULT 'feat',
 option_name text NOT NULL,
 option_source text,
 instance_key text NOT NULL,
 acquisition_owner_type text,
 acquisition_owner_key text,
 acquisition_label text,
 acquisition_level integer NOT NULL DEFAULT 1
    CHECK (acquisition_level >= 1 AND acquisition_level <= 20),
 choices jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(choices)='object'),
 effects jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(effects)='array'),
 fixed_spell_tokens jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(fixed_spell_tokens)='array'),
 repeatable boolean NOT NULL DEFAULT false,
 granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,instance_key)
);
CREATE INDEX character_option_grant_instances_character_idx
 ON public.character_option_grant_instances(character_id);
CREATE INDEX character_option_grant_instances_name_idx
 ON public.character_option_grant_instances(character_id,lower(option_name));
CREATE INDEX character_option_grant_instances_option_idx
 ON public.character_option_grant_instances(option_id);

CREATE TABLE public.character_option_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 option_id uuid NOT NULL REFERENCES public.character_option_catalog(id) ON DELETE CASCADE,
 notes text,
 granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,option_id)
);
CREATE INDEX character_option_grants_character_idx
 ON public.character_option_grants(character_id,created_at);
CREATE INDEX character_option_grants_granted_by_idx
 ON public.character_option_grants(granted_by);
CREATE INDEX character_option_grants_option_id_idx
 ON public.character_option_grants(option_id);

-- The following original source functions may create feature-specific side
-- effects for OTHER feat families. The Lucky XPHB specimen doesn't enter
-- those branches. No general "all feat runtime effects" claim is made.
\i scripts/fixtures/forge_feat_materializer_original_pg17.sql
DO $source_hash_gate$
BEGIN
 IF md5(pg_get_functiondef(
  'private.materialize_player_forge_feat_instances_v1()'::regprocedure))
       <> 'c27c4181a51cfd018bbb8244e9931550'
 OR md5(pg_get_functiondef(
  'private.materialize_boon_energy_resistance_instance_v1()'::regprocedure))
       <> '35cb3d6560ffde5a94b019a9f373f65d'
 OR md5(pg_get_functiondef(
  'private.materialize_cartomancer_instance_v1()'::regprocedure))
       <> '30939673464de80a0791a89017d48065'
 OR md5(pg_get_functiondef(
  'private.materialize_feat_runtime_expertise_instance_v1()'::regprocedure))
       <> 'c56af0b4f49f024a18baf396eeb2d1e2'
 THEN RAISE EXCEPTION 'Live original feat materializer source-drift detected in disposable PG17'; END IF;
END $source_hash_gate$;

-- Source-original AFTER INSERT immediate character progression trigger:
CREATE TRIGGER character_progression_materialize_player_forge_feat_instances_v
 AFTER INSERT ON public.character_progression FOR EACH ROW
 EXECUTE FUNCTION private.materialize_player_forge_feat_instances_v1();

-- Source-original downstream authority guards reuse the SAME exact deployed
-- function already imported for J22–J30. Not permissive stubs.
CREATE TRIGGER character_option_grant_instances_direct_authority_guard_v1
 BEFORE INSERT OR DELETE OR UPDATE ON public.character_option_grant_instances
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();
CREATE TRIGGER character_option_grants_direct_authority_guard_v1
 BEFORE INSERT OR DELETE OR UPDATE ON public.character_option_grants
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();

-- Three original downstream feature-family hooks, untouched. Their Lucky
-- branch immediately returns and does not prove specialized feat behavior.
CREATE TRIGGER character_option_grant_instance_boon_energy_resistance_v1
 AFTER INSERT ON public.character_option_grant_instances FOR EACH ROW
 EXECUTE FUNCTION private.materialize_boon_energy_resistance_instance_v1();
CREATE TRIGGER character_option_grant_instance_cartomancer_v1
 AFTER INSERT ON public.character_option_grant_instances FOR EACH ROW
 EXECUTE FUNCTION private.materialize_cartomancer_instance_v1();
CREATE TRIGGER character_option_grant_instance_feat_runtime_expertise_v1
 AFTER INSERT ON public.character_option_grant_instances FOR EACH ROW
 EXECUTE FUNCTION private.materialize_feat_runtime_expertise_instance_v1();

-- Protect new public tables independently of the privileged creation RPC.
REVOKE ALL ON public.character_option_grant_instances FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.character_option_grants FROM PUBLIC,anon,authenticated;
ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_option_grants ENABLE ROW LEVEL SECURITY;

DO $verify$
DECLARE v_count int;
BEGIN
 SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND
 ((c.relname='character_progression'
    AND t.tgname='character_progression_materialize_player_forge_feat_instances_v')
 OR (c.relname='character_option_grant_instances' AND t.tgname IN
    ('character_option_grant_instances_direct_authority_guard_v1',
     'character_option_grant_instance_boon_energy_resistance_v1',
     'character_option_grant_instance_cartomancer_v1',
     'character_option_grant_instance_feat_runtime_expertise_v1'))
 OR (c.relname='character_option_grants'
    AND t.tgname='character_option_grants_direct_authority_guard_v1'));
 IF v_count<>6 THEN
   RAISE EXCEPTION 'Expected all six original feat materializer and grant-table triggers, found %',v_count;
 END IF;
END $verify$;
\echo 'PASS FIXTURE: original immediate feat grant materializer and five downstream grant-table triggers, original grant table constraints installed'
