#!/usr/bin/env node
import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {makeT36Source} from "./prepare_t36_npcs_route.mjs";
import {makeT38R4ConvertOnlySource,T38_R4_LOCAL_ROUTE,T38_R4_MARKER,
 t38R4LocalOnly,T38_R4_CONFIRM} from "./prepare_t38_convert_only_npcs_route.mjs";
const read=p=>fs.readFileSync(path.join(process.cwd(),p),"utf8");
const gitBlob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
test("T38-R4 default-off candidate never changes real /npcs, map or Next rewrite",()=>{
 assert.equal(gitBlob(read("pages/npcs.js")),"7fc00b9b3ace6233d1648a3d017f8a05e072d722");
 assert.equal(fs.existsSync(path.join(process.cwd(),T38_R4_LOCAL_ROUTE)),false);
 assert.doesNotMatch(read("next.config.mjs"),/__c34_t38_convert_only/);
});
test("T38-R4 exact original KindPicker handler is moved once, not rewritten or duplicated",()=>{
 const baseline=makeT36Source();
 const result=makeT38R4ConvertOnlySource();
 const prefix="                          {canConvertKind ? (\n";
 const suffix="                          ) : null}";
 const closing=suffix+"\n                        </div>\n                      ) : null}\n                      metaLine={metaLine}";
 const start=baseline.indexOf(prefix),end=baseline.indexOf(closing,start);
 assert.ok(start>0&&end>start);
 const originalHandler=baseline.slice(start+prefix.length,end);
 const anchor="  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n\n";
 const header='<div className="h5 mb-1" data-testid="t25-selected-character" data-character-id={selected.id}>{selected.name}</div>';
 const expected=(baseline.slice(0,start)+"                          {t38R4ConversionPicker}"+
  baseline.slice(end+suffix.length))
  .replace(anchor,anchor+"  const t38R4ConversionPicker = canConvertKind ? (\n"+originalHandler+"  ) : null;\n\n")
  .replace(header,header+"\n"+
  "                    {!canEditCharacter && canConvertKind ? (\n"+
  '                      <div data-testid="t38-convert-only-control" '+T38_R4_MARKER+' className="d-inline-flex align-items-center gap-2">\n'+
  "                        {t38R4ConversionPicker}\n"+
  "                      </div>\n"+
  "                    ) : null}");
 assert.equal(result,expected);
 assert.equal(result.split("onChange={async (target) => {").length-1,1);
 assert.equal(result.split('data-c34-t38-r4="convert-only"').length-1,1);
 assert.match(result,/\.rpc\("set_character_kind"/);
 assert.match(result,/selectedPrivateResult\?\.dossier/);
});
test("T38-R4 signed source cannot be generated on production or unsigned hosts",()=>{
 const signed={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  C34_T38_R4_BROWSER_CONFIRM:T38_R4_CONFIRM,
  NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0",VERCEL:"0"};
 assert.equal(t38R4LocalOnly(signed),true);
 for(const [field,val] of [["PGHOST","hosted.supabase.co"],["CI","false"],
  ["VERCEL","1"],["NEXT_PUBLIC_C34_T36_NPCS_RESEARCH","1"],
  ["C34_T38_R4_BROWSER_CONFIRM","wrong"]])
  assert.throws(()=>t38R4LocalOnly({...signed,[field]:val}));
});
