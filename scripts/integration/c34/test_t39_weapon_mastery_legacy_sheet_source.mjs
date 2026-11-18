#!/usr/bin/env node
// T39: research-only SOURCE characterization of an original historical
// cross-account players.sheet mirror. Passing tests demonstrate the original
// risky source still exists; they DO NOT constitute an actual database RED,
// a hardened migration, a permission release, or production acceptance.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sqlPath = path.join(root, "sql/20260808_45_runtime_weapon_mastery.sql");
const originalBlob = "8c270f53de4eaf076cbf13b0d42b64eb811e8d90";
const sourceBuf = fs.readFileSync(sqlPath);
const source = sourceBuf.toString("utf8");
const gitBlob = crypto.createHash("sha1")
  .update(Buffer.concat([Buffer.from("blob " + sourceBuf.length + "\0"), sourceBuf]))
  .digest("hex");

function configureFunction(sql) {
  const start = sql.indexOf("create or replace function public.configure_character_weapon_mastery_v1(");
  assert.notEqual(start, -1, "T39 exact original configure function must exist");
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start, "T39 source-original function body must terminate exactly");
  return sql.slice(start, end);
}

const permission = /if not private\.can_manage_character_progression_v1\(p_character_id\) then/i;
const rowLock = /select \* into v_progression from public\.character_progression where character_id=p_character_id for update;/i;
const runtimeState = /insert into public\.character_runtime_feature_choices\(character_id,feature_key/i;
const canonicalRead = /select coalesce\(sheet,'\{\}'::jsonb\) into v_sheet from public\.character_sheets where character_id=p_character_id for update;/i;
const canonicalWrite = /update public\.character_sheets set sheet=v_sheet,updated_at=now\(\) where character_id=p_character_id;/i;
const accountMirror = /update public\.players p set sheet=v_sheet,updated_at=now\(\)\s+where p\.user_id in\(select cp\.user_id from public\.character_permissions cp where cp\.character_id=p_character_id\);/i;

function auditOriginal(sql) {
  const body = configureFunction(sql);
  for (const [name, anchor] of Object.entries({
    permission, rowLock, runtimeState, canonicalRead, canonicalWrite, accountMirror,
    noOp: /if v_changed_existing=0 and v_old_count=v_capacity then return public\.get_character_weapon_mastery_v1\(p_character_id\); end if;/i,
    oneReplacement: /if v_changed_existing>1 then raise exception/i,
    longRest: /v_latest_long_rest<=v_runtime\.replacement_anchor_at/i,
  })) assert.match(body, anchor, "T39 original source contract drift: " + name);
  return body;
}

test("T39-S01 source-original Weapon Mastery SQL remains Git-blob pinned", () => {
  assert.equal(gitBlob, originalBlob);
  assert.match(source, /grant execute on function public\.configure_character_weapon_mastery_v1\(uuid,uuid\[\]\) to authenticated,service_role;/i);
});

test("T39-S02 original runtime and per-character projection retain their source authority", () => {
  const body = auditOriginal(source);
  assert.match(body, /v_sheet:=jsonb_set\(v_sheet,'\{weaponMasteries\}',v_names,true\);/i);
  assert.match(body, /v_sheet:=jsonb_set\(v_sheet,'\{meta,weaponMasteries\}',v_names,true\);/i);
  assert.match(body, /where character_id=p_character_id;/i);
});

test("T39-S03 original mirrors the FULL canonical sheet into ALL linked account snapshots (known source risk, not runtime exploit proof)", () => {
  const body = auditOriginal(source);
  const mirror = body.match(accountMirror)?.[0];
  assert.ok(mirror, "the known original legacy writer must be source-identified");
  assert.doesNotMatch(mirror, /\bp\.character_id\b|\bp\.sheet\s*=|\/\*\s*character.scope/i);
  assert.match(mirror, /public\.character_permissions/);
  assert.match(mirror, /cp\.character_id=p_character_id/);
  // Even a narrowly authorized call targets every cp.user_id for the character;
  // no legacy account snapshot-to-character identity check appears here.
  // A signed two-character/two-account PostgreSQL regression is REQUIRED next.
});

test("T39-N01 baseline source may not silently lose its known mirror during an audit", () => {
  const mutated = source.replace(accountMirror, "-- mirror intentionally deleted in-memory");
  assert.notEqual(mutated, source);
  assert.throws(() => auditOriginal(mutated), /source contract drift: accountMirror/);
});

test("T39-N02 original canonical target scoping cannot be changed to an unscoped update", () => {
  const mutated = source.replace(
    "update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;",
    "update public.character_sheets set sheet=v_sheet,updated_at=now();"
  );
  assert.notEqual(mutated, source);
  assert.throws(() => auditOriginal(mutated), /source contract drift: canonicalWrite/);
});

test("T39-N03 historical authorization and per-character row lock cannot disappear unnoticed", () => {
  for (const anchor of [permission, rowLock]) {
    // The GET function above repeats this permission guard. Only mutate the
    // configure-function suffix so the negative targets the actual writer.
    const configureStart = source.indexOf("create or replace function public.configure_character_weapon_mastery_v1(");
    const mutated = source.slice(0, configureStart)
      + source.slice(configureStart).replace(anchor, "-- removed in-memory");
    assert.notEqual(mutated, source);
    assert.throws(() => auditOriginal(mutated), /source contract drift/);
  }
});

test("T39-N04 source no-op and rest cadence must be preserved in any future Option A candidate", () => {
  for (const anchor of [
    /if v_changed_existing=0 and v_old_count=v_capacity then return public\.get_character_weapon_mastery_v1\(p_character_id\); end if;/i,
    /v_latest_long_rest<=v_runtime\.replacement_anchor_at/i,
  ]) {
    const mutated = source.replace(anchor, "-- removed in-memory");
    assert.notEqual(mutated, source);
    assert.throws(() => auditOriginal(mutated), /source contract drift/);
  }
});
