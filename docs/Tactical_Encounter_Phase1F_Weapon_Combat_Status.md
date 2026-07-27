# Tactical Encounter Phase 1F — Equipped Weapon Combat Status

Last updated: 2026-07-27

This document extends `Tactical_Encounter_Combat_Roadmap_Blueprint.md`, the Phase 1 foundation ledger, and the Phase 1E core-combat status. Phase 1F replaces the Unarmed-Strike-only attack path with canonical equipped-weapon profiles while preserving the existing server-authoritative action and movement contracts.

## Status

**Implemented on feature branch, schema deployed, rollback-tested, permission-checked, and preview green.**

## Canonical weapon source

Phase 1F does not add a combat-only weapon catalog.

The server derives each usable weapon from:

- `inventory_items.is_equipped` as the canonical equipped-state flag;
- the existing optional `equip_slot` (`weapon_1`, `weapon_2`, `weapon_3`) for UI placement;
- the inventory row's `item_id`, `item_name`, `item_type`, and `card_payload`;
- `items_catalog.payload` as the canonical base weapon definition when a matching catalog item exists;
- character-sheet ability scores and proficiency bonus;
- the preferred class catalog's `starting_proficiencies.weapons` data;
- existing `character_permissions.can_edit` ownership for player-character inventory resolution.

Player characters may resolve equipped rows stored under `owner_type='player'` and the owning user id. NPC/merchant/character-owned rows resolve against the canonical character id. The server rebuilds the profile from the equipped row on every list/attack call; clients do not submit damage dice, range, proficiency, ability modifier, or magic bonus.

## Weapon profile contract

`encounter_equipped_weapon_profiles_v1` exposes supported equipped weapon profiles to the participant controller/admin.

Each profile contains:

- inventory item id and canonical item key;
- weapon name;
- base damage dice;
- damage type;
- selected attack ability and modifier;
- weapon proficiency state and proficiency contribution;
- magic/enhancement bonus when represented by canonical payload metadata;
- final attack bonus;
- melee reach;
- normal and long range;
- ranged / thrown / finesse flags;
- current equipment slot.

Current ability selection:

- ranged weapons use Dexterity;
- melee weapons use Strength;
- finesse melee/thrown weapons use Dexterity when Dexterity is higher than Strength.

Current proficiency selection uses the preferred class catalog's starting weapon proficiencies, including simple/martial categories and exact named entries where present.

## Weapon attack resolution

`encounter_weapon_attack_v1` is the first generic equipped-weapon attack RPC.

Server validation includes:

- active encounter and active participant;
- controller / character-edit permission;
- attacker and target are distinct, present, and not defeated;
- attacker still has an Action;
- selected inventory item is still equipped and still belongs to the participant's canonical inventory path;
- the equipped row still resolves to a supported weapon profile;
- melee reach;
- thrown normal/long range;
- ranged normal/long range.

Resolution includes:

- server d20 attack roll;
- weapon attack bonus from canonical ability + proficiency when proficient + magic bonus;
- natural 1 miss / natural 20 hit;
- Dodge disadvantage;
- long-range disadvantage;
- damage dice rolled server-side from canonical `dmg1`;
- critical hits double the number of damage dice;
- ability modifier and magic bonus applied to damage once;
- bludgeoning / piercing / slashing damage types normalized from catalog metadata;
- temporary HP consumed before current HP;
- 0 encounter HP marks the participant defeated;
- only the attacker's Action is spent;
- result and damage state remain encounter-local.

Request UUIDs use the existing command ledger, so retrying the same weapon attack cannot spend the Action twice, apply damage twice, or write a second combat-log entry.

## Combat UI

`/encounters/combat` now includes:

- equipped weapon selector for the active controlled participant;
- canonical damage, damage type, attack bonus, proficiency, reach/range, and magic-bonus readouts;
- long-range disadvantage warning;
- server-authoritative weapon attack submission;
- Unarmed Strike retained as a fallback when no supported weapon is equipped;
- existing Dash / Disengage / Dodge controls;
- target selection and distance readout;
- Realtime combat log including weapon damage/type summaries.

A player with no equipped supported weapon sees the inventory requirement instead of receiving a fabricated default weapon.

## Validation completed

The rollback weapon matrix used temporary equipped inventory rows and verified:

- the real player-owned inventory path through `character_permissions.can_edit`;
- three equipped weapons resolved from canonical catalog metadata;
- Fighter martial proficiency was detected;
- a +1 Longsword produced `1d8 slashing`, martial proficiency, +1 magic bonus, and the expected +8 attack bonus for the live test character;
- Dagger resolved finesse + thrown with 20/60 ft. range;
- Shortbow resolved ranged with 80/320 ft. range;
- long-range thrown attack imposed disadvantage and rolled two d20s;
- Shortbow at 30 ft. remained normal range;
- server attack results retained canonical weapon/damage metadata;
- repeating the same request UUID returned the same result without duplicate log/damage;
- unequipping the selected inventory row immediately caused the attack to be rejected;
- an unrelated authenticated user could not list another participant's weapon profiles;
- all temporary inventory/map/session/participant/command/log rows rolled back to zero.

Live postcheck verified:

- authenticated controllers can execute weapon-list and weapon-attack RPCs;
- anon cannot execute weapon attacks;
- authenticated clients cannot execute the internal weapon-profile builder;
- live inventory remains unchanged at 0 rows after rollback;
- encounter/session/command/combat-log test tables remain empty;
- world state remains 2 characters / 20 locations / 4 routes / 9 route points.

## Explicit non-goals still in force

Phase 1F does **not** yet implement:

- ammunition consumption or loading/reload rules;
- disadvantage for making a ranged attack while threatened at close range;
- versatile damage-die switching or explicit one-hand/two-hand mode selection;
- dual-wielding / Nick / Light-property bonus attacks;
- weapon mastery effects;
- magical weapon secondary damage/effects beyond a numeric weapon enhancement bonus;
- cover or line-of-sight enforcement;
- saving throws;
- opportunity attacks / reaction timing;
- resistance, immunity, vulnerability, or typed-damage mitigation;
- canonical character-sheet HP writeback;
- spells, spell slots, concentration, AoE templates, or class-resource spending;
- world-map movement or route changes.

## Next implementation slice

The next bounded slice should establish **visibility / cover / save foundations** before adding spell automation:

1. deterministic axial line tracing between attacker and target;
2. movement/LOS object semantics separated cleanly;
3. hard LOS blocking from `blocks_los` objects;
4. half / three-quarters cover representation and AC/save modifiers;
5. basic server-authoritative ability saving throws;
6. generic damage application with resistance/immunity/vulnerability hooks;
7. reaction/opportunity-attack timing after visibility and generic damage are stable;
8. spell targeting and spell-resource spending only after those primitives are reliable.
