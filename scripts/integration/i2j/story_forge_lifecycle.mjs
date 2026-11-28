// Run inside the existing I1-H disposable signed session, after its eight checks.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { installStoryLifecycleSources } from "./story_forge_lifecycle_sources.mjs";

export async function runStoryForgeLifecycle({sql,sqlFile,rpc,creator,outsider,basePayload,unrelatedId,classId,blastId,poisonId}) {
  const q = value => "'"+String(value).replaceAll("'","''")+"'";
  const guard = installStoryLifecycleSources({sql,sqlFile,targetClass:classId});
  const slot2 = "warlock-invocation-slot-2";
  const slot3 = "warlock-invocation-slot-3";
  const lessons = "optional-feature:lessons-of-the-first-ones|XPHB";
  const replacementGroup = "warlock-invocation-replacement";
  const armor = "optional-feature:armor-of-shadows|XPHB";
  const child = "child-lessons-of-the-first-ones";
  const lucky = "5003a12b-94e2-45db-bcc2-3eeff78c0587";
  const magic = randomUUID();
  const skilled = randomUUID();
  const merchantBackground = randomUUID();
  const merchant = randomUUID();
  const stock = randomUUID();
  const nonce = randomUUID();
  const story = "Disposable Forge lifecycle private Story";
  const startingName = "I2J Story lifecycle Warlock";
  const feat = (id,name,instanceId,ownerType,ownerKey,level,choices={}) => ({
    instanceId,optionId:id,name,source:"XPHB",optionType:"feat",category:"O",
    acquisitionOwnerType:ownerType,acquisitionOwnerKey:ownerKey,acquisitionLevel:level,
    choices,fixedEffects:[],fixedSpellTokens:[],
  });
  const spell = (name,level,list) => {
    const id=randomUUID();
    sql("INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key) VALUES("+
      [q(id),q(name),level,"ARRAY["+q(list)+"]","'XPHB'","'Evocation'",q("i2j-story-"+name.toLowerCase().replaceAll(" ","-"))].join(",")+")");
    return id;
  };
  const [first,second,third,fourth]=[1,1,1,2].map((level,i)=>spell("Warlock specimen "+(i+1),level,"Warlock"));
  const [cantripA,cantripB,limitedSpell]=[0,0,1].map((level,i)=>spell("Wizard specimen "+(i+1),level,"Wizard"));
  sql(`UPDATE public.character_option_catalog SET option_key='feat:lucky|XPHB',metadata='{}' WHERE id=${q(lucky)};
    INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,metadata)
    VALUES(${q(magic)},'feat:magic-initiate|XPHB','feat','Magic Initiate','XPHB','O','{"repeatable":true}'),
      (${q(skilled)},'feat:skilled|XPHB','feat','Skilled','XPHB','O','{"repeatable":true}'),
      (${q(merchantBackground)},'background:merchant|XPHB','background','Merchant','XPHB',NULL,'{}');
    INSERT INTO public.characters(id,name,kind,storefront_enabled)
      VALUES(${q(merchant)},'Disposable lifecycle merchant','merchant',true);
    INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id)
      VALUES(${q(stock)},${q(merchant)},2,'Training Dagger','{"item_type":"weapon","item_rarity":"mundane"}',1,'training-dagger');
  `);
  const skills=["Arcana","Athletics","Perception"];
  for(const [i,name] of skills.entries()){
    sql("INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,metadata) VALUES("+
      [q(randomUUID()),q("skill:"+name.toLowerCase()+"|XPHB"),"'skill'",q(name),"'XPHB'",q(["int","str","wis"][i]),"'{}'"].join(",")+")");
  }

  const rows = (table,filter) => JSON.parse(sql(
    "SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') FROM "+table+" t WHERE "+filter));
  const character = id => "character_id="+q(id);
  const snapshotCreation = id => ({
    character:rows("public.characters","id="+q(id)),
    actor:rows("private.character_creator_attribution",character(id)),
    permissions:rows("public.character_permissions",character(id)),
    story:rows("public.character_backstory_secrets",character(id)),
    reservation:rows("private.player_creation_intent_reservations_v1",character(id)),
    inventory:rows("public.inventory_items","owner_type='character' AND owner_id="+q(id)),
    currency:rows("public.character_currency",character(id)),
    stock:rows("public.character_stock","id="+q(stock)),
    creationEvent:rows("public.character_level_events",character(id)+" AND event_type='player_character_created'"),
  });
  const canonical = id => ({
    sheet:rows("public.character_sheets",character(id)),
    progression:rows("public.character_progression",character(id)),
    invocations:rows("public.character_class_option_grant_instances",character(id)),
    grants:rows("public.character_option_grant_instances",character(id)),
    presence:rows("public.character_option_grants",character(id)),
    spells:rows("public.character_spells",character(id)),
    slots:rows("public.character_spell_slots",character(id)),
    provenance:rows("private.i2j_effect_baseline",character(id)),
    sessions:rows("public.character_level_up_sessions",character(id)),
    events:rows("public.character_level_events",character(id)),
  });
  const mirrors = () => rows("public.players","true");
  const unrelated = canonical(unrelatedId);
  const payload = structuredClone(basePayload);
  payload.name=startingName;
  payload.creation_request_id=nonce;
  payload.background="Merchant";
  Object.assign(payload.sheet,{
    hp:9,maxHp:9,abilities:{con:{score:12}},feats:["Lucky"],
    proficiencies:{skills:{persuasion:{proficient:true},animalHandling:{proficient:true}}},
    tools:["Navigator's Tools"],
    featGrantInstances:[feat(lucky,"Lucky","background-merchant-lucky","background","merchant",1)],
    startingEquipmentSelections:{mode:"market",ruleset:"vanilla",backgroundId:merchantBackground,
      marketPurchases:[{merchantId:merchant,stockId:stock,qty:1}]},
  });
  const magicPayload=[blastId,poisonId,first,second].map(spell_id=>({
    spell_id,source_type:"class",source_key:"warlock",access_type:"class-list",prepared:true,
  }));
  payload.sheet.startingMagicSelections=magicPayload;
  const create = (actor,p=payload,privateStory=story) => rpc(actor.client,"create_player_character_with_private_backstory_v1",{
    p_payload:p,p_spell_choices:[],p_magic_selections:magicPayload,p_private_backstory:privateStory,
  });
  const globalCounts = () => Object.fromEntries([
    "public.characters","public.character_sheets","public.character_progression","public.character_backstory_secrets",
    "private.player_creation_intent_reservations_v1","public.character_option_grants","public.character_option_grant_instances",
    "public.character_class_option_grant_instances","public.character_permissions","public.character_level_events",
    "public.character_spells","public.inventory_items","public.character_currency",
  ].map(table=>[table,sql("SELECT count(*) FROM "+table)]));
  const requireDenial = (result,code,message) => {
    assert.equal(result.error?.code,code,JSON.stringify(result.error));
    assert.match(result.error.message,message);
  };
  const failedPayload=structuredClone(payload);
  failedPayload.creation_request_id=randomUUID();
  failedPayload.name=startingName+" invalid owner choice";
  delete failedPayload.sheet.sourceChoices["warlock-invocation-slot-1"].fields.invocation;
  const beforeFailedCreate={counts:globalCounts(),mirrors:mirrors(),stock:rows("public.character_stock","id="+q(stock))};
  requireDenial(await create(creator,failedPayload),"P0001",/requires exactly one|persisted|source-owned/i);
  assert.deepEqual({counts:globalCounts(),mirrors:mirrors(),stock:rows("public.character_stock","id="+q(stock))},beforeFailedCreate);
  assert.equal(sql("SELECT count(*) FROM private.player_creation_intent_reservations_v1 WHERE request_id="+q(failedPayload.creation_request_id)),"0");

  const firstResult=await create(creator);
  assert.ifError(firstResult.error);
  const id=firstResult.data;
  assert.match(id,/^[a-f0-9-]{36}$/);
  const created=snapshotCreation(id);
  const beforeAdvancement=canonical(id);
  const createdMirrors=mirrors();
  assert.equal(created.character[0].creation_request_id,nonce);
  assert.equal(created.character[0].secret,null);
  assert.equal(created.story[0].secret_text,story);
  assert.equal(created.actor[0].creator_user_id,creator.id);
  assert.equal(created.reservation[0].request_id,nonce);
  assert.equal(created.reservation[0].owner_user_id,creator.id);
  assert.equal(created.permissions[0].user_id,creator.id);
  assert.equal(created.permissions[0].can_edit,true);
  assert.equal(created.stock[0].qty,1);
  assert.equal(created.inventory.length,1);
  assert.equal(created.inventory[0].card_payload.stock_id,stock);
  assert.equal(created.currency.length,1);
  assert.equal(created.creationEvent[0].to_level,1);
  assert.equal(beforeAdvancement.progression[0].created_by,creator.id);
  assert.equal(beforeAdvancement.invocations.length,1);
  assert.equal(beforeAdvancement.invocations[0].option_catalog_id,"7776f12d-eef4-47c6-a996-c1ddf45c5071");
  assert.equal(beforeAdvancement.grants[0].option_id,lucky);
  assert.equal(beforeAdvancement.grants[0].acquisition_owner_type,"background");
  assert.equal(beforeAdvancement.grants[0].granted_by,creator.id);
  assert.equal(beforeAdvancement.sheet[0].sheet.featGrantInstances[0].optionId,lucky);
  assert.equal(beforeAdvancement.spells.length,4);
  const accountStory=await outsider.client.from("character_backstory_secrets").select("secret_text").eq("character_id",id);
  assert.ok(accountStory.error || accountStory.data.length===0);
  const replay=await create(creator);
  assert.ifError(replay.error);
  assert.equal(replay.data,id);
  requireDenial(await create(creator,payload,"Changed disposable lifecycle Story"),"22023",/intent|different|modified/i);
  requireDenial(await create(outsider),"42501",/belongs|permission|account/i);
  assert.deepEqual(canonical(id),beforeAdvancement);
  assert.deepEqual(snapshotCreation(id),created);
  assert.deepEqual(mirrors(),createdMirrors);
  console.log("PASS LIFE-01 Story-wrapped signed creation, owner attribution, Lucky instance, private Story, stock and nonce rollback");

  const open = (from,to,xp) => {
    sql("UPDATE public.character_progression SET pending_level_up=true,experience_points="+xp+" WHERE "+character(id));
    return sql("INSERT INTO public.character_level_up_sessions(character_id,status,from_level,to_level,created_by) VALUES("+
      [q(id),"'open'",from,to,q(creator.id)].join(",")+") RETURNING id");
  };
  const apply=(actor,selections)=>rpc(actor.client,"complete_character_level_up_v5",{p_character_id:id,p_selections:selections});
  const snapshots=()=>({canonical:canonical(id),created:snapshotCreation(id),mirrors:mirrors(),unrelated:canonical(unrelatedId)});
  const denyAdvance=async(actor,selections,code,message)=>{
    const before=snapshots();
    requireDenial(await apply(actor,selections),code,message);
    assert.deepEqual(snapshots(),before);
  };
  const pick=value=>({key:value,value,label:value});
  const magicChoices={
    "spell-list":[pick("Wizard")],"spellcasting-ability":[pick("int")],
    "cantrips-wizard":[pick(cantripA),pick(cantripB)],"level-1-wizard":[pick(limitedSpell)],
  };
  const learn={
    hp_method:"fixed",spell_choices:[{spell_id:third,prepared:true}],
    class_choice_selections:{[slot2]:{invocation:[lessons],[child]:[magic]},[slot3]:{invocation:[lessons],[child]:[skilled]}},
    class_option_feat_instances:[
      feat(magic,"Magic Initiate","earned-magic","class-option",slot2,2,magicChoices),
      feat(skilled,"Skilled","earned-skilled","class-option",slot3,2,{"skills-or-tools":skills.map(value=>({...pick(value),kind:"skill"}))}),
    ],
    replacement_selections:{},
  };
  const level2Session=open(1,2,299);
  await denyAdvance(outsider,learn,"42501",/^You do not have permission to level this character\.$/);
  await denyAdvance(creator,learn,"P0001",/^The required XP threshold has not been reached\.$/);
  sql("UPDATE public.character_progression SET experience_points=300 WHERE "+character(id));
  const invalidLearn=structuredClone(learn);
  invalidLearn.class_option_feat_instances[0].choices["cantrips-wizard"]=[pick(cantripA),pick(cantripA)];
  await denyAdvance(creator,invalidLearn,"P0001",/^Magic Initiate cantrips must be distinct\.$/);
  const exactBefore=snapshots();
  const originalAttempt=await apply(creator,learn);
  if(originalAttempt.error){
    requireDenial(originalAttempt,"P0001",/^Warlock level 1 requires exactly 1 normalized Invocation instance\(s\); found 3\.$/);
    assert.deepEqual(snapshots(),exactBefore);
    console.log("PASS LIFE-02 original deferred OLD/NEW level timing RED with atomic rollback");
    guard.applyFinalStateCandidate();
    assert.ifError((await apply(creator,learn)).error);
  } else {
    console.log("PASS LIFE-02 original deferred validator accepted the joined transition without the final-state-only correction");
  }
  const afterEarn=canonical(id);
  assert.deepEqual(snapshotCreation(id),created);
  assert.deepEqual(mirrors(),createdMirrors);
  assert.equal(afterEarn.progression[0].class_level,2);
  assert.equal(afterEarn.sessions.find(row=>row.id===level2Session).status,"completed");
  assert.deepEqual(afterEarn.invocations.find(row=>row.instance_key==="warlock-invocation-slot-1"),beforeAdvancement.invocations[0]);
  const magicGrant=afterEarn.grants.find(row=>row.option_id===magic);
  const skilledGrant=afterEarn.grants.find(row=>row.option_id===skilled);
  assert.equal(magicGrant.acquisition_owner_key,slot2);
  assert.equal(skilledGrant.acquisition_owner_key,slot3);
  for(const grant of [magicGrant,skilledGrant]){
    assert.equal(grant.granted_by,creator.id);
    assert.equal(grant.acquisition_level,2);
    assert.equal(afterEarn.sheet[0].sheet.featGrantInstances.find(row=>row.instanceId===grant.instance_key).optionId,grant.option_id);
  }
  assert.equal(afterEarn.provenance.length,3);
  for(const name of skills) assert.equal(afterEarn.sheet[0].sheet.proficiencies.skills[name.toLowerCase()].proficient,true);
  const ownSpells=afterEarn.spells.filter(row=>row.source_type==="feat" && row.source_key===magicGrant.instance_key);
  assert.deepEqual(ownSpells.map(row=>row.spell_id).sort(),[cantripA,cantripB,limitedSpell].sort());
  assert.ok(ownSpells.every(row=>row.casting_stat==="int"));
  const pool=ownSpells.find(row=>row.spell_id===limitedSpell);
  assert.deepEqual([pool.uses_remaining,pool.uses_max,pool.recharge],[1,1,"long-rest"]);
  const use=(actor)=>rpc(actor.client,"update_character_spell_use_v1",{p_character_id:id,p_assignment_id:pool.id,p_operation:"use"});
  const beforeDeniedUse=snapshots();
  requireDenial(await use(outsider),"42501",/permission to manage/);
  assert.deepEqual(snapshots(),beforeDeniedUse);
  const spent=await use(creator);
  assert.ifError(spent.error);
  assert.equal(spent.data.limitedSpellUses.find(row=>row.assignmentId===pool.id).remaining,0);
  assert.equal(canonical(id).spells.find(row=>row.id===pool.id).uses_remaining,0);
  console.log("PASS LIFE-03 same character earned independent Magic Initiate and Skilled; signed free use and provenance verified");

  const level3Session=open(2,3,900);
  const replace={
    hp_method:"fixed",subclass_name:"Fiend",subclass_source:"XPHB",
    spell_choices:[{spell_id:fourth,prepared:true}],class_option_feat_instances:[],replacement_selections:{},
    class_choice_selections:{[replacementGroup]:{replace:[slot2],with:[armor]}},
  };
  const badReplacement=structuredClone(replace);
  badReplacement.class_choice_selections[replacementGroup].replace=["missing-invocation"];
  await denyAdvance(creator,badReplacement,"P0001",/^The selected Invocation cannot be replaced on this level-up\.$/);
  await denyAdvance(creator,{...replace,spell_choices:[]},"P0001",/^Choose exactly 1 new leveled spell\(s\)\.$/);
  const beforeReplace=canonical(id);
  const result=await apply(creator,replace);
  assert.ifError(result.error);
  const after=canonical(id);
  const summary=result.data.replacements;
  assert.equal(summary.length,1);
  assert.equal(summary[0].removedFeat.instanceKey,magicGrant.instance_key);
  assert.equal(summary[0].with,"Armor of Shadows");
  const invocation=after.invocations.find(row=>row.instance_key===slot2);
  const replaced=beforeReplace.invocations.find(row=>row.instance_key===slot2);
  assert.equal(invocation.id,replaced.id);
  assert.equal(invocation.acquired_level,2);
  assert.equal(invocation.metadata.lastReplacementLevel,3);
  assert.equal(after.sheet[0].sheet.sourceChoices[slot2].fields.invocation.selections[0].key,armor);
  assert.equal(after.progression[0].class_level,3);
  assert.deepEqual(after.progression[0].level_choices["3"].replacements,summary);
  assert.deepEqual(after.sessions.find(row=>row.id===level3Session).selections.replacements,summary);
  assert.deepEqual(after.events.find(row=>row.to_level===3).details.replacements,summary);
  assert.deepEqual(after.grants,beforeReplace.grants.filter(row=>row.instance_key!==magicGrant.instance_key));
  assert.deepEqual(after.presence,beforeReplace.presence.filter(row=>row.option_id!==magic));
  assert.deepEqual(after.provenance,beforeReplace.provenance);
  assert.deepEqual(after.spells.filter(row=>row.spell_id!==fourth),beforeReplace.spells.filter(row=>!ownSpells.some(spell=>spell.id===row.id)));
  assert.equal(after.spells.find(row=>row.spell_id===fourth).source_key,"warlock");
  assert.equal(after.sheet[0].sheet.proficiencies.skills.persuasion.proficient,true);
  assert.deepEqual(after.sheet[0].sheet.proficiencies,beforeReplace.sheet[0].sheet.proficiencies);
  assert.deepEqual(after.invocations.filter(row=>row.instance_key!==slot2),beforeReplace.invocations.filter(row=>row.instance_key!==slot2));
  const profile=await rpc(creator.client,"character_sheet_resource_profile_v1",{p_character_id:id});
  assert.ifError(profile.error);
  assert.deepEqual(profile.data.limitedSpellUses,[]);
  assert.deepEqual(profile.data.slots.map(row=>[row.poolKey,row.slotLevel,row.max]),[["pact_magic",2,2]]);
  await denyAdvance(creator,replace,"P0001",/^Choose a different Invocation to replace Armor of Shadows\.$/);
  assert.deepEqual(canonical(unrelatedId),unrelated);
  assert.deepEqual(snapshotCreation(id),created);
  assert.deepEqual(mirrors(),createdMirrors);
  const beforeFinalReplay=snapshots();
  const finalReplay=await create(creator);
  assert.ifError(finalReplay.error);
  assert.equal(finalReplay.data,id);
  assert.deepEqual(snapshots(),beforeFinalReplay);
  guard.verify();
  console.log("::notice title=Joined signed Forge lifecycle::LIFE-01 through LIFE-04 passed. Story creation, earned Magic Initiate/Skilled, free use, late rollback, replacement and replay on the same character. "+guard.fingerprintReceipt());
}
