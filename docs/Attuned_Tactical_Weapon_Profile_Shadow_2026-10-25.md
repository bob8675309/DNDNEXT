# Attunement: tactical weapon attack and damage shadow (2026-10-25)

**Draft only. No production migration, attack writer replacement, encounter HP mutation, or gameplay output change.**

## Existing authoritative weapon math

The latest source-controlled `public.encounter_weapon_profile_internal_v1(participant_id,inventory_item_id)` is defined in `sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql`. It validates equipped item ownership and weapon profile, merges catalog item payload with instance card payload (instance wins), uses the canonical character equipment/combat snapshot's effective STR and DEX modifiers, determines weapon proficiency from the class catalog, chooses STR/DEX according to ranged/finesse properties, and computes:
- `magicBonus`: first non-null `bonusWeapon`, `bonus_weapon`, `enhancement_bonus`, or `smith_tier`;
- `attackBonus = abilityMod + proficiencyBonus (if proficient) + magicBonus`.

The live tactical writer `public.encounter_weapon_attack_v1` consumes the returned profile to add `attackBonus` to the d20 and `abilityMod + magicBonus` to the damage dice. Weapon source effects cannot be separated correctly by simply subtracting an item bonus from a precomputed attack number; finesse can change which ability is best after unselected ability-boosting items are filtered.

The player-facing character sheet has an independent JavaScript action builder in `utils/characterSheetActions.js` with class features, pact/Hexblade ability and rage damage. The tactical profile does **not** yet contain the full player sheet's class exceptions. This draft is a *tactical profile shadow only*, not player-sheet parity.

## New private comparison

`private.encounter_attuned_weapon_profile_shadow_v1(participant_id,inventory_id)` first calls the **unchanged** original tactical profile and character ability source gate. When campaign attunement is OFF, `shadow === baseline` exactly. When ON, it recalculates melee, finesse and ranged attacks using only the eligible STR/DEX bonuses returned by the previous ability shadow, the original verified proficiency, and eligible `bonusWeapon`/`bonus_weapon`/`enhancement_bonus` from the *same exact equipped inventory item*.

A source with no trusted magic selection may still be used as a physical weapon: its damage dice, type, reach, range, finesse/thrown status, and inventory slot remain unchanged. Only the separate direct magical weapon bonus is suppressed. `smith_tier` is explicitly **unclassified** because smithing/tempering is a campaign physical-crafting subsystem. The function **preserves that legacy bonus** rather than incorrectly assuming smith-tiers require magic attunement, but reports a specific unresolved channel.

The shadow provides `baselineFlatDamageBonus` and `shadowFlatDamageBonus` as comparisons (the writer uses `greatest(0, rolledDamage+abilityMod+magicBonus)`). No dice are rolled, no random effect is triggered, and no encounter participants, HP, initiative, action availability, logs or snapshots change.

**Every ON result declares `weaponSourceParityReady=false`, `fullEffectConsumerParityReady=false`, and `consumerEnforced=false`.** Combat remains on the original handler.

## Disposable PostgreSQL16 verification

The isolated test composes the existing production-shaped inventory and character selection fixtures, real canonical equipment resolver, and the **exact** `20260801_04` snapshot + weapon profile definitions. A byte-equality source validator ensures those original SQL definitions were not quietly simplified. Test cases use:
- a catalog-backed +2 Longsword with STR-based physical attack/damage;
- a +1 Longbow retaining 1d8 Piercing, range 150/600 and selected/unselected magical to-hit/damage;
- a mundane finesse Rapier, with ability choice recalculated when STR/Dex source eligibility changes;
- a crafted/tempered Maul with `smith_tier: 2` preserved and marked unresolved;
- an unknown rare weapon claiming +5, suppressed when its identity is not verified;
- account-shared magic Longsword selected by one character, explicitly excluded from another's magical bonus;
- an unequipped source that cannot create a tactical profile.

OFF must preserve the original canonical JSON *exactly*. The tests also confirm the attack writer continues consuming `attackBonus` and `abilityMod + magicBonus`.

## Outstanding release blockers

- Current tactical combat snapshots are a separate lifecycle; character equipment/ability changes must not silently recompute or rewrite active encounters.
- Player character-sheet weapon actions have independent class feature, Rage, pact-weapon, mastery and other special behavior. Those paths need source-level parity before the optional restriction can be activated.
- Physical-vs-magical provenance for smith_tier, unusual weapon source fields, crafted materials, catalog/VAR instances, bonus dice and damage riders must be resolved without double counting. Do not treat `rarity` or `smith_tier` as proof a rider requires attunement.
- Spell attack/DC and spell save consumers, verified rest authorization, and shared-account physical custody are not yet complete.
- Live signed-in browser and battle-board regression checks are needed; existing dashboard readiness flags remain false.

No world or town map changes. No Forge, character-card art, equipment slots, inventory trading, production database or combat writer changes.
