#!/usr/bin/env node
// C34 T38-P2-R4: local-only conversion control sourced from original KindPicker.
// This module NEVER writes a production route or modifies the original manager.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {makeT36Source} from "./prepare_t36_npcs_route.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
export const T38_R4_LOCAL_ROUTE="pages/__c34_t38_convert_only.jsx";
export const T38_R4_CONFIRM="SIGNED_CONVERT_ONLY_UI_PG17_LOCAL_ONLY";
export const T38_R4_MARKER='data-c34-t38-r4="convert-only"';
const one=(s,fragment,label)=>assert.equal(s.split(fragment).length-1,1,"T38-R4 exact original source drift "+label);
export function makeT38R4ConvertOnlySource(){
 let code=makeT36Source();
 const open="                          {canConvertKind ? (\n";
 const suffix="                          ) : null}";
 const boundary=suffix+"\n                        </div>\n                      ) : null}\n                      metaLine={metaLine}";
 one(code,open,"KindPicker open");
 one(code,boundary,"KindPicker closing");
 const start=code.indexOf(open),end=code.indexOf(boundary,start);
 assert.ok(start>0&&end>start);
 const inner=code.slice(start+open.length,end);
 assert.match(inner,/<KindPicker/);
 assert.match(inner,/onChange=\{async \(target\) => \{/);
 assert.match(inner,/\.rpc\("set_character_kind"/);
 // The FULL original conversion handler is moved, without editing it, into
 // one JSX value; neither call path can diverge from original conversion.
 code=code.slice(0,start)+"                          {t38R4ConversionPicker}"+
  code.slice(end+suffix.length);
 const anchor="  const canEditNarrative = canEditCharacter && !!sheetEditMode;\n\n";
 one(code,anchor,"selected editor authorization");
 code=code.replace(anchor,anchor+
  "  const t38R4ConversionPicker = canConvertKind ? (\n"+inner+
  "  ) : null;\n\n");
 const header='<div className="h5 mb-1" data-testid="t25-selected-character" data-character-id={selected.id}>{selected.name}</div>';
 one(code,header,"public selected Profile heading");
 code=code.replace(header,header+"\n"+
  "                    {!canEditCharacter && canConvertKind ? (\n"+
  '                      <div data-testid="t38-convert-only-control" '+T38_R4_MARKER+' className="d-inline-flex align-items-center gap-2">\n'+
  "                        {t38R4ConversionPicker}\n"+
  "                      </div>\n"+
  "                    ) : null}");
 assert.equal((code.match(/onChange=\{async \(target\) => \{/g)||[]).length,1);
 assert.match(code,/canConvertKind = !!userId && \(!!isAdmin \|\| !!selectedCharPerm.can_convert\)/);
 assert.match(code,/canEditCharacter = !!userId && \(!!isAdmin \|\| !!selectedCharPerm.can_edit\)/);
 return code;
}
export function t38R4LocalOnly(env=process.env){
 const exact={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  C34_T38_R4_BROWSER_CONFIRM:T38_R4_CONFIRM,
  NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"};
 for(const [key,val] of Object.entries(exact))
  assert.equal(env[key],val,"T38-R4 refuses hosted/unsigned source "+key);
 assert.notEqual(env.VERCEL,"1");
 return true;
}
export function reconcileT38R4Route(env=process.env,{prepare=false,cleanup=false}={}){
 t38R4LocalOnly(env);
 const file=path.join(root,T38_R4_LOCAL_ROUTE);
 const source=makeT38R4ConvertOnlySource();
 if(cleanup){
  if(!fs.existsSync(file))return false;
  assert.equal(fs.readFileSync(file,"utf8"),source,"T38-R4 refuse deleting unknown page");
  fs.unlinkSync(file);return false;
 }
 assert.ok(prepare,"T38-R4 explicit signed prepare only");
 assert.ok(!fs.existsSync(file),"T38-R4 refuse overwrite");
 fs.writeFileSync(file,source,{flag:"wx",mode:0o600});
 return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],"--verify");
 assert.match(makeT38R4ConvertOnlySource(),/t38-convert-only-control/);
 assert.equal(fs.existsSync(path.join(root,T38_R4_LOCAL_ROUTE)),false);
 console.log("PASS T38-R4-SOURCE: original KindPicker handler reused exactly; hosted/default route unchanged");
}
