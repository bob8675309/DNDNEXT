-- Canonical all-source spell/class display plus reusable character options and admin grants.

create or replace function public.character_source_priority_v1(p_source text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case upper(coalesce(p_source,''))
    when 'XPHB' then 0
    when 'EFA' then 1
    when 'TCE' then 2
    when 'PHB' then 3
    else 10
  end;
$$;

create index if not exists spells_catalog_normalized_name_idx
  on public.spells_catalog ((lower(regexp_replace(btrim(name),'\s+',' ','g'))));

create or replace view public.spells_catalog_preferred
with (security_invoker=true)
as
select distinct on (lower(regexp_replace(btrim(s.name),'\s+',' ','g'))) s.*
from public.spells_catalog s
order by
  lower(regexp_replace(btrim(s.name),'\s+',' ','g')),
  public.character_source_priority_v1(s.source),
  s.source,
  s.updated_at desc,
  s.id;

grant select on public.spells_catalog_preferred to anon, authenticated;

create or replace function public.is_preferred_spell_version_v1(p_spell_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists(select 1 from public.spells_catalog_preferred where id=p_spell_id);
$$;

create or replace view public.class_catalog_preferred
with (security_invoker=true)
as
select distinct on (c.class_key) c.*
from public.class_catalog c
order by c.class_key, public.character_source_priority_v1(c.source), c.source, c.updated_at desc, c.id;

grant select on public.class_catalog_preferred to anon, authenticated;

create or replace function public.is_preferred_class_version_v1(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists(select 1 from public.class_catalog_preferred where id=p_class_id);
$$;

create or replace function private.starting_spell_requirements_v2(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_class public.class_catalog%rowtype;
  v_level public.class_level_progression%rowtype;
  v_cantrips integer := 0;
  v_leveled integer := 0;
  v_prepared integer := 0;
begin
  select * into v_class from public.class_catalog where id=p_class_id;
  if v_class.id is null then return jsonb_build_object('cantrips',0,'leveled',0,'prepared',0); end if;
  select * into v_level from public.class_level_progression where class_id=p_class_id and class_level=1;
  v_cantrips := greatest(0,coalesce(v_level.cantrips_known,0));
  if v_class.class_key='wizard' then
    v_leveled := 6;
    v_prepared := greatest(0,coalesce(v_level.spells_known,4));
  elsif v_class.spellcasting_ability is not null then
    v_leveled := greatest(0,coalesce(v_level.spells_known,0));
    v_prepared := v_leveled;
  end if;
  return jsonb_build_object('cantrips',v_cantrips,'leveled',v_leveled,'prepared',v_prepared);
end;
$$;

create table if not exists public.character_option_catalog (
  id uuid primary key default gen_random_uuid(),
  option_key text not null unique,
  option_type text not null check (option_type in ('feat','boon','background','species','skill')),
  name text not null,
  source text not null default 'UNK',
  category text,
  description text,
  prerequisite_text text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists character_option_catalog_type_name_idx
  on public.character_option_catalog(option_type, lower(name));
create index if not exists character_option_catalog_source_idx
  on public.character_option_catalog(source);
create index if not exists character_option_catalog_tags_idx
  on public.character_option_catalog using gin(tags);

alter table public.character_option_catalog enable row level security;
drop policy if exists character_option_catalog_read on public.character_option_catalog;
create policy character_option_catalog_read on public.character_option_catalog
  for select to anon,authenticated using (true);

create or replace view public.character_option_catalog_preferred
with (security_invoker=true)
as
select distinct on (o.option_type,lower(regexp_replace(btrim(o.name),'\s+',' ','g'))) o.*
from public.character_option_catalog o
order by
  o.option_type,
  lower(regexp_replace(btrim(o.name),'\s+',' ','g')),
  public.character_source_priority_v1(o.source),
  o.source,
  o.updated_at desc,
  o.id;

grant select on public.character_option_catalog_preferred to anon, authenticated;

create table if not exists public.character_option_grants (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  option_id uuid not null references public.character_option_catalog(id) on delete cascade,
  notes text,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id,option_id)
);

create index if not exists character_option_grants_character_idx
  on public.character_option_grants(character_id,created_at);
alter table public.character_option_grants enable row level security;
revoke all on public.character_option_grants from anon,authenticated;

create or replace function public.import_character_option_batch_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog,public,private,auth
as $$
declare
  v_row jsonb;
  v_count integer := 0;
  v_rows integer := coalesce(jsonb_array_length(coalesce(p_payload->'rows','[]'::jsonb)),0);
  v_key text;
  v_type text;
begin
  if not coalesce(public.is_admin(),false) then
    raise exception 'Admin access is required to import character options.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_payload->'rows','null'::jsonb))<>'array' then
    raise exception 'Payload must contain a rows array.';
  end if;
  if v_rows=0 then raise exception 'Payload contains no character options.'; end if;
  if v_rows>500 then raise exception 'Import batch too large: %, maximum 500 options.',v_rows; end if;

  for v_row in select value from jsonb_array_elements(p_payload->'rows') loop
    v_key := nullif(btrim(v_row->>'option_key'),'');
    v_type := lower(btrim(coalesce(v_row->>'option_type','')));
    if v_key is null then raise exception 'Every option row must include option_key.'; end if;
    if v_type not in ('feat','boon','background','species','skill') then
      raise exception 'Invalid character option type: %',v_type;
    end if;

    insert into public.character_option_catalog(
      option_key,option_type,name,source,category,description,prerequisite_text,tags,metadata,raw_payload,updated_at
    ) values(
      v_key,
      v_type,
      coalesce(nullif(btrim(v_row->>'name'),''),'Unknown Option'),
      coalesce(nullif(btrim(v_row->>'source'),''),'UNK'),
      nullif(btrim(v_row->>'category'),''),
      nullif(v_row->>'description',''),
      nullif(v_row->>'prerequisite_text',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'tags','[]'::jsonb))),'{}'),
      coalesce(v_row->'metadata','{}'::jsonb),
      coalesce(v_row->'raw_payload','{}'::jsonb),
      now()
    )
    on conflict(option_key) do update set
      option_type=excluded.option_type,
      name=excluded.name,
      source=excluded.source,
      category=excluded.category,
      description=excluded.description,
      prerequisite_text=excluded.prerequisite_text,
      tags=excluded.tags,
      metadata=excluded.metadata,
      raw_payload=excluded.raw_payload,
      updated_at=now();
    v_count := v_count+1;
  end loop;
  return jsonb_build_object('options',v_count);
end;
$$;

create or replace function public.get_character_option_grants_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog,public,private,auth
as $$
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to view these character features.' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',g.id,
      'characterId',g.character_id,
      'optionId',o.id,
      'optionKey',o.option_key,
      'optionType',o.option_type,
      'name',o.name,
      'source',o.source,
      'category',o.category,
      'description',o.description,
      'prerequisiteText',o.prerequisite_text,
      'tags',o.tags,
      'metadata',o.metadata,
      'notes',g.notes,
      'createdAt',g.created_at
    ) order by o.option_type,o.name)
    from public.character_option_grants g
    join public.character_option_catalog o on o.id=g.option_id
    where g.character_id=p_character_id
  ),'[]'::jsonb);
end;
$$;

create or replace function private.sync_admin_feature_array_v1(
  p_character_id uuid,
  p_option_type text,
  p_name text,
  p_add boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog,public,private
as $$
declare
  v_path text[];
  v_sheet jsonb;
  v_values jsonb;
begin
  v_path := case when p_option_type='boon' then array['adminGrantedBoons'] else array['adminGrantedFeats'] end;
  select sheet into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return; end if;
  v_sheet := coalesce(v_sheet,'{}'::jsonb);
  v_values := coalesce(v_sheet #> v_path,'[]'::jsonb);
  if jsonb_typeof(v_values)<>'array' then v_values:='[]'::jsonb; end if;

  if p_add then
    if not exists(select 1 from jsonb_array_elements_text(v_values) value where lower(value)=lower(p_name)) then
      v_values := v_values || to_jsonb(p_name);
    end if;
  else
    select coalesce(jsonb_agg(value),'[]'::jsonb) into v_values
    from jsonb_array_elements_text(v_values) value
    where lower(value)<>lower(p_name);
  end if;

  v_sheet := jsonb_set(v_sheet,v_path,v_values,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$$;

create or replace function public.grant_character_option_v1(
  p_character_id uuid,
  p_option_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog,public,private,auth
as $$
declare
  v_option public.character_option_catalog%rowtype;
  v_grant public.character_option_grants%rowtype;
begin
  if not coalesce(public.is_admin(),false) then
    raise exception 'Admin access is required to grant feats or boons.' using errcode='42501';
  end if;
  if not exists(select 1 from public.characters where id=p_character_id) then
    raise exception 'Character not found.' using errcode='P0002';
  end if;
  select * into v_option from public.character_option_catalog where id=p_option_id;
  if v_option.id is null or v_option.option_type not in ('feat','boon') then
    raise exception 'Choose a feat or boon from the catalog.';
  end if;

  insert into public.character_option_grants(character_id,option_id,notes,granted_by,updated_at)
  values(p_character_id,p_option_id,nullif(btrim(coalesce(p_notes,'')),''),auth.uid(),now())
  on conflict(character_id,option_id) do update set
    notes=excluded.notes,
    granted_by=auth.uid(),
    updated_at=now()
  returning * into v_grant;

  perform private.sync_admin_feature_array_v1(p_character_id,v_option.option_type,v_option.name,true);
  return jsonb_build_object('grant',to_jsonb(v_grant),'option',to_jsonb(v_option));
end;
$$;

create or replace function public.remove_character_option_grant_v1(p_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grants%rowtype;
  v_option public.character_option_catalog%rowtype;
begin
  if not coalesce(public.is_admin(),false) then
    raise exception 'Admin access is required to remove feats or boons.' using errcode='42501';
  end if;
  select * into v_grant from public.character_option_grants where id=p_grant_id for update;
  if v_grant.id is null then return null; end if;
  select * into v_option from public.character_option_catalog where id=v_grant.option_id;
  delete from public.character_option_grants where id=p_grant_id;
  perform private.sync_admin_feature_array_v1(v_grant.character_id,v_option.option_type,v_option.name,false);
  return jsonb_build_object('grant',to_jsonb(v_grant),'option',to_jsonb(v_option));
end;
$$;

revoke all on function public.import_character_option_batch_v1(jsonb) from public,anon;
revoke all on function public.get_character_option_grants_v1(uuid) from public,anon;
revoke all on function public.grant_character_option_v1(uuid,uuid,text) from public,anon;
revoke all on function public.remove_character_option_grant_v1(uuid) from public,anon;
grant execute on function public.import_character_option_batch_v1(jsonb) to authenticated;
grant execute on function public.get_character_option_grants_v1(uuid) to authenticated;
grant execute on function public.grant_character_option_v1(uuid,uuid,text) to authenticated;
grant execute on function public.remove_character_option_grant_v1(uuid) to authenticated;

insert into public.character_option_catalog(option_key,option_type,name,source,category,description,metadata)
values
 ('acrobatics|XPHB','skill','Acrobatics','XPHB','dex','Stay on your feet in a tricky situation or perform an acrobatic stunt.',jsonb_build_object('ability','dex')),
 ('animal-handling|XPHB','skill','Animal Handling','XPHB','wis','Calm or train an animal, or get an animal to behave in a certain way.',jsonb_build_object('ability','wis')),
 ('arcana|XPHB','skill','Arcana','XPHB','int','Recall lore about spells, magic items, and the planes of existence.',jsonb_build_object('ability','int')),
 ('athletics|XPHB','skill','Athletics','XPHB','str','Jump farther than normal, stay afloat in rough water, or break something.',jsonb_build_object('ability','str')),
 ('deception|XPHB','skill','Deception','XPHB','cha','Tell a convincing lie or wear a disguise convincingly.',jsonb_build_object('ability','cha')),
 ('history|XPHB','skill','History','XPHB','int','Recall lore about historical events, people, nations, and cultures.',jsonb_build_object('ability','int')),
 ('insight|XPHB','skill','Insight','XPHB','wis','Discern a person''s mood and intentions.',jsonb_build_object('ability','wis')),
 ('intimidation|XPHB','skill','Intimidation','XPHB','cha','Awe or threaten someone into doing what you want.',jsonb_build_object('ability','cha')),
 ('investigation|XPHB','skill','Investigation','XPHB','int','Find obscure information or deduce how something works.',jsonb_build_object('ability','int')),
 ('medicine|XPHB','skill','Medicine','XPHB','wis','Diagnose an illness or determine what killed the recently slain.',jsonb_build_object('ability','wis')),
 ('nature|XPHB','skill','Nature','XPHB','int','Recall lore about terrain, plants, animals, and weather.',jsonb_build_object('ability','int')),
 ('perception|XPHB','skill','Perception','XPHB','wis','Notice something that is easy to miss by using your senses.',jsonb_build_object('ability','wis')),
 ('performance|XPHB','skill','Performance','XPHB','cha','Act, tell a story, perform music, or dance.',jsonb_build_object('ability','cha')),
 ('persuasion|XPHB','skill','Persuasion','XPHB','cha','Honestly and graciously convince someone of something.',jsonb_build_object('ability','cha')),
 ('religion|XPHB','skill','Religion','XPHB','int','Recall lore about gods, religious hierarchies, and holy symbols.',jsonb_build_object('ability','int')),
 ('sleight-of-hand|XPHB','skill','Sleight of Hand','XPHB','dex','Pick a pocket, conceal an object, or perform legerdemain.',jsonb_build_object('ability','dex')),
 ('stealth|XPHB','skill','Stealth','XPHB','dex','Escape notice by moving quietly and using concealment.',jsonb_build_object('ability','dex')),
 ('survival|XPHB','skill','Survival','XPHB','wis','Follow tracks, forage, navigate, or avoid natural hazards.',jsonb_build_object('ability','wis'))
on conflict(option_key) do update set description=excluded.description,metadata=excluded.metadata,updated_at=now();
