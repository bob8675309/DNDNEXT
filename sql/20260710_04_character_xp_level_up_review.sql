-- Secure XP controls and non-destructive level-up review sessions.
-- 2024/XPHB is the canonical player-facing ruleset; legacy rows remain available only as fallbacks.

create table if not exists public.character_level_up_sessions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  from_level integer not null check (from_level between 1 and 19),
  to_level integer not null check (to_level between 2 and 20 and to_level = from_level + 1),
  status text not null default 'open' check (status in ('open','cancelled','completed')),
  metadata_ready boolean not null default false,
  required_choices jsonb not null default '[]'::jsonb,
  selections jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists character_level_up_sessions_one_open_idx
  on public.character_level_up_sessions(character_id)
  where status = 'open';

create index if not exists character_level_up_sessions_character_idx
  on public.character_level_up_sessions(character_id, created_at desc);

alter table public.character_level_up_sessions enable row level security;
revoke all on public.character_level_up_sessions from anon, authenticated;

create or replace function public.can_manage_character_progression_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
  select auth.uid() is not null
    and private.can_manage_character_progression_v1(p_character_id);
$$;

create or replace function public.get_character_level_up_review_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_session public.character_level_up_sessions%rowtype;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to view this level-up review.' using errcode = '42501';
  end if;

  select * into v_session
  from public.character_level_up_sessions
  where character_id = p_character_id and status = 'open'
  order by created_at desc
  limit 1;

  if v_session.id is null then return null; end if;
  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'preview', v_session.preview,
    'metadataReady', v_session.metadata_ready,
    'canComplete', false
  );
end;
$$;

create or replace function public.begin_character_level_up_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_required jsonb;
  v_preview jsonb;
  v_metadata_ready boolean;
  v_created boolean := false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode = '42501';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id = p_character_id
  for update;

  if v_progression.character_id is null then
    raise exception 'Character progression has not been initialized.' using errcode = 'P0002';
  end if;
  if v_progression.class_level >= 20 then
    raise exception 'This character is already level 20.';
  end if;
  if not v_progression.pending_level_up then
    raise exception 'The XP threshold for the next level has not been reached.';
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_next
  from public.class_level_progression
  where class_id = v_progression.class_id
    and class_level = v_progression.class_level + 1;

  if v_next.class_id is null then
    raise exception 'Next-level progression metadata is unavailable.' using errcode = 'P0002';
  end if;

  v_metadata_ready := v_class.source = 'XPHB'
    and coalesce(v_next.raw_payload->>'source','') = '5etools_class_progression';

  v_required := jsonb_build_array(jsonb_build_object(
    'key','hp_method',
    'type','single',
    'label','Hit Point Increase',
    'options',jsonb_build_array('fixed','roll'),
    'required',true,
    'hitDie',v_class.hit_die
  )) || coalesce(v_next.choices, '[]'::jsonb);

  v_preview := jsonb_build_object(
    'classKey', v_class.class_key,
    'className', v_class.class_name,
    'source', v_class.source,
    'ruleset', v_class.ruleset,
    'fromLevel', v_progression.class_level,
    'toLevel', v_progression.class_level + 1,
    'xp', v_progression.experience_points,
    'requiredXp', v_next.xp_threshold,
    'proficiencyBonus', v_next.proficiency_bonus,
    'cantripsKnown', v_next.cantrips_known,
    'spellsKnown', v_next.spells_known,
    'spellSlots', v_next.spell_slots,
    'features', v_next.features,
    'choices', v_required,
    'metadataReady', v_metadata_ready
  );

  select * into v_session
  from public.character_level_up_sessions
  where character_id = p_character_id and status = 'open'
  for update;

  if v_session.id is null then
    insert into public.character_level_up_sessions(
      character_id, from_level, to_level, status, metadata_ready,
      required_choices, selections, preview, created_by
    ) values (
      p_character_id, v_progression.class_level, v_progression.class_level + 1,
      'open', v_metadata_ready, v_required, '{}'::jsonb, v_preview, auth.uid()
    ) returning * into v_session;
    v_created := true;
  else
    update public.character_level_up_sessions
    set from_level = v_progression.class_level,
        to_level = v_progression.class_level + 1,
        metadata_ready = v_metadata_ready,
        required_choices = v_required,
        preview = v_preview,
        updated_at = now()
    where id = v_session.id
    returning * into v_session;
  end if;

  if v_created then
    insert into public.character_level_events(
      character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
    ) values (
      p_character_id,'level_up_review_started',v_progression.class_level,v_progression.class_level + 1,
      v_progression.experience_points,v_progression.experience_points,
      jsonb_build_object('sessionId',v_session.id,'source',v_class.source,'metadataReady',v_metadata_ready),auth.uid()
    );
  end if;

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'preview', v_preview,
    'metadataReady', v_metadata_ready,
    'canComplete', false,
    'message', case
      when not v_metadata_ready then 'Import the reviewed 2024 class metadata before applying this level.'
      else 'Level-up review is ready. Final transactional application will unlock with the choice engine.'
    end
  );
end;
$$;

create or replace function public.cancel_character_level_up_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_session public.character_level_up_sessions%rowtype;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to cancel this level-up review.' using errcode = '42501';
  end if;

  update public.character_level_up_sessions
  set status = 'cancelled', updated_at = now()
  where character_id = p_character_id and status = 'open'
  returning * into v_session;

  if v_session.id is null then return null; end if;

  insert into public.character_level_events(
    character_id,event_type,from_level,to_level,details,created_by
  ) values (
    p_character_id,'level_up_review_cancelled',v_session.from_level,v_session.to_level,
    jsonb_build_object('sessionId',v_session.id),auth.uid()
  );

  return to_jsonb(v_session);
end;
$$;

create or replace function private.cancel_invalid_level_up_session_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not new.pending_level_up or new.class_level is distinct from old.class_level then
    update public.character_level_up_sessions
    set status = 'cancelled', updated_at = now()
    where character_id = new.character_id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_invalid_level_up_session_v1 on public.character_progression;
create trigger cancel_invalid_level_up_session_v1
after update of class_level, pending_level_up on public.character_progression
for each row execute function private.cancel_invalid_level_up_session_v1();

revoke all on function public.can_manage_character_progression_v1(uuid) from public, anon;
revoke all on function public.get_character_level_up_review_v1(uuid) from public, anon;
revoke all on function public.begin_character_level_up_v1(uuid) from public, anon;
revoke all on function public.cancel_character_level_up_v1(uuid) from public, anon;
grant execute on function public.can_manage_character_progression_v1(uuid) to authenticated;
grant execute on function public.get_character_level_up_review_v1(uuid) to authenticated;
grant execute on function public.begin_character_level_up_v1(uuid) to authenticated;
grant execute on function public.cancel_character_level_up_v1(uuid) to authenticated;