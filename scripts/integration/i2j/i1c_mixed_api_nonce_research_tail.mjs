
// APPENDED ONLY TO A TEMPORARY COPY OF THE EXACT ORIGINAL SIGNED HARNESS.
// All identities, nonce values, and text in this extension are synthetic.
// No connection or claims beyond the inherited localhost-only harness.
const marker="__dndnext_private_story_intent_sha256_i1c";
const bridge="create_player_character_v3_with_story_intent_i1c";
const direct=(actor,p,version=3)=>rpc(actor.client,"create_player_character_v"+version,{
  p_payload:p,p_spell_choices:[],...(version===3?{p_magic_selections:[]}:{})
});
const fresh=label=>({...payload,creation_request_id:randomUUID(),name:"I2J mixed API "+label+" "+randomUUID()});
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
const storyHash=s=>sql("SELECT encode(sha256(convert_to(jsonb_build_array('i1c-creator-private-story-v1',"+literal(s)+"::text)::text,'UTF8')),'hex')");
const augmented=(p,s)=>({...p,[marker]:storyHash(s)});
const snapshot=p=>{
  const n=literal(p.creation_request_id);
  const ids="SELECT id FROM public.characters WHERE creation_request_id="+n;
  const rows=(table,where)=>"(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM "+table+" t WHERE "+where+")";
  return sql("SELECT jsonb_build_array("+[
    rows("public.characters","creation_request_id="+n),
    rows("public.character_sheets","character_id IN ("+ids+")"),
    rows("public.character_progression","character_id IN ("+ids+")"),
    rows("public.character_spells","character_id IN ("+ids+")"),
    rows("public.character_permissions","character_id IN ("+ids+")"),
    rows("public.character_backstory_secrets","character_id IN ("+ids+")"),
    rows("private.character_creator_attribution","character_id IN ("+ids+")"),
    rows("private.player_creation_intent_reservations_v1","request_id="+n)
  ].join(",")+")::text");
};
const storyCount=id=>recordCount("public.character_backstory_secrets","character_id="+literal(id));
const storyActor=await signedActor(),foreignActor=await signedActor();
const syntheticStory="I2J-SYNTHETIC-STORY-ONLY";

// Original Story-first vs direct-v3 augmented raw payload; same actor only.
const sFirst=fresh("story-first");
const sid=succeeded(await create(storyActor,syntheticStory,sFirst),"I2J original Story-first");
const sBefore=snapshot(sFirst);
const sReplay=await direct(storyActor,augmented(sFirst,syntheticStory));
if(sReplay.error){
  denied(sReplay,"original Story-first augmented replay","22023");
  console.log("I2J-RED01 NOT REPRODUCED: direct augmented replay already rejects");
}else{
  assert.equal(sReplay.data,sid);
  console.log("I2J-RED01 REPRODUCED: original same-owner direct v3 accepts Story-aware reserved intent");
}
assert.equal(snapshot(sFirst),sBefore,"Story-first replay must not change rows");
denied(await direct(foreignActor,augmented(sFirst,syntheticStory)),"foreign direct augmented replay","42501");
assert.equal(snapshot(sFirst),sBefore);
console.log("PASS I2J-01 foreign actor denied and replay state unchanged");

// Original direct-first: identical augmented intent can adopt Story later.
const dFirst=fresh("direct-first");
const dResult=await direct(storyActor,augmented(dFirst,syntheticStory));
if(dResult.error){
  denied(dResult,"original direct reserved ingress","22023");
  assert.equal(recordCount("public.characters","creation_request_id="+literal(dFirst.creation_request_id)),0);
  assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id="+literal(dFirst.creation_request_id)),0);
  console.log("I2J-RED02 NOT REPRODUCED: original direct reserved ingress rejects");
}else{
  const did=succeeded(dResult,"original direct augmented create");
  assert.equal(storyCount(did),0);
  const dBefore=snapshot(dFirst);
  const adoption=await create(storyActor,syntheticStory,dFirst);
  if(adoption.error){
    denied(adoption,"original direct-first adoption","22023");
    assert.equal(snapshot(dFirst),dBefore);
    console.log("I2J-RED02 NOT REPRODUCED: Story adoption denied");
  }else{
    assert.equal(adoption.data,did);
    assert.equal(storyCount(did),1);
    assert.notEqual(snapshot(dFirst),dBefore);
    console.log("I2J-RED02 REPRODUCED: same-owner mixed API replay inserts previously absent Story");
  }
  assert.equal(recordCount("public.characters","creation_request_id="+literal(dFirst.creation_request_id)),1);
  assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id="+literal(dFirst.creation_request_id)),1);
}
const pending=fresh("pre-guard-direct");
const pendingResult=await direct(storyActor,augmented(pending,syntheticStory));
if(!pendingResult.error)assert.equal(storyCount(pendingResult.data),0);
else denied(pendingResult,"original pre-guard reserved ingress","22023");

// Actual signed REST exposure, separately from privileged local role probe.
const privateProbe=fresh("private-probe");
const privateBefore=snapshot(privateProbe);
const args={p_payload:privateProbe,p_spell_choices:[],p_magic_selections:[],p_private_backstory:syntheticStory};
const publicProbe=await storyActor.client.rpc(bridge,args);
assert.equal(publicProbe.error?.code,"PGRST202","Private bridge must not have a public REST route");
const schemaProbe=await storyActor.client.schema("private").rpc(bridge,args);
assert.equal(schemaProbe.error?.code,"PGRST106","Private schema must not be exposed by fixture PostgREST");
assert.equal(snapshot(privateProbe),privateBefore);
console.log("PASS I2J-02 genuine signed public and private-schema REST bridge requests denied");
assert.equal(sql("SELECT has_function_privilege('anon','private."+bridge+"(jsonb,jsonb,jsonb,text)','EXECUTE')"),"f");
assert.equal(sql("SELECT has_function_privilege('authenticated','private."+bridge+"(jsonb,jsonb,jsonb,text)','EXECUTE')"),"t");
const claims=await storyActor.client.auth.getClaims();assert.ifError(claims.error);
assert.equal(claims.data.claims.sub,storyActor.id);
const roleResult=sql("BEGIN; SELECT set_config('request.jwt.claims',"+literal(JSON.stringify({sub:storyActor.id,role:"authenticated"}))+",true); SET LOCAL ROLE authenticated; SELECT private."+bridge+"("+literal(JSON.stringify(privateProbe))+"::jsonb,'[]'::jsonb,'[]'::jsonb,"+literal(syntheticStory)+"); RESET ROLE; SELECT count(*) FROM public.characters WHERE creation_request_id="+literal(privateProbe.creation_request_id)+"; SELECT count(*) FROM public.character_backstory_secrets WHERE character_id IN (SELECT id FROM public.characters WHERE creation_request_id="+literal(privateProbe.creation_request_id)+"); ROLLBACK;");
assert.deepEqual(roleResult.split("\n").slice(-2),["1","0"]);
assert.equal(snapshot(privateProbe),privateBefore);
console.log("PASS I2J-03 local SQL-role-only probe (not JWT verification): authenticated bridge can create without Story; rollback leaves no rows");

// Candidate GREEN: source-derived guard only, applied to disposable functions
// and preserving their exact existing bodies, ACLs and private bridge.
const sigs=["public.create_player_character_v2(jsonb,jsonb)","public.create_player_character_v3(jsonb,jsonb,jsonb)"];
const oldHashes=[v2WrapperOriginal,v3WrapperOriginal];
for(let i=0;i<sigs.length;i++){
  const reg=literal(sigs[i])+"::regprocedure";
  const definition=sql("SELECT pg_get_functiondef("+reg+")");
  assert.equal(sql("SELECT md5(pg_get_functiondef("+reg+"))"),oldHashes[i]);
  const acl=sql("SELECT coalesce(proacl::text,'') FROM pg_proc WHERE oid="+reg);
  const anchor="BEGIN\n IF nullif(btrim(v_payload->>'creation_request_id'),'') IS NOT NULL THEN";
  assert.equal(definition.split(anchor).length,2,"Exact guard anchor drift");
  const guard="BEGIN\n IF v_payload ? '"+marker+"' THEN\n   RAISE EXCEPTION 'Reserved private Story nonce field is not a client choice' USING ERRCODE='22023';\n END IF;\n IF nullif(btrim(v_payload->>'creation_request_id'),'') IS NOT NULL THEN";
  const patched=definition.replace(anchor,guard);
  sql(patched);
  assert.equal(sql("SELECT pg_get_functiondef("+reg+")").replace(guard,anchor),definition);
  assert.equal(sql("SELECT coalesce(proacl::text,'') FROM pg_proc WHERE oid="+reg),acl);
}
assert.equal(sql("SELECT md5(pg_get_functiondef('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)'::regprocedure))"),originalInnerV3);
sql("NOTIFY pgrst,'reload schema'");
for(const version of [2,3]){
  for(const value of [null,"client-fake",storyHash(syntheticStory)]){
    const p=fresh("guard-v"+version);
    const before=snapshot(p);
    denied(await direct(storyActor,{...p,[marker]:value},version),"guard rejects reserved key including JSON null","22023");
    assert.equal(snapshot(p),before);
  }
  const noNonce=fresh("no-nonce-v"+version);delete noNonce.creation_request_id;
  denied(await direct(storyActor,{...noNonce,[marker]:"client-fake"},version),"guard rejects reserved key without nonce","22023");
  assert.equal(sql("SELECT count(*) FROM public.characters WHERE name="+literal(noNonce.name)),"0");
}
console.log("PASS I2J-G01 scratch guard rejects marker at both public ingresses, null/string and no nonce, atomic denial");
const gStory=fresh("guard-story");
const gid=succeeded(await create(storyActor,syntheticStory,gStory),"guard Story first");
const gBefore=snapshot(gStory);
denied(await direct(storyActor,augmented(gStory,syntheticStory)),"guard Story-first replay","22023");
assert.equal(succeeded(await create(storyActor,syntheticStory,gStory),"same Story replay"),gid);
denied(await create(storyActor,syntheticStory+" changed",gStory),"changed Story replay","22023");
assert.equal(snapshot(gStory),gBefore);
const gDirect=fresh("guard-direct");
const gDid=succeeded(await direct(storyActor,gDirect),"ordinary direct v3 preserved");
const gdBefore=snapshot(gDirect);
assert.equal(succeeded(await direct(storyActor,gDirect),"ordinary direct retry"),gDid);
denied(await create(storyActor,syntheticStory,gDirect),"ordinary direct-first cross API","22023");
assert.equal(snapshot(gDirect),gdBefore);
const gV2=fresh("guard-v2");
const gv2id=succeeded(await direct(storyActor,gV2,2),"ordinary direct v2 preserved");
const gv2before=snapshot(gV2);
assert.equal(succeeded(await direct(storyActor,gV2,2),"ordinary v2 replay"),gv2id);
assert.equal(snapshot(gV2),gv2before);
console.log("PASS I2J-G02 scratch guard preserves ordinary direct v2/v3 and Story same-intent replay, rejects changed/mixed intent");
const race=fresh("guard-race");
const [raceDirect,raceStory]=await Promise.all([direct(storyActor,augmented(race,syntheticStory)),create(storyActor,syntheticStory,race)]);
denied(raceDirect,"concurrent augmented direct with Story","22023");
const raceId=succeeded(raceStory,"concurrent Story succeeds");
assert.equal(storyCount(raceId),1);
assert.equal(recordCount("public.characters","creation_request_id="+literal(race.creation_request_id)),1);
assert.equal(recordCount("private.player_creation_intent_reservations_v1","request_id="+literal(race.creation_request_id)),1);
console.log("PASS I2J-G03 mixed concurrent requests yield only Story creation");
sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+literal(gid)+" AND user_id="+literal(storyActor.id));
const revokedBefore=snapshot(gStory);
denied(await create(storyActor,syntheticStory,gStory),"same JWT revoked Story replay","42501");
assert.equal(snapshot(gStory),revokedBefore);
console.log("PASS I2J-G04 current editor revocation remains effective");

// The ingress guard alone does not remediate existing ambiguous reservations.
if(!pendingResult.error){
  const pBefore=snapshot(pending);
  const old=await create(storyActor,syntheticStory,pending);
  if(old.error){
    denied(old,"pre-guard reservation adoption","22023");
    assert.equal(snapshot(pending),pBefore);
    console.log("I2J-RESIDUAL NOT REPRODUCED: old ambiguous reservation denied");
  }else{
    assert.equal(old.data,pendingResult.data);
    assert.equal(storyCount(old.data),1);
    assert.notEqual(snapshot(pending),pBefore);
    console.log("I2J-RESIDUAL REPRODUCED: ingress-only guard does not separate pre-existing ambiguous reservations");
  }
}
console.log("I2J MIXED API RESULT: bounded original characterization and scratch guard assertions complete; private SQL-role bridge and migration compatibility HOLD; NOT production release");
