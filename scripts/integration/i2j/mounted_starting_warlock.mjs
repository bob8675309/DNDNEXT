// The starting level-two J168/J169 specimen runs before LIFE's scratch timing
// correction, using the original first-creation and normalized guards.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MountedLifecycle } from "../../browser/verify_i2j_mounted_lifecycle.mjs";
import { verifyEquivalenceSources, readStartingWarlock, writeEquivalenceReceipt } from "./forge_advancement_equivalence.mjs";

const rpcName="create_player_character_with_private_backstory_v1";
const signature="public."+rpcName+"(jsonb,jsonb,jsonb,text)";
const optionHash="6df5aee6f0519c9c77758d6e887ed8e4";
const validatorHash="4f1752db655b6ba490113f604c7583ef";
const storyHash="6e39477f971c9d40c6726c9f4dbc456e";
const q=value=>"'"+String(value).replaceAll("'","''")+"'";

export async function runMountedStartingWarlock({sql,rpc,creator,outsider,mounted,backgroundId}) {
  const source=verifyEquivalenceSources();
  const hash=name=>sql("SELECT md5(pg_get_functiondef("+q(name)+"::regprocedure))");
  const verifyFingerprints=()=>{
    assert.equal(hash(signature),storyHash);
    assert.equal(hash("private.validate_and_materialize_player_forge_class_options_v1()"),optionHash);
    assert.equal(hash("private.validate_existing_normalized_warlock_invocations_v2()"),validatorHash);
  };
  verifyFingerprints();
  const stock=randomUUID();
  const merchantId=randomUUID();
  const nonce=randomUUID();
  const story="Disposable J168 level-two private Story";
  const schools=["Necromancy","Evocation","Abjuration","Enchantment","Evocation"];
  const catalog=source.spells.map((row,i)=>({...row,school:schools[i],spell_key:row.name.toLowerCase().replaceAll(" ","-")}));
  sql(`INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key,damage_types,damage_dice,attack_type,range_unit,range_distance,ritual)
    SELECT id,name,level,classes,source,school,spell_key,damage_types,damage_dice,attack_type,range_unit,range_distance,ritual
    FROM jsonb_to_recordset(${q(JSON.stringify(catalog))}::jsonb) AS s(
      id uuid,name text,level integer,classes text[],source text,school text,spell_key text,
      damage_types text[],damage_dice text,attack_type text,range_unit text,range_distance numeric,ritual boolean)
    ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.characters(id,name,kind,storefront_enabled)
    VALUES(${q(merchantId)},'Disposable J168 merchant','merchant',true);
    INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id)
    VALUES(${q(stock)},${q(merchantId)},3,'J168 starting torch','{"item_type":"gear","item_rarity":"mundane"}',9,'p13-warlock-torch');`);
  const blast=source.spells.find(row=>row.name==="Eldritch Blast");
  const wrong=source.spells.find(row=>row.name==="Armor of Agathys");
  assert.equal(sql("SELECT public.is_preferred_spell_version_v1("+q(blast.id)+"::uuid)"),"t");

  const browser=new MountedLifecycle({sql,...mounted.credentials,actorId:creator.id});
  let result;
  try {
    result=await browser.create({
      payload:{name:"Mounted J168 Starting Warlock",creation_request_id:nonce,sheet:{startingEquipmentSelections:{backgroundId}}},
      story,stock,merchantId,startingWarlock:source,
    });
    assert.deepEqual(browser.writes,[rpcName]);
    browser.verifyBrowserTraffic();
  } finally {
    await browser.close();
  }

  const {data:id,request}=result;
  const sheet=request.p_payload.sheet;
  assert.equal(sheet.level,2);
  assert.equal(request.p_payload?.secret ?? null,null);
  assert.equal(signedInvocationChoices(sheet.classFeatureChoices).length,0);
  for(const option of source.invocations){
    const group=sheet.sourceChoices["warlock-invocation-slot-"+option.slot];
    assert.equal(group.ownerType,"class-option");
    assert.equal(group.ownerKey,"warlock-invocation-"+option.slot);
    assert.equal(group.level,option.acquisitionLevel);
    assert.equal(group.fields.invocation.selections.length,1);
    assert.equal(group.fields.invocation.selections[0].key,option.key);
    assert.equal(group.fields.invocation.selections[0].source,source.classSource);
    assert.equal(group.fields.invocation.selections[0].metadata.optionId,option.id);
  }
  const childKey="child-agonizing-blast";
  const child=sheet.sourceChoices["warlock-invocation-slot-2"].fields[childKey].selections;
  assert.equal(child.length,1);
  assert.equal(child[0].value,blast.id);
  assert.equal(child[0].metadata.spellId,blast.id);
  assert.deepEqual(request.p_magic_selections.map(row=>row.spell_id).sort(),source.spells.map(row=>row.id).sort());
  const canonical=readStartingWarlock(sql,id,source);
  assert.deepEqual(canonical.spells.map(row=>row.spellId).sort(),source.spells.map(row=>row.id).sort());
  assert.equal(canonical.spells.filter(row=>row.level===0).length,2);
  assert.equal(canonical.spells.filter(row=>row.level===1).length,3);
  const character="character_id="+q(id);
  const one=(table,where=character)=>JSON.parse(sql("SELECT to_jsonb(t) FROM "+table+" t WHERE "+where));
  assert.equal(one("public.characters","id="+q(id)).secret,null);
  assert.equal(one("private.character_creator_attribution").creator_user_id,creator.id);
  assert.equal(one("private.player_creation_intent_reservations_v1").request_id,nonce);
  assert.equal(one("private.player_creation_intent_reservations_v1").owner_user_id,creator.id);
  assert.equal(one("public.character_permissions").user_id,creator.id);
  assert.equal(one("public.character_permissions").can_edit,true);
  assert.equal(one("public.character_backstory_secrets").secret_text,story);
  const outside=await outsider.client.from("character_backstory_secrets").select("secret_text").eq("character_id",id);
  assert.ok(outside.error || outside.data.length===0);
  assert.equal(one("public.character_progression").class_level,2);
  assert.equal(one("public.character_progression").created_by,creator.id);
  assert.equal(one("public.character_level_events",character+" AND event_type='player_character_created'").to_level,2);
  assert.equal(one("public.inventory_items","owner_type='character' AND owner_id="+q(id)).card_payload.stock_id,stock);
  assert.ok(one("public.character_currency"));
  assert.equal(one("public.character_stock","id="+q(stock)).qty,2);
  console.log("::notice title=Mounted starting Warlock::STORY-J168-02 passed. Genuine Story creation persisted three original grants, 2+3 exact spells, creator, private Story, level-two progression, gear and stock.");

  const tables=[
    "public.characters","public.character_sheets","public.character_progression","public.character_level_events",
    "public.character_class_option_grant_instances","public.character_option_grants","public.character_option_grant_instances",
    "public.character_spells","public.character_spell_slots","public.inventory_items","public.character_currency",
    "public.character_stock","public.character_permissions","public.character_backstory_secrets",
    "private.character_creator_attribution","private.player_creation_intent_reservations_v1","public.players",
  ];
  const snapshot=()=>sql("SELECT jsonb_build_array("+tables.map(table=>
    "(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM "+table+" t)"
  ).join(",")+")");
  const before=snapshot();
  const replay=await rpc(creator.client,rpcName,request);
  assert.ifError(replay.error);
  assert.equal(replay.data,id);
  assert.equal(snapshot(),before);
  const altered=await rpc(creator.client,rpcName,{...request,p_private_backstory:story+" changed"});
  assert.equal(altered.error?.code,"22023",JSON.stringify(altered.error));
  assert.match(altered.error.message,/intent|different|modified/i);
  const thirdParty=await rpc(outsider.client,rpcName,request);
  assert.equal(thirdParty.error?.code,"42501",JSON.stringify(thirdParty.error));
  assert.equal(snapshot(),before);

  for(const mode of ["missing-child","invalid-child"]){
    const bad=structuredClone(request);
    bad.p_payload.name+=" "+mode;
    bad.p_payload.creation_request_id=randomUUID();
    for(const choices of [bad.p_payload.sheet.sourceChoices,bad.p_payload.sheet.meta.sourceChoices]){
      const fields=choices["warlock-invocation-slot-2"].fields;
      if(mode==="missing-child"){
        delete fields[childKey];
      }else{
        const choice=fields[childKey].selections[0];
        Object.assign(choice,{key:wrong.id,value:wrong.id,label:wrong.name});
        choice.metadata.spellId=wrong.id;
      }
    }
    const denied=await rpc(creator.client,rpcName,bad);
    assert.equal(denied.error?.code,"P0001",JSON.stringify(denied.error));
    assert.match(denied.error.message,
      mode==="missing-child" ? /Agonizing Blast requires exactly one dependent source choice/i : /Agonizing Blast requires a preferred Warlock damage cantrip/i);
    assert.equal(snapshot(),before,mode+" left a partial creation write");
  }
  verifyFingerprints();
  console.log("::notice title=Mounted starting Warlock negatives::STORY-J168-03 passed. Same intent was inert. Changed Story, outsider replay, missing child and leveled child were rejected with no partial writes.");
  writeEquivalenceReceipt(process.env.DNDNEXT_MOUNTED_J168_RECEIPT,"mounted-j168",{
    canonical,fingerprints:{storyHash,optionHash,validatorHash},
    rejections:["changed-story-22023","outsider-42501","missing-child-P0001","invalid-child-P0001"],
    replay:"same-nonce-inert",
  });
}

function signedInvocationChoices(groups={}) {
  return Object.entries(groups).filter(([key,group])=>/invocation|agonizing/i.test(key+" "+group?.kind));
}
