// C34-B10 source-pinned historical Oct16 bulk future-tech reroll contract.
// Operates ONLY on disposable SQL; never import into production or alter map.
import assert from "node:assert/strict";
import {sourceOriginalB9Reroll} from "./t46_p3_p4b_c2b9_reroll_source.mjs";
export function b10BulkSource(fileBytes){
  // B9 establishes immutable original Oct16 blob before extracting any SQL.
  sourceOriginalB9Reroll(fileBytes);
  const s=fileBytes.toString("utf8");
  const a=s.indexOf("CREATE OR REPLACE FUNCTION public.set_campaign_future_tech_enabled_v1(");
  const z=s.indexOf("\n$$;",a);
  assert.ok(a>0&&z>a,"B10 original bulk function source missing");
  const original=s.slice(a,z+4);
  assert.match(original,/PERFORM \* FROM public\.reroll_merchant_inventory_v2\(v_character\.id,v_theme,30\)/);
  assert.match(original,/WHERE storefront_enabled=true\s+ORDER BY name/);
  assert.match(original,/coalesce\(up\.role='admin',false\)/);
  const replace=(x,needle,repl)=>{
    assert.equal(x.split(needle).length,2,"B10 source boundary drift "+needle);
    return x.replace(needle,repl);
  };
  let candidate=replace(original,"SELECT coalesce(up.role='admin',false)",
      "SELECT coalesce(up.role IN ('admin','gm','dm'),false)");
  candidate=replace(candidate,"WHERE storefront_enabled=true\n    ORDER BY name",
      "WHERE storefront_enabled=true AND kind='merchant'\n    ORDER BY id");
  candidate=replace(candidate,
   "IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Only admins can change the campaign item pool'; END IF;",
   "IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Game manager required' USING ERRCODE='42501'; END IF;");
  assert.match(candidate,/ORDER BY id/);
  return {original,candidate};
}
