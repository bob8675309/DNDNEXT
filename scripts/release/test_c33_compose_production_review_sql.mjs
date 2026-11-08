#!/usr/bin/env node
// Static only: no connected app, Postgres, Supabase or deployment calls.
import assert from "node:assert/strict";
import {composeReview} from "./c33_compose_production_review_sql.mjs";
const {sql,sources,protectedTables}=composeReview();
assert.equal(sources.length,4);
assert.equal(protectedTables.length,21);
assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
assert.match(sql,/source does not record or verify an external backup/i);
assert.match(sql,/private\.test_admins/);
assert.match(sql,/6ba73e6f12fcf826cc0a739cce45ff40/);
assert.match(sql,/deca87aaad0dce214743c87cdca03f36/);
assert.match(sql,/source stage 4/i);
assert.match(sql,/storage\.objects/);
assert.match(sql,/existing_secret_count/);
assert.match(sql,/character_backstory_secrets/);
assert.match(sql,/inventory_items_owner_type_chk/);
for(let i=0;i<protectedTables.length;i++)assert.ok(sql.includes("before.h"+i+" IS DISTINCT FROM after.h"+i),"Missing protected table "+i);
for(const token of ["CREATE TEMP TABLE c33_release_protected_before","NOTIFY pgrst","ALTER POLICY inventory_items_insert_owner_or_admin","REVOKE SELECT ("])assert.ok(sql.includes(token),"Missing stage content "+token);
assert.ok(!/^\s*DROP\s+TABLE\b/im.test(sql));
console.log("PASS C3REL02: original source-locked four-stage production-target draft contains 21 immutable-data checks, GM-secret and Storage metadata checks; NO SQL executed");
