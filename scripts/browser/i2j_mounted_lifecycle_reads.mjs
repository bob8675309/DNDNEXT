// Only the existing disposable I1-H database receives these browser read contracts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sources = {
  catalog:["scripts/fixtures/c33_forge_full_component_browser_catalog_pg17.sql","d64b85f8d38ef45bff31a247d20993b18a9822af"],
  review:["sql/20260710_07_transactional_level_up_completion.sql","4a39927c667fab9a2dd87ef1785aadb785e47d38"],
  classes:["sql/20260808_16_simple_class_choice_delta_authority.sql","2e70facd2b5905bf85a63697ed0f895feb27aad5"],
  recovery:["sql/20260808_28_legacy_warlock_invocation_recovery.sql","292acd8000ada950ebcd14e1a917b55918499edb"],
  replacements:["sql/20260808_30_safe_level_up_replacements.sql","7fb8cad7dd19f25673e2d9a3956097561bdab6ee"],
  invocations:["sql/20260808_35_eldritch_invocation_level_replacement.sql","b46f6627813d87b7976cba9cb42663e7d861c81f"],
  equipment:["sql/20260808_49_player_forge_starting_equipment_currency.sql","a052b87a3e9da73272addb673eec180831df6167"],
  rls:["sql/20260721_01_character_data_rls_phase_1.sql","5d9a53590a030ac15a45be654016dbbe00651fff"],
};

function between(source, head, tail) {
  const first=source.indexOf(head);
  const end=source.indexOf(tail,first+head.length);
  assert.ok(first>=0 && end>first,head);
  return source.slice(first,end);
}

export function installMountedLifecycleReads(sql) {
  assert.equal(process.env.DNDNEXT_I2J_MOUNTED_LIFECYCLE,"DISPOSABLE_I1H_BROWSER_ONLY");
  assert.equal(process.env.PGHOST,"127.0.0.1");
  assert.equal(process.env.PGPORT,"55622");
  assert.match(sql("SHOW server_version"),/^17\./);
  assert.equal(sql("SELECT to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NOT NULL AND to_regclass('private.i2j_effect_baseline') IS NOT NULL"),"t");
  const text=Object.fromEntries(Object.entries(sources).map(([key,[path,hash]])=>{
    const buf=readFileSync(path);
    assert.equal(createHash("sha1").update("blob "+buf.length+"\0").update(buf).digest("hex"),hash,path);
    return [key,buf.toString("utf8")];
  }));
  sql(between(text.catalog,"ALTER TABLE public.class_catalog","CREATE TABLE public.class_feature_catalog"));
  sql(between(text.catalog,"ALTER TABLE public.npc_portrait_library","CREATE OR REPLACE VIEW public.class_catalog_preferred"));
  sql(between(text.catalog,"INSERT INTO public.npc_portrait_library","-- Deliberately allow"));
  sql(`
    ALTER TABLE public.class_level_progression ADD COLUMN raw_payload jsonb NOT NULL DEFAULT '{}';
    UPDATE public.class_level_progression SET raw_payload='{"source":"5etools_class_progression"}'
      WHERE class_id='6792abd0-1fd9-44fb-ae4c-56c307ab791a' AND class_level IN(1,2,3);
    ALTER TABLE public.class_feature_catalog ADD COLUMN entries jsonb, ADD COLUMN raw_payload jsonb;
    ALTER TABLE public.class_feature_option_catalog
       ADD COLUMN IF NOT EXISTS feature_types text[], ADD COLUMN IF NOT EXISTS page int,
       ADD COLUMN IF NOT EXISTS additional_spells jsonb, ADD COLUMN IF NOT EXISTS metadata jsonb;
    ALTER TABLE public.items_catalog ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
    UPDATE public.class_catalog SET edition=2024, primary_abilities=ARRAY['cha'], saving_throws=ARRAY['wis','cha'],
      raw_payload=raw_payload||'{"startingProficiencies":{"skills":[{"choose":{"from":["arcana","deception","history","intimidation","investigation","nature","religion"],"count":2}}]}}'
      WHERE class_key='warlock' AND source='XPHB';
    CREATE OR REPLACE VIEW public.class_catalog_preferred AS SELECT * FROM public.class_catalog WHERE source='XPHB';
    CREATE OR REPLACE VIEW public.character_option_catalog_preferred WITH (security_invoker=true) AS
      SELECT * FROM public.character_option_catalog WHERE source='XPHB';
    CREATE OR REPLACE VIEW public.spells_catalog_preferred AS SELECT * FROM public.spells_catalog;
    INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,tags,metadata,raw_payload)
    VALUES('00000000-0000-0000-0000-000000009911','dwarf-xphb','species','Dwarf','XPHB','species',
      ARRAY['playable'],'{"speed":{"walk":30},"size":["Medium"],"traits":[]}','{}');
    REVOKE ALL ON public.class_catalog,public.class_level_progression,public.class_catalog_preferred,
      public.character_option_catalog,public.character_option_catalog_preferred,
      public.items_catalog,public.spells_catalog,public.spells_catalog_preferred,
      public.class_feature_catalog,public.class_feature_option_catalog,
      public.npc_portrait_library,public.npc_visual_assets,public.portrait_sprite_suggestions,
      public.character_spells,public.character_stock FROM PUBLIC,anon,authenticated;
    GRANT SELECT ON public.class_catalog,public.class_level_progression,public.class_catalog_preferred,
      public.character_option_catalog,public.character_option_catalog_preferred,
      public.items_catalog,public.spells_catalog,public.spells_catalog_preferred,
      public.class_feature_catalog,public.class_feature_option_catalog,
      public.npc_portrait_library,public.npc_visual_assets,public.portrait_sprite_suggestions TO authenticated;
    GRANT SELECT(spell_id,source_type,raw_payload,character_id) ON public.character_spells TO authenticated;
    ALTER TABLE public.character_spells ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.character_stock TO authenticated;
    ALTER TABLE public.character_stock ENABLE ROW LEVEL SECURITY;
    CREATE POLICY mounted_fixture_visible_stock ON public.character_stock FOR SELECT TO authenticated
       USING(EXISTS(SELECT 1 FROM public.characters c WHERE c.id=character_id AND c.storefront_enabled));
  `);
  sql(between(text.rls,"create policy character_spells_select_visible_or_assigned","create policy character_spells_admin_write"));

  const publicGetters=[
    ["review","get_character_level_up_review_v1","uuid"],
    ["review","begin_character_level_up_v1","uuid"],
    ["classes","get_character_level_class_choice_options_v1","uuid"],
    ["invocations","get_character_level_class_choice_options_v2","uuid"],
    ["recovery","get_character_invocation_recovery_v1","uuid"],
    ["replacements","get_character_level_replacement_options_v1","uuid"],
    ["equipment","get_player_forge_starting_equipment_v1","uuid,uuid,integer"],
  ];
  const privateHelpers=[
    ["review","unsupported_level_choice_features_v1","jsonb"],
    ...["metamagic_replacement_group","mystic_arcanum_replacement_group","lore_discoveries_replacement_group","replacement_groups"]
      .map(name=>["replacements","level_up_"+name+"_v1","uuid,integer"]),
  ];
  for(const [schema,definitions] of [["private",privateHelpers],["public",publicGetters]]){
    for(const [source,name,args] of definitions){
      const matches=[...text[source].matchAll(new RegExp("^create or replace function "+schema+"\\."+name+"\\([\\s\\S]+?\\n\\$[a-z_]*\\$;","gim"))];
      assert.equal(matches.length,1,name);
      sql(matches[0][0]);
      const signature=schema+"."+name+"("+args+")";
      sql("REVOKE ALL ON FUNCTION "+signature+" FROM PUBLIC, anon, authenticated");
      if(schema==="public")sql("GRANT EXECUTE ON FUNCTION "+signature+" TO authenticated");
    }
  }
  assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_spells','UPDATE')"),"f");
  sql("NOTIFY pgrst,'reload schema'");
}
