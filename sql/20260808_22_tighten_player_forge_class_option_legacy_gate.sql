-- Close the legacy-shape escape hatch for source-owned Warlock Invocation instances.
-- A client-supplied classFeatureChoices bucket is not evidence that a character is legacy.
-- Only the server-owned legacy marker table may authorize the old representation.

create or replace function private.reject_unmarked_legacy_warlock_invocations_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_class_key text := '';
  v_class_source text := '';
  v_source_count integer := 0;
  v_legacy_bucket boolean := false;
  v_server_legacy boolean := false;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  if coalesce(v_sheet #>> '{meta,creator}','') <> 'shared_character_forge_player_v2' then return new; end if;

  select lower(coalesce(cc.class_key,'')), upper(coalesce(cc.source,''))
  into v_class_key,v_class_source
  from public.class_catalog cc
  where cc.id = new.class_id;

  if v_class_key <> 'warlock' or v_class_source <> 'XPHB' then return new; end if;

  select count(*) into v_source_count
  from jsonb_each(
    case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end
  ) entry
  where entry.value->>'ownerType'='class-option'
    and entry.value #>> '{metadata,family}'='eldritch-invocation';

  select exists(
    select 1
    from jsonb_each(
      case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end
    ) legacy
    where legacy.value->>'kind'='eldritch-invocation'
  ) into v_legacy_bucket;

  select exists(
    select 1
    from private.player_forge_source_choice_legacy_v1 legacy
    where legacy.character_id = new.character_id
  ) into v_server_legacy;

  if v_source_count = 0 and v_legacy_bucket and not v_server_legacy then
    raise exception 'New XPHB Warlocks must use source-owned Eldritch Invocation instances; the legacy classFeatureChoices shape is not accepted.';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_unmarked_legacy_warlock_invocations_v1() from public,anon,authenticated;
grant execute on function private.reject_unmarked_legacy_warlock_invocations_v1() to service_role;

drop trigger if exists character_progression_reject_unmarked_legacy_warlock_invocations_v1 on public.character_progression;
create constraint trigger character_progression_reject_unmarked_legacy_warlock_invocations_v1
after insert or update of class_id,class_level,level_choices on public.character_progression
deferrable initially deferred
for each row execute function private.reject_unmarked_legacy_warlock_invocations_v1();
