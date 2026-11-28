// Reuses C3F's loopback esbuild + Playwright architecture with a joined host.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync,readFileSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { installMountedLifecycleReads } from "./i2j_mounted_lifecycle_reads.mjs";

const creationRpc="create_player_character_with_private_backstory_v1";
const levelRpc="complete_character_level_up_v5";
const pact="optional-feature:pact-of-the-blade|XPHB";

export class MountedLifecycle {
  constructor({sql,email,password,actorId}) {
    this.sql=sql;
    this.credentials={email,password};
    this.actorId=actorId;
    this.errors=[];
    this.offsite=[];
    this.failedReads=[];
    this.transportErrors=[];
    this.writes=[];
    this.levels=[];
  }

  async start(draft) {
    const env=process.env;
    assert.equal(env.DNDNEXT_I2J_MOUNTED_LIFECYCLE,"DISPOSABLE_I1H_BROWSER_ONLY");
    assert.equal(env.GITHUB_ACTIONS,"true");
    assert.equal(env.DNDNEXT_I1G_LOCAL_URL,"http://127.0.0.1:55621");
    const origin=env.DNDNEXT_I1G_LOCAL_URL;
    assert.ok(env.DNDNEXT_I1G_LOCAL_ANON_KEY);
    const root=env.C33_BROWSER_TOOL_ROOT;
    const chrome=env.C33_BROWSER_CHROME;
    assert.ok(root&&path.isAbsolute(root)&&chrome&&path.isAbsolute(chrome));
    const {chromium}=createRequire(path.join(root,"i2j-playwright-anchor.cjs"))("playwright-core");
    this.temp=mkdtempSync(path.join(tmpdir(),"dndnext-i2j-mounted-"));
    const output=path.join(this.temp,"lifecycle.js");
    execFileSync(path.join(root,"node_modules",".bin","esbuild"),[
      "scripts/browser/i2j_mounted_lifecycle_dom.jsx","--bundle","--platform=browser","--format=iife",
      "--jsx=automatic","--loader:.js=jsx","--target=chrome120","--log-level=error",
      '--define:process.env.NODE_ENV="production"',
      "--define:process.env.NEXT_PUBLIC_SUPABASE_URL="+JSON.stringify(origin),
      "--define:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="+JSON.stringify(env.DNDNEXT_I1G_LOCAL_ANON_KEY),
      "--outfile="+output,
    ],{stdio:"pipe",timeout:120000});
    const js=readFileSync(output);
    this.server=createServer((req,res)=>{
      if(req.url==="/"){
        res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
        res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>I2J mounted lifecycle</title><div id="i2j-root"></div><script src="/lifecycle.js"></script></html>');
      } else if(req.url==="/lifecycle.js") {
        res.writeHead(200,{"Content-Type":"application/javascript"});res.end(js);
      } else {
        res.writeHead(404).end();
      }
    });
    await new Promise(resolve=>this.server.listen(0,"127.0.0.1",resolve));
    const base="http://127.0.0.1:"+this.server.address().port;
    this.browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
    const context=await this.browser.newContext({viewport:{width:1560,height:1080}});
    await context.addInitScript(value=>localStorage.setItem("dndnext:player-character-forge:draft:v1:i2j-mounted-lifecycle",JSON.stringify(value)),draft);
    this.page=await context.newPage();
    this.page.setDefaultTimeout(14000);
    this.page.on("pageerror",error=>this.errors.push(error.message));
    this.page.on("requestfailed",request=>{
      const address=new URL(request.url());
      if(address.origin===origin) this.transportErrors.push(address.pathname+" "+request.failure()?.errorText);
    });
    this.page.on("request",request=>{
      const name=new URL(request.url()).pathname.split("/rpc/")[1];
      if(name===creationRpc || name?.startsWith("complete_character_level_up_") || name==="update_character_spell_use_v1"){
        this.writes.push(name);
      }
    });
    this.page.on("response",response=>{
      const address=new URL(response.url());
      if(address.origin===origin && response.status()>=400){
        this.failedReads.push(response.status()+" "+address.pathname);
      }
    });
    await this.page.route("**/*",async route=>{
      const address=new URL(route.request().url());
      if(address.origin===base||address.origin===origin) await route.continue();
      else { this.offsite.push(address.origin); await route.abort(); }
    });
    await this.page.goto(base);
    await this.page.waitForFunction(()=>Boolean(window.i2jMounted));
    assert.equal(await this.page.evaluate(({email,password})=>window.i2jMounted.login(email,password),this.credentials),this.actorId);
  }

  async create({payload,story,stock,merchantId}) {
    installMountedLifecycleReads(this.sql);
    const portraitId="00000000-0000-0000-0000-000000009914";
    const speciesId="00000000-0000-0000-0000-000000009911";
    const backgroundId=payload.sheet.startingEquipmentSelections.backgroundId;
    const classId="6792abd0-1fd9-44fb-ae4c-56c307ab791a";
    this.sql(`UPDATE public.character_option_catalog SET metadata=
      '{"abilities":["int","wis","cha"],"skills":[{"animal handling":true},{"persuasion":true}],"feats":[{"Lucky":true}],"equipment":[]}',
      raw_payload='{"feats":[{"Lucky":true}],"skillProficiencies":[{"animal handling":true},{"persuasion":true}],"toolProficiencies":[{"navigator\u0027s tools":true}]}'
       WHERE id='${backgroundId}'`.replace("navigator's tools","navigator''s tools"));
    await this.start({
      version:1,
      controller:{step:0,draft:{
        creationRequestId:payload.creation_request_id,name:payload.name,role:"Warlock",level:1,
        kind:"npc",speciesOptionId:speciesId,backgroundOptionId:backgroundId,classOptionId:classId,
        speciesKey:"dwarf",customBackground:"Merchant",classKey:"warlock",abilityMethod:"standard",
        baseAbilities:{str:8,dex:13,con:12,int:10,wis:14,cha:15},
        speciesBonus:{mode:"twoOne",plusTwo:"cha",plusOne:"wis",plusOnes:[],featId:""},
        selectedClassSkills:["deception","intimidation"],
        startingEquipment:{mode:"market",ruleset:"vanilla",marketMerchantId:merchantId,marketPurchases:[]},
        backgroundNarrative:"",secret:"",
        portraitLibraryId:portraitId,portraitName:"C3F Dwarf Fixture Portrait",
        portraitUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
        portraitSource:"library",
      }},
      choices:{
        species:{speciesId,speciesName:"Dwarf",rules:[],selections:{}},
        class:{classId,classKey:"warlock",className:"Warlock",classSource:"XPHB",
          level:1,options:[],catalogReady:true,selectedKey:"",featureGroups:[],featureSelections:{},featureCatalogReady:true},
        source:{draftVersion:3,selections:{},defaultedGroups:{}},
      },
    });
    const page=this.page;
    const modal=page.locator(".npc-forge-modal-v2.is-player-mode");
    await modal.waitFor({state:"visible"});
    const nav=modal.locator(".npc-forge-steps button");
    assert.equal(await nav.count(),10);
    const steps=["Species","Background","Class","Abilities","Training","Spells","Equipment","Identity","Story","Review"];
    for(const [index,step] of steps.slice(0,-1).entries()){
      try {
        assert.match(await modal.locator(".npc-forge-steps button.is-current").innerText(),new RegExp(step));
        if(step==="Species"){
          const field=modal.locator('.npc-forge-species-fact-choice[data-icon-kind="languages"]');
          if(!await field.evaluate(el=>el.open))await field.locator("summary").click();
          await field.locator("select").nth(0).selectOption({label:"Dwarvish"});
          await field.locator("select").nth(1).selectOption({label:"Elvish"});
        }
        if(step==="Training"){
          const choices=modal.locator(".npc-forge-training-feat-section");
          if(!await choices.evaluate(el=>el.open))await choices.locator(":scope > summary").click();
          const invocation=choices.locator(".npc-forge-class-option-group").filter({
            has:page.locator("summary strong").filter({hasText:/^Eldritch Invocation 1$/}),
          });
          await invocation.waitFor({state:"visible"});
          if(!await invocation.evaluate(el=>el.open))await invocation.locator(":scope > summary").click();
          const pactOption=invocation.getByRole("button",{name:/Pact of the Blade/});
          await pactOption.click();
          await modal.locator(".npc-forge-training-context-dossier").getByRole("button",{name:"Select",exact:true}).click();
          await pactOption.filter({hasText:"Selected"}).waitFor();
        }
        if(step==="Spells"){
          for(const name of ["Eldritch Blast","Poison Spray","Warlock specimen 1","Warlock specimen 2"]){
            await modal.locator(".npc-forge-spell-table-row").filter({hasText:name}).locator("button.npc-forge-spell-row-status").click();
          }
        }
        if(step==="Equipment"){
          await modal.getByRole("button",{name:/Add to Starting Cart/}).click();
        }
        if(step==="Story"){
          await modal.locator(".npc-forge-step-story label").filter({hasText:"Private backstory (creator and GM only)"}).locator("textarea").fill(story);
        }
        await modal.getByRole("button",{name:"Continue",exact:true}).click();
        await modal.locator(".npc-forge-steps button.is-current").filter({hasText:steps[index+1]}).waitFor();
      }catch(error){
        const guidance=await modal.locator(".npc-forge-error,[data-forge-validation-message]").evaluateAll(nodes=>
          nodes.map(node=>node.dataset.forgeValidationMessage||node.textContent.trim()));
        throw Error("Forge "+step+" failed (reads "+JSON.stringify(this.failedReads)+", guidance "+JSON.stringify(guidance)+"): "+error.message);
      }
    }
    let response;
    try{
      [response]=await Promise.all([
        this.response(creationRpc),
        modal.getByRole("button",{name:"Create Player Character",exact:true}).click(),
      ]);
    }catch(error){
      throw Error("Forge Review sent no Story write (UI "+JSON.stringify(await modal.locator(".npc-forge-error").allTextContents())
        +", reads "+JSON.stringify(this.failedReads)+", browser "+JSON.stringify(this.errors)+"): "+error.message);
    }
    const request=response.request().postDataJSON();
    const data=await response.json();
    assert.ok(response.ok(),JSON.stringify(data));
    await page.waitForFunction(()=>Boolean(window.i2jMounted.created?.id));
    const created=await page.evaluate(()=>window.i2jMounted.created);
    assert.equal(typeof data==="string"?data:data.id,created.id);
    assert.equal(request.p_payload.creation_request_id,payload.creation_request_id);
    assert.equal(request.p_private_backstory,story);
    assert.equal(request.p_payload.sheet.sourceChoices["warlock-invocation-slot-1"].fields.invocation.selections[0].key,pact);
    assert.ok(request.p_payload.sheet.featGrantInstances.some(row=>row.name==="Lucky" && row.acquisitionOwnerType==="background"));
    assert.equal(request.p_payload.sheet.startingEquipmentSelections.marketPurchases[0].stockId,stock);
    assert.equal(request.p_magic_selections.filter(row=>row.source_type==="class").length,4);
    this.characterId=created.id;
    console.log("::notice title=Mounted Story Forge::MOUNT-01 passed. Chromium traversed the ten hydrated Forge steps and submitted the real signed Story RPC.");
    return {data:created.id,error:null,request};
  }

  response(name) {
    return this.page.waitForResponse(response=>new URL(response.url()).pathname==="/rest/v1/rpc/"+name && response.request().method()==="POST");
  }

  async chooseRich(field,label) {
    await field.locator(".npc-forge-rich-choice__list button").filter({hasText:label}).click();
    await field.getByRole("button",{name:"Choose",exact:true}).click();
  }

  async advance(id,session,level,reference) {
    assert.equal(id,this.characterId);
    const page=this.page;
    const review=await page.evaluate(id=>window.i2jMounted.advance(id),id);
    assert.equal(review.session.id,session);
    assert.equal(review.preview.toLevel,level);
    assert.equal(review.canComplete,true);
    const form=page.locator(".level-up-choice-form");
    const button=form.getByRole("button",{name:"Apply Level "+level,exact:true});
    const groups=form.locator(".npc-forge-source-choice-group");
    const group=label=>groups.filter({has:page.locator("header strong").filter({hasText:new RegExp("^"+label+"$")})});
    const field=(container,label)=>container.locator(".npc-forge-source-choice-field").filter({hasText:label});
    if(level===2){
      const second=group("Eldritch Invocation 2");
      const third=group("Eldritch Invocation 3");
      await second.waitFor();
      const before=this.writes.length;
      await button.click();
      await form.locator(".alert-danger").filter({hasText:/complete every|required|choose exactly/i}).waitFor();
      assert.equal(this.writes.length,before,"An incomplete mounted draft sent a level-up write");
      await this.chooseRich(field(second,"Invocation 2"),"Lessons of the First Ones");
      await this.chooseRich(field(second,"Origin feat"),"Magic Initiate");
      await this.chooseRich(field(third,"Invocation 3"),"Lessons of the First Ones");
      await this.chooseRich(field(third,"Origin feat"),"Skilled");
      await form.getByRole("button",{name:"Wizard",exact:true}).click();
      await form.getByRole("button",{name:"Intelligence",exact:true}).click();
      for(const name of ["Wizard specimen 1","Wizard specimen 2","Wizard specimen 3"]){
        await form.locator(".npc-forge-source-spell-picker__row").filter({hasText:name}).locator("button").click();
      }
      const skills=field(form,"Choose three skills or tools");
      for(const name of ["Arcana","Athletics","Perception"]){
        await this.chooseRich(skills,name);
      }
    }else{
      const replacement=group("Replace an Eldritch Invocation");
      // The original getter orders the two same-label instances by slot key.
      await field(replacement,"Invocation to replace").getByRole("button",{name:/Lessons of the First Ones/}).first().click();
      await this.chooseRich(field(replacement,"New Invocation"),"Armor of Shadows");
      await form.locator("select").filter({has:page.locator("option").filter({hasText:"Fiend • XPHB"})}).selectOption({label:"Fiend • XPHB"});
    }
    await form.locator(".level-up-spell-main").filter({hasText:"Warlock specimen "+(level===2?3:4)}).click();
    const [response]=await Promise.all([this.response(levelRpc),button.click()]);
    const data=await response.json();
    assert.ok(response.ok(),JSON.stringify(data));
    await page.waitForFunction(()=>Boolean(window.i2jMounted.completed));
    assert.deepEqual(await page.evaluate(()=>window.i2jMounted.completed),data);
    const request=response.request().postDataJSON();
    assert.equal(request.p_character_id,id);
    const selection=request.p_selections;
    assert.deepEqual(selection.class_choice_selections,reference.class_choice_selections);
    assert.deepEqual(selection.spell_choices.map(row=>row.spell_id),reference.spell_choices.map(row=>row.spell_id));
    if(level===2){
      const shape=rows=>rows.map(row=>[row.acquisitionOwnerKey,row.optionId]).sort();
      assert.deepEqual(shape(selection.class_option_feat_instances),shape(reference.class_option_feat_instances));
      const magic=selection.class_option_feat_instances.find(row=>row.name==="Magic Initiate");
      assert.equal(magic.choices["spell-list"][0].value,"Wizard");
      assert.equal(magic.choices["spellcasting-ability"][0].value,"int");
      assert.equal(magic.choices["cantrips-wizard"].length,2);
      assert.equal(magic.choices["level-1-wizard"].length,1);
    }else{
      assert.equal(selection.subclass_name,"Fiend");
      assert.equal(selection.subclass_source,"XPHB");
    }
    this.levels.push(level);
    assert.ok(!this.writes.some(name=>name==="complete_character_level_up_v3"||name==="complete_character_level_up_v4"));
    console.log("::notice title=Mounted signed v5::MOUNT-"+(level===2?"02":"04")+" passed. Browser v5 submitted level "+level+" on the Forge-created ID with matching source-owned selections.");
    return {data,error:null};
  }

  async spend(id,assignment) {
    assert.equal(id,this.characterId);
    const [response,result]=await Promise.all([
      this.response("update_character_spell_use_v1"),
      this.page.evaluate(({id,assignment})=>window.i2jMounted.spend(id,assignment),{id,assignment}),
    ]);
    assert.ok(response.ok(),JSON.stringify(result.error));
    assert.equal(response.request().postDataJSON().p_assignment_id,assignment);
    console.log("::notice title=Mounted signed resource::MOUNT-03 passed. Same browser and character spent the limited-use assignment by ID.");
    return result;
  }

  verify() {
    assert.deepEqual(this.levels,[2,3]);
    assert.deepEqual(this.writes,[creationRpc,levelRpc,"update_character_spell_use_v1",levelRpc]);
    assert.deepEqual(this.errors,[]);
    assert.deepEqual(this.offsite,[]);
    assert.deepEqual(this.failedReads,[]);
    assert.deepEqual(this.transportErrors,[]);
    console.log("::notice title=Mounted browser isolation::MOUNT-05 passed. No failed loopback reads, transport errors, uncaught browser errors, external requests or v4/v3 writes.");
  }

  async close() {
    if(this.browser)await this.browser.close();
    if(this.server)await new Promise(resolve=>this.server.close(resolve));
    if(this.temp)rmSync(this.temp,{recursive:true,force:true});
  }
}
