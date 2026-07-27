# Tactical Encounter Phase 1I — Spell Foundation Status

Status: **FOUNDATION + FIRST CASTING SLICE DEPLOYED / VALIDATED**

This ledger covers the bounded tactical spellcasting work after Phase 1H reactions/effects. Phase 1I began with canonical caster/slot state and now includes the first deliberately narrow server-authoritative casting adapters.

## Phase 1I-A/B — canonical caster and spell-slot foundation

Status: **DEPLOYED / VALIDATED**

The foundation establishes:

- a canonical caster profile derived from the participant's existing character progression, class progression, character sheet, and Known spell assignments;
- an encounter-local spell-slot snapshot initialized when a participant is staged into an encounter.

### Canonical caster profile

`public.encounter_spellcasting_profile_v1(participant_id)` resolves the participant through existing tactical authorization and returns:

- exact assigned class ID/source/ruleset and character level;
- canonical casting ability and ability score;
- proficiency bonus from `class_level_progression`;
- default spell attack bonus and spell save DC;
- canonical class slot progression for the current level;
- encounter-local remaining slot state;
- the character's actual `character_spells` assignments, including prepared/always-available flags and per-assignment overrides.

The profile follows the class version already stored in `character_progression`; it does not silently swap a character to another source version during combat.

### Encounter-local spell-slot snapshot

`public.encounter_spell_slots` stores one row per participant, slot pool, and slot level. The snapshot is created from the exact `class_catalog` + `class_level_progression` row assigned to that character.

Important behavior:

- normal spellcasting uses the canonical slot array from `class_level_progression`;
- Pact Magic uses a separate `pact_magic` pool key;
- initialization inserts missing rows only and does not refill an existing partially spent snapshot;
- authenticated clients can read only slot rows for participants they can control;
- authenticated clients cannot directly insert, update, or delete slot rows;
- the canonical character spellbook and class progression tables are not mutated.

### Foundation deployment and validation

Production migration:

- `20260727225258 tactical_spell_foundation`

Source/preview checkpoint:

- branch `phase1i-spell-foundation`;
- preview and final `main` deployment green at commit `e0b647bb86321baf9c9917d1fb5b228ed6bc0e50`.

Observed contracts:

- current Artificer level 2 resolved from its assigned class source and received exactly two level-1 slots;
- INT 15 resolved to a +2 casting modifier;
- proficiency +2 produced spell attack +4 and spell save DC 12;
- current Fighter produced no spell-slot rows and reported `isClassCaster=false`;
- changing the Artificer snapshot to 1/2 remaining and rerunning the initializer left it at 1/2;
- pre-deploy and post-deploy behavior tests completed inside rollback transactions and left no test encounters, participants, or slot rows;
- the protected production baseline remained 2 characters, 20 locations, 4 world routes, and 9 route points.

Post-deploy privilege checks confirm authenticated users have SELECT-only slot-table access through participant-control RLS. The public profile RPC is intentionally callable by authenticated users but performs `encounter_can_control_participant_v1` authorization internally before returning the profile.

## Phase 1I-C — first guarded spell_cast contract

Status: **DEPLOYED / VALIDATED**

Production migration:

- `20260727230924 tactical_spell_casting_slice`

Source migration:

- `sql/20260727_13_tactical_spell_casting_slice.sql`

Preview checkpoint:

- branch `phase1i-casting-slice`;
- Vercel preview green at commit `46ea5dbce08750bf3484509fa45e06b75bb604fa` before production migration application.

The first casting RPC is intentionally not a generic spell interpreter. `public.encounter_cast_spell_v1(...)` recognizes exactly two reviewed XPHB class-spell adapters:

- **Fire Bolt** — single-creature ranged spell attack, cantrip scaling, LOS, cover AC, Dodge disadvantage, critical dice, typed Fire damage, and no spell-slot use;
- **Cure Wounds** — prepared/always-available leveled spell, touch-range healing, 2024 `2d8` base healing plus casting modifier, supported upcast dice, and one authoritative spell-slot spend.

All other spells remain GM-assisted/manual in this slice.

### Cast authority and resource rules

The guarded `spell_cast` command requires:

- the participant's active turn;
- caller control of the caster;
- an assignment from that character's actual `character_spells` spellbook;
- `source_type='class'` for this first automation slice;
- the reviewed XPHB version of an explicitly approved spell;
- prepared or always-available state for a leveled spell;
- a canonical casting ability/profile;
- a legal target, LOS, and adapter-specific range;
- a remaining encounter-local slot for leveled casting;
- an available Action.

The command is request-ID idempotent. A successful leveled cast decrements the encounter slot and spends the Action in the same server transaction. Failed validation spends neither. Duplicate replay returns the stored result and cannot heal, damage, or spend a slot twice.

`encounter_spell_slots` is now part of the Supabase Realtime publication so player spell-resource state can be refreshed from authoritative database changes without client-side slot accounting.

### Conservative fallback rules

Fire Bolt remains GM-assisted instead of auto-resolving when:

- a hostile creature is adjacent to the caster, because the broader close-quarters ranged-attack state is not yet modeled completely;
- caster or target has an active encounter condition that could alter attack resolution;
- the target is hidden from the caller;
- any unsupported spell source/grant type or multi-pool slot ambiguity is involved.

This is deliberate: unsupported edge cases should fail closed into GM-assisted play rather than silently apply an incomplete D&D rule.

### Post-deploy transactional validation

The deployed RPC was exercised with a synthetic authenticated controller identity inside a production rollback transaction.

Verified behavior:

- the authenticated identity could control only the participant assigned to its `controller_user_id`;
- hidden targets were rejected before resource consumption and left no command request behind;
- Fire Bolt with an active condition on caster/target fell back instead of applying incomplete attack-modifier rules;
- Fire Bolt while a hostile participant was adjacent fell back and spent no Action;
- normal Fire Bolt spent the Action but no spell slot;
- Fire Bolt duplicate replay returned the stored result without a second attack/damage application;
- unprepared Cure Wounds was rejected and spent neither Action nor slot;
- after the same assignment was marked prepared, Cure Wounds healed once, spent exactly one level-1 slot, and spent the Action;
- Cure Wounds duplicate replay neither healed again nor spent another slot;
- slot Realtime publication was present;
- the complete test transaction rolled back successfully.

Post-rollback production counts were then checked separately: `character_spells`, encounter maps/sessions/participants/commands/logs/conditions, and encounter spell-slot rows were all zero. The protected world baseline remained **2 characters, 20 locations, 4 world routes, and 9 route points**.

The live `encounter_command_requests` constraint includes `spell_cast`. The live RPC is executable by `authenticated` and `service_role`, not `anon`.

### Advisor review

The security advisor reports the generic warning that authenticated users can execute the SECURITY DEFINER `encounter_cast_spell_v1` RPC. This exposure is intentional: the function is the guarded authority boundary and performs active-turn, controller, spellbook, prepared-state, hidden-target, range/LOS, Action, and slot validation internally. An authenticated-controller rollback test verified those checks rather than relying on service-role behavior.

The performance advisor did not report a new missing foreign-key index for `encounter_spell_slots`. It continues to report pre-existing encounter FK/RLS optimization opportunities and marks the slot source-class index as unused while production encounter/slot tables are empty. Those notices remain separate behavior-neutral hardening work rather than part of spellcasting semantics.

The source validator rejects world/town coupling, anonymous casting, canonical spellbook/catalog mutation, and accidental expansion of the approved spell whitelist.

## Isolation guardrail

Phase 1I migrations are tactical-only. They contain no world-map route, travel advancement, town-map, weather, camp, or world-simulation behavior.

The world-map and town/city-map systems remain behaviorally unchanged.

## Explicitly deferred

The following remain outside the first `spell_cast` slice:

- Healing Word and other Bonus Action spells;
- Sacred Flame and other save-based spells;
- concentration and repeated saves;
- AoE, lines, cones, persistent areas, and point targeting;
- reaction spells;
- summoned creatures;
- teleportation and forced movement;
- item/feat/background-granted spell-resource semantics;
- complex condition-driven attack advantage/disadvantage;
- multiclass/multiple spell-slot-pool selection.

The next bounded step is a narrow combat UI that reads `encounter_spellcasting_profile_v1`, shows only the two approved automated spells when they are actually in the character's Known spellbook, displays authoritative slot state, and calls `encounter_cast_spell_v1`. Unsupported spells remain available through the existing spellbook/GM-assisted flow rather than being misrepresented as automated.
