# P2 — Delegated NPC Tactical Spell Profile: Scoped Visibility Candidate

_1 November 2026 · held draft #312 only, stacked on held draft #309. This is a **proposed conservative policy**, not an owner-approved disclosure decision or production change._

## Decision that prompted the work

The existing `public.encounter_spellcasting_profile_v1` returns **every character spell assignment**, including unknown or unprepared spells, after `encounter_can_control_participant_v1` passes. A newly assigned companion controller may therefore see a larger spell inventory than the GM intended. The owner wants players to control their own PCs plus individually assigned NPC pets, familiars, sidekicks, and henchmen, while Admin controls access from the NPC panel, without granting source-sheet or inventory rights.

Current `pages/encounters/combat.js` consumes `className`, `classLevel`, attack and save numbers, slot snapshot and `knownSpells`. It currently lists unsupported assigned spells under “GM-assisted.” `utils/tacticalKnownSpellAssignments.mjs` filters explicit `known:false` but the existing profile omits that field. Thus only hiding unprepared rows in the browser would be insecure, and blindly showing all rows breaks least-privilege.

## Held production-derived SQL candidate (NOT installed)

`sql/candidates/20261101_npc_spell_profile_visibility_candidate.sql` contains the **exact current production profile function body** copied read-only, originally MD5 `e4d6eac7759720b05af0de9dc6c6fc4e`, renamed to private `encounter_spellcasting_profile_full_candidate_v1` with authenticated/anonymous direct EXECUTE revoked. A proposed public `encounter_spellcasting_profile_v1` wrapper:

1. Rechecks the signed-in user's actual encounter authority via the server `encounter_can_control_participant_v1`. Deny unauthorized callers before fetching profile data.
2. Preserves the **exact existing unfiltered profile** for the Admin, service role, a direct encounter `controller_user_id`, and anyone who already has private source-character read permission (legacy edit/inventory/convert). This avoids changing existing PC and established controller behavior.
3. Only if the caller has **delegation-only** `can_control` for a genuine NPC/merchant, projects the profile to attack bonus, save DC, casting ability, class and proficiency level, remaining/max slots and **known, currently prepared/always-available spells plus known cantrips**. Both `known` and prepared flags are confirmed against the authoritative `character_spells` row. This does **not** assert every shown spell is automated, legal, or castable with existing slots. Unsupported spells remain GM-assisted.
4. Deliberately omits the full character sheet, extra class progression metadata, canonical slot progression source details, unlearned spells and unprepared leveled spells from the delegation-only response. Adds `visibilityScope='delegated-combat'` and `spellListFiltered=true` only to the restricted shape. No hidden total/spell count is returned.
5. Does **not** edit or grant `character_spells`, source read permissions, combat command RPCs, row policies, persistence, or any `known/prepared` state. Profile visibility never authorizes casting; each cast remains server-authoritative and existing replay/locking weaknesses must be resolved separately.

There is **no new permanent public RPC**: this is a held replacement proposal of the existing `encounter_spellcasting_profile_v1`. Direct access to the private full profile is revoked in the candidate, preventing a straightforward bypass. Revalidate the live original function MD5 before any future review. The original metadata fields copied from production are *not* recommendations to broaden access.

## What the UI changes (also held)

The only companion-aware UI adjustment in `pages/encounters/combat.js` makes the disclosure scope clear:
- Delegation-only: “combat-ready spells available to this controller; other assigned spells remain GM-private.”
- Existing PC/Admin/direct controller: previous total assigned spell count.
- Both: count the reviewed tactical adapters independently. Unsupported rules explicitly remain GM-assisted.

No map, town, Forge, NPC character sheet or Player Character builder changes are authorized or made here. The Admin NPC grant UI in the previous research remains held with its required SQL migration.

## Actual SQL and signed JWT acceptance

`scripts/fixtures/npc_spell_profile_source_shape_pg17.sql` adds the minimum production columns required to **execute the exact production-derived full-profile body** in disposable local GoTrue/PostgREST, inserts five companion spell assignments with deliberately distinct statuses, imports the held wrapper, and checks private-vs-public execution grants.

`scripts/test_npc_delegated_control_local_auth.mjs` checks with three genuine JWTs:
- Before grant, both players must be denied the NPC's entire tactical spell profile.
- Admin and an existing direct-PC controller retain all original assignments and original response shape.
- After Admin grants, both delegation-only controllers receive Fire Bolt (known cantrip), Shield (known prepared leveled spell), Light (known available cantrip), **not** an unprepared secret spell or unknown spell. Their response lacks class/source progression metadata and hidden spell-count clues.
- Revoking one controller denies their profile even with their unchanged valid JWT, while the other still gets the filtered profile.
- The existing true-JWT Action race, cached replay isolation, source-sheet RLS and hidden NPC token tests continue unmodified.

Source regression: `scripts/validate_npc_tactical_spell_profile_p2.mjs`, executed in free CI. This tests the research candidate against a **minimal local source-shaped schema**, not a complete production database or actual browser test.

## Exact future release gates / owner choice

**The GM must approve or adjust the proposed default**: should delegation-only NPC controllers see only known/ready spells, or the full assigned list? A house-rule or creature-specific override might eventually require a versioned GM visibility policy. Do not simply reinterpret `prepared` as proof of spell legality (slot, source, condition, Action and other constraints still apply). Preserve existing direct controllers' behavior unless there is a separately approved change.

Even after a green local JWT test, production readiness still requires reconciling other definer read endpoints, complete public command-ledger replay security, uniform lock order, one-character-in-two-active-encounters resource rules, and a reviewed SQL+UI migration/rollback and browser acceptance. No production database write, column, grant, migration, live test user or deployment is authorized.

**Single next engineering task after exact-head CI:** check all existing profile consumers/other read RPCs for visibility bypasses and formulate a safe all-RPC staged rollout/rollback contract. Keep PR #312 draft.
