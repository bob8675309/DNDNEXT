# C34 T41 — Original Barbarian Rage Rest and linked legacy-account mirror (signed research ACCEPTED; release HOLD)

**Local date:** November 18, 2026 America/Chicago (signed workflow completed November 19 UTC).  
**Research branch:** [draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112`.  
**Exact successfully executed code SHA:** `cf0a0af1196eaa6b5f343dc390dcc33f792a4b60`.  
**Full real signed local PostgreSQL 17 / GoTrue / PostgREST / Next / Chromium:** [workflow #44448307415](https://github.com/bob8675309/DNDNEXT/actions/runs/44448307415), [job #135305761624](https://github.com/bob8675309/DNDNEXT/actions/runs/44448307415/job/135305761624) — **SUCCESS**.  
**Exact source-workflow:** [#44448307255](https://github.com/bob8675309/DNDNEXT/actions/runs/44448307255) — **SUCCESS**.

## Source custody and historical evidence

- **Original source, unchanged:** `sql/20260810_90_rest_class_feature_restoration.sql` Git blob `2bd48d73398a3e9095b61ee288c0377d464edfc6`. Deployed-original source function MD5 identities previously read from Supabase metadata: `private.restore_character_rest_action_state_v1(uuid,text)` = `d75edf2ac583e3790882155c702e2165`, `public.complete_character_rest_v1(uuid,text)` = `fffbf0705d640a7d2bfb08aa78ad521a`.
- The public Rest orchestrator calls `private.sync_character_spell_slots_v1`, restores spell slots and spell limited uses, calls the private Rage action-state Rest helper, then inserts `public.character_rest_log`, subject to the original active-encounter Rest-log veto; returned profile is supplied by `private.character_sheet_resource_profile_json_v1`.
- The private Rage Rest helper correctly persists only the target character's canonical `character_sheets.sheet`, **then blindly projects its full Sheet into ALL linked `public.players.sheet` account rows with `can_edit`**, without proving those account historical snapshots correspond to the target. The separate standalone Rage action's similar mirror was proven in T40; **the T40 action correction did not repair this Rest writer**.
- **Prior distinct original proof was reused:** held [PR #364](https://github.com/bob8675309/DNDNEXT/pull/364), actual `scripts/test_i1p_earned_rest_local_auth.mjs` and source fixture `scripts/fixtures/i1p_original_rest_shared_p13_pg17.sql` Git blob `039868c4ac5cdd62e0efc1e46f584df2bdc34a9c`. Its earlier signed Short Rest RED and narrower same-legacy-account mirror-identity GREEN are historical evidence; that correction is **not** the owner-approved new Option A freeze and lacked the full encounter/resource matrix.
- `sql/20260802_03_character_sheet_spell_resources.sql` Git blob `f96a3788334fe306374dfd4b5fdf4e00992d3924` and `sql/20260802_06_character_resource_active_encounter_lock.sql` blob `be7844fe16b14b73f4fb03f68069f9eb0af3dbf8` remain unchanged. The signed fixture restores the source-original active-encounter trigger, not an invented veto.

## First executed strict RED and corrected original helper

The **first T41 full signed run** [#44446454969](https://github.com/bob8675309/DNDNEXT/actions/runs/44446454969) at `5a2712343cd0e4ff7d18f0ec8323f8da8081273e` passed **all T1–T40 inherited signed checks** and T41 source-only 4/4, but stopped BEFORE T41's new behavioral cases when its source fingerprint guard found `private.character_sheet_resource_profile_json_v1` `pg_get_functiondef` MD5 `2aec356b4b64c48efa8b0594e37a7126`, rather than the deployed-original `2c798f8351282d80e63ab8e9e9019272`. The August 2 repository resource helper has an earlier source body and cannot truthfully be called identical to the later deployed version.

**Bounded correction:** Copy only the exact original `pg_get_functiondef` body from #364 into new `scripts/integration/c34/fixtures/t41_original_live_rest_resource_profile_pg17.sql` Git blob `1c1278f22396ee5805dd0e70c02d9ebcbc0f4388`; require local PG17 and the C34 scratch schema, immutable fixture blob and deployed-original MD5. No original historical source, Rest class math, public Rest orchestrator, grants, gameplay source, shared tests or production metadata changed. The strict original fingerprints remain enforced. Source-only T41 test suite now passes **5/5**.

## Full signed execution — concrete log assertions

`PASS T41-ORIGINAL-SOURCE`: original function fingerprints, original resource and guard helpers, authenticated public Rest / denied anon; private helper denied direct client execution.

`PASS T41-ORIGINAL-NEGATIVES`: outsider, anonymous and invalid Rest type denied; historical account, canonical Sheet and log unchanged.

`PASS T41-ORIGINAL-SIGNED-RED`: genuine signed GM XPHB Barbarian Short Rest increments Rage remaining 0→1 and writes one Rest log, **but overwrites both separate independently populated owner/coeditor historical account Sheets** with the canonical target Sheet; other canonical characters are unchanged.

`PASS T41-OPTION-A-SOURCE`: after original RED, install **separate, expressly NON-ORIGINAL** private Rest helper with ONLY the full linked-account `UPDATE public.players` clause omitted in disposable PG17. Original public Rest function MD5 and public/anonymous/private RPC authorization boundaries preserved.

`PASS T41-OPTION-A-XPHB`: independent signed owner/coeditor Short Rests grant +1 used Rage each; Long Rest restores all; actions deactivate after rest; original Rest logs and both frozen legacy account histories preserved.

`PASS T41-OPTION-A-PHB`: PHB Barbarian Short Rest does not restore Rage; Long Rest refills; original active-state clearing and historical account preservation pass.

`PASS T41-OPTION-A-RESOURCES`: non-Barbarian Wizard Short Rest restores short-recharge spell limited uses without refilling long-recharge spell slots; Long Rest restores slots; canonical non-Barbarian Sheet and frozen historical account unchanged.

`PASS T41-OPTION-A-ENCOUNTER`: **original** active-encounter Rest-log `BEFORE INSERT` trigger rejects active combat Rest with SQLSTATE 55000 and rolls back the earlier in-transaction Rage canonical update and log. After the scratch encounter ends, Rest succeeds.

`PASS T41-OPTION-A-REVOKE`: linked editor permission revocation takes effect on the *same signed JWT*, outsider remains denied, other permitted editor can still Rest, and all independently seeded historical account snapshots stay unchanged.

All prior original T1–T38/R5 source browser/merchant/RLS tests, accepted T39 Weapon Mastery RED/GREEN and T40 standalone Rage RED/GREEN ran unchanged in the same successful workflow.

## Exact code boundaries and remaining release gates

New research-only files:
- `scripts/integration/c34/test_t41_rest_action_signed_pg17.mjs`
- `scripts/integration/c34/test_t41_rest_action_legacy_mirror_source.mjs`
- `scripts/integration/c34/fixtures/t41_original_live_rest_resource_profile_pg17.sql`

The pre-existing workflows `.github/workflows/validate-c34-joint-local-auth.yml` and `.github/workflows/validate-c34-joint-source-research.yml` were extended additively. No source migration or application route was edited; the candidate is dynamically installed **inside disposable local PostgreSQL only**.

**Limitations:** signed Rest is an RPC test, not a clicked original Sheet & Rolls Rest UI acceptance; class progression and spell items are synthetic local source-shaped specimens, not real signed Barbarian/Wizard Forge creation with all production content. This test does not establish complete hosted RLS, full production concurrency, actual existing user-sheet damage, 31-trigger application release or permission-recovery fidelity. Although the prior 29/31 non-map original Forge source-trigger fixture co-resides in C34, the two world-map triggers remain intentionally excluded.

**Owner policy remains authoritative:** canonical character data is in `character_sheets`; existing account `players.sheet` history is frozen under Option A. **Do not change the global 22/34 unresolved writer gate** without complete per-writer original/consumer cutover proof. No production SQL/select query on user data, schema change, RLS, Storage, main merge, world-map modification, Vercel release, paid agent or scheduled automation was performed. Full original PR feature preservation, later role/browser/rollback integration, independent encrypted PostgreSQL restoration **plus all 340 Storage objects** and owner release go/no-go remain open.

**ONE NEXT BOUNDED T42 TASK:** source-pin and cross-check one different unresolved legacy Sheet writer, initially `private.apply_additional_level_class_choices_v1` (Nov 11 historical census MD5 `c847b3656b1f006f4020d2b23f73efcc`), its current source and exact earned-level UI→RPC→private helper graph. First compare existing I1-P/other signed evidence so accepted work is not repeated; then, only if genuinely unproved, add a tightly scoped original RED and separately labeled scratch Option A GREEN with full inherited tests. No automatic merge or production change.
