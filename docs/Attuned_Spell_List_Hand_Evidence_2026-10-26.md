# Spell Catalogue Class-List and Hand Occupancy Evidence — 2026-10-26

**Draft-only / private read-only diagnostic. No runtime spell or item effect is activated.**

## Newly verified source data

A read-only live Supabase query confirms that `public.spells_catalog.classes` is a `text[]` class-list field. The exact `eldritch-blast|PHB` and `eldritch-blast|XPHB` catalogue rows both list `Warlock`. This establishes useful **catalogue membership evidence** unavailable to previous drafts, which relied only on `character_spells.source_label` and `character_progression`.

That evidence is narrower than proving the character acquired the spell *from that class*: copied/imported, item-granted, multiclass, subclass, background and granted spells require their own authoritative acquisition sources. A character's class label matching the catalogue class list does not prove grant legitimacy or its applicability to a particular spellcasting focus.

Live read-only inventory inspection confirms `equip_slot` strings including `weapon_1`, `weapon_2`, `weapon_3`, `off_hand`, `body` and accessory slots. No separate public equipped-state source that proves an item is **actively held during a cast** was established in the inspected tables. Do not equate `is_equipped` or `equip_slot` to active hands.

## New private read-only source evidence

`private.encounter_attuned_spell_list_hand_evidence_v1(participant_id,assignment_id)` composes #284's trusted character/assignment and focus provenance shadow.

When the optional campaign rule is OFF it leaves the original baseline untouched and reports no attunement enforcement. When ON:

- Verifies exact character-owned spell assignment and joins **that spell's exact catalogue ID**, checking `spells_catalog.classes` with case-normalized class identity. Distinguishes class-list present, absent, not matching, assignment label mismatch, progression ambiguity and item-granted/nonclass assignment. Returns `catalog_lists_class_but_grant_unverified` even when all source labels agree; **`classGrantVerified=false` remains mandatory**.
- Enumerates **all equipped inventory sources** for `main_hand` and `off_hand` through the trusted per-character gate—not merely magic focuses. Identifies two distinct items claiming the same named hand slot; marks shared-account custody as unresolved. This detects contradictory records but does not decide which item is physically held during execution.
- Reports equipped magic focus items in `weapon_N` slots as ambiguous. Weapon slots are not automatically mapped to hands, and no hand state is written or invented.
- Preserves physical equipment, target, spell assignment, known spells and all encounter slot snapshots. No casting writer, persistent slot bridge, UI or live combat consumer calls this private comparison.

**Readiness remains false:** `activeHandsVerified=false`, `classGrantVerified=false`, `multiclassSourceVerified=false`, `focusStackingVerified=false`, `focusBonusApplied=false`, `consumerEnforced=false`.

## Test cases

Isolated PostgreSQL 16 fixture includes the exact prior character/spell/focus branches, then models the real live `spells_catalog.classes text[]` column. Cases assert:

- OFF exact inert status; no required ON source data.
- XPHB Eldritch Blast catalogue listing Warlock; catalogue match does **not** establish a class spell grant.
- The same spell catalogue source not listing Wizard, then updated to list Wizard—neither case establishes actual grant proof.
- Empty class list and an item-granted class-labeled spell are not accepted as verified class acquisitions.
- Sacred Flame not on the fixture's Warlock list is detected despite its Warlock-labeled assignment.
- A Rod in `weapon_1` still does not establish active held state.
- Rod and Wand in distinct explicit hand slots are merely **candidates**, not proof. Two items placed in `main_hand` are flagged as a collision.
- An account-owned item placed in `off_hand` is explicitly flagged for unresolved shared physical custody.
- No slot spending, profile sync, spell casting, equipment transfers or writes by the new function.
- Anonymous/authenticated database roles have no direct EXECUTE grant; only service-role access.

## Next implementation and release gates

This is a useful new source-quality check, not the promised **authoritative active held/worn state** or class acquisition validator. The next bounded design should establish server-authenticated **per-encounter held/worn item evidence** (including how the Equipment Manager maps its weapon slots to active hands), a transactional lifecycle on unequip/transfer/combat start, and a source/progression grant ledger for each spell. Any new persistent model must receive a separate reviewed migration, RLS plan and rollback strategy and be tested against live-equivalent geometry/slots and signed-in action flows before enabling focus effects.

Continue to treat #266 rest activity and #267→#285 optional attunement as drafts. All consumer/readiness flags stay false. No production Supabase migration, player sheet, combat writer, active spell-slot snapshot, world/town map, crafting or UI art modified.
