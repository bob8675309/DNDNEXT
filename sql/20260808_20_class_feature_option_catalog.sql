-- Canonical optional class-feature catalogue.
-- Normalizes 5etools data/optionalfeatures.json so Forge and earned progression can share
-- one source of option prerequisites/repeatability/child-choice semantics.

create table if not exists public.class_feature_option_catalog (
  id uuid primary key default gen_random_uuid(),
  option_key text not null unique,
  option_type text not null,
  name text not null,
  source text not null,
  class_key text,
  feature_types text[] not null default '{}'::text[],
  page integer,
  description text,
  prerequisites jsonb not null default '{}'::jsonb,
  additional_spells jsonb not null default '[]'::jsonb,
  repeatable boolean not null default false,
  choice_schema jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_feature_option_catalog_type_source_idx
  on public.class_feature_option_catalog(option_type, source, name);
create index if not exists class_feature_option_catalog_class_idx
  on public.class_feature_option_catalog(class_key, option_type, source);

alter table public.class_feature_option_catalog enable row level security;
drop policy if exists class_feature_option_catalog_read on public.class_feature_option_catalog;
create policy class_feature_option_catalog_read
on public.class_feature_option_catalog
for select
to anon, authenticated
using (true);

create or replace function public.import_class_feature_option_batch_v1(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not private.current_user_is_admin() then
    raise exception 'Only an admin can import class feature options.' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Class feature option import payload must be an array.';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if nullif(btrim(v_row->>'option_key'),'') is null
       or nullif(btrim(v_row->>'option_type'),'') is null
       or nullif(btrim(v_row->>'name'),'') is null
       or nullif(btrim(v_row->>'source'),'') is null then
      raise exception 'Each class feature option requires option_key, option_type, name, and source.';
    end if;

    insert into public.class_feature_option_catalog(
      option_key, option_type, name, source, class_key, feature_types, page, description,
      prerequisites, additional_spells, repeatable, choice_schema, metadata, raw_payload, updated_at
    ) values (
      v_row->>'option_key', v_row->>'option_type', v_row->>'name', v_row->>'source',
      nullif(v_row->>'class_key',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'feature_types','[]'::jsonb))), '{}'::text[]),
      nullif(v_row->>'page','')::integer,
      nullif(v_row->>'description',''),
      coalesce(v_row->'prerequisites','{}'::jsonb),
      coalesce(v_row->'additional_spells','[]'::jsonb),
      coalesce((v_row->>'repeatable')::boolean,false),
      coalesce(v_row->'choice_schema','{}'::jsonb),
      coalesce(v_row->'metadata','{}'::jsonb),
      coalesce(v_row->'raw_payload','{}'::jsonb),
      now()
    )
    on conflict(option_key) do update set
      option_type=excluded.option_type,
      name=excluded.name,
      source=excluded.source,
      class_key=excluded.class_key,
      feature_types=excluded.feature_types,
      page=excluded.page,
      description=excluded.description,
      prerequisites=excluded.prerequisites,
      additional_spells=excluded.additional_spells,
      repeatable=excluded.repeatable,
      choice_schema=excluded.choice_schema,
      metadata=excluded.metadata,
      raw_payload=excluded.raw_payload,
      updated_at=now();
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('imported',v_count);
end;
$$;

revoke all on function public.import_class_feature_option_batch_v1(jsonb) from public;
grant execute on function public.import_class_feature_option_batch_v1(jsonb) to authenticated, service_role;

-- Source-normalized XPHB Eldritch Invocation rows from 5etools data/optionalfeatures.json.
-- Full raw rows can subsequently be refreshed through import_class_feature_option_batch_v1;
-- these normalized records are sufficient for prerequisite/child-choice authority now.
insert into public.class_feature_option_catalog(
  option_key,option_type,name,source,class_key,feature_types,page,prerequisites,repeatable,choice_schema,metadata,raw_payload
)
values
('optional-feature:agonizing-blast|XPHB','eldritch-invocation','Agonizing Blast','XPHB','warlock',array['EI'],155,'{"minClassLevel":2}'::jsonb,true,'{"kind":"warlock-damage-cantrip","distinctPerRepeat":true}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:armor-of-shadows|XPHB','eldritch-invocation','Armor of Shadows','XPHB','warlock',array['EI'],155,'{}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:ascendant-step|XPHB','eldritch-invocation','Ascendant Step','XPHB','warlock',array['EI'],155,'{"minClassLevel":5}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:devils-sight|XPHB','eldritch-invocation','Devil''s Sight','XPHB','warlock',array['EI'],155,'{"minClassLevel":2}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:devouring-blade|XPHB','eldritch-invocation','Devouring Blade','XPHB','warlock',array['EI'],155,'{"minClassLevel":12,"requiresOptions":["Thirsting Blade"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:eldritch-mind|XPHB','eldritch-invocation','Eldritch Mind','XPHB','warlock',array['EI'],155,'{}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:eldritch-smite|XPHB','eldritch-invocation','Eldritch Smite','XPHB','warlock',array['EI'],155,'{"minClassLevel":5,"requiresOptions":["Pact of the Blade"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:eldritch-spear|XPHB','eldritch-invocation','Eldritch Spear','XPHB','warlock',array['EI'],155,'{"minClassLevel":2}'::jsonb,true,'{"kind":"warlock-damage-cantrip","minRangeFeet":10,"distinctPerRepeat":true}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:fiendish-vigor|XPHB','eldritch-invocation','Fiendish Vigor','XPHB','warlock',array['EI'],155,'{"minClassLevel":2}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:gaze-of-two-minds|XPHB','eldritch-invocation','Gaze of Two Minds','XPHB','warlock',array['EI'],156,'{"minClassLevel":5}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:gift-of-the-depths|XPHB','eldritch-invocation','Gift of the Depths','XPHB','warlock',array['EI'],156,'{"minClassLevel":5}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:gift-of-the-protectors|XPHB','eldritch-invocation','Gift of the Protectors','XPHB','warlock',array['EI'],156,'{"minClassLevel":9,"requiresOptions":["Pact of the Tome"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:investment-of-the-chain-master|XPHB','eldritch-invocation','Investment of the Chain Master','XPHB','warlock',array['EI'],156,'{"minClassLevel":5,"requiresOptions":["Pact of the Chain"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:lessons-of-the-first-ones|XPHB','eldritch-invocation','Lessons of the First Ones','XPHB','warlock',array['EI'],156,'{"minClassLevel":2}'::jsonb,true,'{"kind":"origin-feat","category":"O","distinctPerRepeat":true}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:lifedrinker|XPHB','eldritch-invocation','Lifedrinker','XPHB','warlock',array['EI'],156,'{"minClassLevel":9,"requiresOptions":["Pact of the Blade"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:mask-of-many-faces|XPHB','eldritch-invocation','Mask of Many Faces','XPHB','warlock',array['EI'],156,'{"minClassLevel":2}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:master-of-myriad-forms|XPHB','eldritch-invocation','Master of Myriad Forms','XPHB','warlock',array['EI'],156,'{"minClassLevel":5}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:misty-visions|XPHB','eldritch-invocation','Misty Visions','XPHB','warlock',array['EI'],156,'{"minClassLevel":2}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:one-with-shadows|XPHB','eldritch-invocation','One with Shadows','XPHB','warlock',array['EI'],156,'{"minClassLevel":5}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:otherworldly-leap|XPHB','eldritch-invocation','Otherworldly Leap','XPHB','warlock',array['EI'],156,'{"minClassLevel":2}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:pact-of-the-blade|XPHB','eldritch-invocation','Pact of the Blade','XPHB','warlock',array['EI'],156,'{}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:pact-of-the-chain|XPHB','eldritch-invocation','Pact of the Chain','XPHB','warlock',array['EI'],157,'{}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:pact-of-the-tome|XPHB','eldritch-invocation','Pact of the Tome','XPHB','warlock',array['EI'],157,'{}'::jsonb,false,'{"runtimeChoice":"book-of-shadows-spells","replacementCadence":"short-or-long-rest"}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:repelling-blast|XPHB','eldritch-invocation','Repelling Blast','XPHB','warlock',array['EI'],157,'{"minClassLevel":2}'::jsonb,true,'{"kind":"warlock-attack-cantrip","distinctPerRepeat":true}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:thirsting-blade|XPHB','eldritch-invocation','Thirsting Blade','XPHB','warlock',array['EI'],157,'{"minClassLevel":5,"requiresOptions":["Pact of the Blade"]}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:visions-of-distant-realms|XPHB','eldritch-invocation','Visions of Distant Realms','XPHB','warlock',array['EI'],157,'{"minClassLevel":9}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:whispers-of-the-grave|XPHB','eldritch-invocation','Whispers of the Grave','XPHB','warlock',array['EI'],157,'{"minClassLevel":7}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb),
('optional-feature:witch-sight|XPHB','eldritch-invocation','Witch Sight','XPHB','warlock',array['EI'],157,'{"minClassLevel":15}'::jsonb,false,'{}'::jsonb,'{"sourceFile":"data/optionalfeatures.json"}'::jsonb,'{"normalizedFrom":"5etools_optionalfeature"}'::jsonb)
on conflict(option_key) do update set
  option_type=excluded.option_type,name=excluded.name,source=excluded.source,class_key=excluded.class_key,
  feature_types=excluded.feature_types,page=excluded.page,prerequisites=excluded.prerequisites,
  repeatable=excluded.repeatable,choice_schema=excluded.choice_schema,metadata=excluded.metadata,
  raw_payload=excluded.raw_payload,updated_at=now();
