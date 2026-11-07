# Tactical spell adapter preservation gate — 2026-11-07

**Research-only.** This gate protects the 19 already deployed *2024 XPHB, class-source* tactical adapters from accidental removal when future shared spell-recipe work is extracted. It does **not** execute spells, query Supabase, call the application, evaluate recipes, create encounters, spend slots, grant permissions, or change runtime/gameplay.

## Inspect and run

```sh
node scripts/validate_tactical_spell_preservation.mjs
node scripts/test_tactical_spell_preservation.mjs
```

The source-qualified, manually reviewed inventory lives in `scripts/data/tactical_spell_preservation_20261107.json`. Each row records one canonical `spell-key|xphb`, mechanics family, reviewed exception, combat UI path, currently dispatched public RPC, original SQL owner, server and UI source validator, Phase 1I–1Z ledger, transaction/rollback provenance, named persisted-smoke evidence or `unconfirmed`, and an explicit review gap. The manifest is evidence metadata—not a catalog import or an executable recipe.

The gate requires exact equality between the 19-source whitelist and the manifest, confirms the class-owned XPHB eligibility filter, checks guarded dispatch for each specialized and versioned single-target route, original public SQL function and spell-key presence, original validator registration, and the owning phase ledger. It requires **48** existing tactical validator registrations and preserves the archived failing #299 receipt. Temporary negative-control tests remove a spell, corrupt a route/SQL signature and falsely mark #299 green; each must fail. All checks are deterministic and filesystem-only.

**Important limits:** A source validator checking a token or RPC name is not a PostgreSQL test or true Auth/role/browser acceptance. Source-original SQL presence is not confirmation that production function text has remained identical; the dated 2026-11-07 read-only live SQL audit is in [Deployed Tactical Spell Effects and Smoke Recovery](Deployed_Tactical_Spell_Effects_Smoke_Recovery_2026-11-07.md). No original production database query is executed by this checker, and CI is not evidence of a current live-function fingerprint. Later functionality changes require refreshed live SELECT-only evidence and dedicated disposable PG17/GoTrue tests.

## Historical negative and positive evidence (retained, not regenerated)

- Historical durable smoke: once observed at Round 6/version 63 in owner browser; **resolved Round 6/version 64** in the 2026-11-07 read-only database inspection. The resolved encounter had four participants, 18 log records, 46 command requests and eight `spell_cast` events. **Six** spells were explicitly named in the recorded examples: Fire Bolt, Sacred Flame, False Life, Magic Missile, Acid Splash and Healing Word. That is *not* eight different validated spells or a 19-spell present-day browser run.
- All Phase 1I–1Z adapter ledgers record transactional rollback testing at their own historical checkpoints. This does not mean those casts persisted in the original smoke encounter. **Lightning Bolt** originally required a level-eligible temporary caster inside a rolled-back test: no legitimate persistent caster at rollout. **Vicious Mockery** hearing-only targeting and **Magic Missile** Shield-reaction interaction remain GM-assisted.
- Archived #294 source-original helper/atomic research checks **PASSED** ([roll/damage](https://github.com/bob8675309/DNDNEXT/actions/runs/40628231333), [atomic](https://github.com/bob8675309/DNDNEXT/actions/runs/40628231209)), but remain experimental. Archived #299 terminal head `c73075d92ca9361dc05bc901d2d6652a33ef857a` had **two failed PG16 fixtures** ([40801549016](https://github.com/bob8675309/DNDNEXT/actions/runs/40801549016), [40801549033](https://github.com/bob8675309/DNDNEXT/actions/runs/40801549033)): `record "v_a" has no field "controller_user_id"`. Retain both facts; do not infer a production combat failure or falsely declare the whole archived chain green.
- Held [#309](https://github.com/bob8675309/DNDNEXT/pull/309) P1 schema and [#312](https://github.com/bob8675309/DNDNEXT/pull/312) P2 shadow remain research-only. Their source/CI is not imported and this manifest never grants runtime authority. No generic interpreter is deployed.

## Review and future drift handling

A failed check is an evidence/contract mismatch to investigate; it is **not** permission to regenerate the inventory from an arbitrary new UI key. Compare the original SQL, phase ledger, modern server owners and relevant signed-in or rollback fixtures; update the source-qualified review and manifest together only after human source review. New supported spells or changed route families require a separately reviewed scope increase and fresh Auth/slot/effect/visibility acceptance. Keep the source/SQL/effect and test evidence tiers separate.

**Release gate:** review the branch diff and exact-head CI; leave as an isolated draft until explicitly approved. No production SQL, RLS, grants, cast requests, protected map, Vercel release or paid model/agent actions were performed by this research.
