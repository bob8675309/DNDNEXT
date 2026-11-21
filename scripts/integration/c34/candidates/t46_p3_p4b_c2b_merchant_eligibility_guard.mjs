#!/usr/bin/env node
// C34 T46-P3-P4B-C2-B2: local-PG17 ONLY SOURCE-DERIVED buyer guard.
// Do not import into application runtime, do not deploy or run on hosted PG.
// Preserve every byte of the original buy_from_merchant body after guard insertion.
import assert from "node:assert/strict";

export const ORIGINAL_BUYER_BLOB="72fd9f0f80a83adaec67caf80a762e238f1dcd8c";
export const ORIGINAL_BUYER_FUNCTION_MD5="1dbe8c24c4c718396d7256f6f7465354";

const ORIGINAL_ANCHOR="  buy_qty := greatest(coalesce(p_qty, 1), 1);";
const GUARDED_PREFACE="  -- C34 test-only eligibility decision: seller must be a visible,\n  -- enabled merchant. This FOR SHARE locks the seller state for the\n  -- duration of the existing locked stock + wallet purchase transaction.\n  -- No resting, camping, travel, town or location predicate is introduced:\n  -- roaming merchants' trade policy is UNDECIDED and requires the owner.\n  perform 1\n    from public.characters seller\n   where seller.id = p_merchant_id\n     and seller.kind = 'merchant'\n     and seller.is_hidden is not true\n     and seller.storefront_enabled is true\n   for share;\n\n  if not found then\n    raise exception 'Merchant unavailable' using errcode='42501';\n  end if;\n\n";

export function buildC2B2GuardedOriginalBuyer(original) {
 assert.equal(typeof original,"string");
 assert.ok(original.startsWith("-- Read-only source-original DnDWeb PG17.4 public.buy_from_merchant source."),
  "Refuse source-unspecified buyer SQL");
 assert.equal(original.split(ORIGINAL_ANCHOR).length,2,
  "Refuse missing/duplicated original buy_qty anchor");
 for(const marker of [
  "SECURITY DEFINER","SET search_path TO 'pg_catalog', 'public', 'private', 'auth'",
  "stock public.character_stock%rowtype;",
  "   for update;",
  "if cur_gp <> -1 and cur_gp < total then",
  "if cur_gp <> -1 then",
  "insert into public.player_recipes",
  "insert into public.inventory_items("
 ])assert.ok(original.includes(marker),"Refuse altered original buy source: "+marker);
 assert.ok(!original.includes("Merchant unavailable"),
  "Refuse already modified original buyer SQL");
 const derived=original.replace(ORIGINAL_ANCHOR,GUARDED_PREFACE+ORIGINAL_ANCHOR);
 assert.equal(derived.split("Merchant unavailable").length,2,
  "Seller eligibility must appear EXACTLY ONCE");
 assert.equal(derived.replace(GUARDED_PREFACE,""),original,
  "Guard must be the ONLY difference from original buyer SQL");
 const guardIndex=derived.indexOf("perform 1\n    from public.characters seller");
 const stockIndex=derived.indexOf("select * into stock");
 const recipeIndex=derived.indexOf("is_recipe := coalesce(");
 assert.ok(guardIndex>0&&stockIndex>guardIndex&&recipeIndex>stockIndex,
  "Lock seller eligibility BEFORE existing stock row lock");
 assert.ok(!GUARDED_PREFACE.includes("seller.state")&&!GUARDED_PREFACE.includes("seller.location_id"),
  "Do NOT decide traveling/camping/trading rules without owner");
 return derived;
}
