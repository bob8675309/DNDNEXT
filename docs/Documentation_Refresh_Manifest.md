# Documentation Refresh Manifest

Updated: 2026-08-08

## Purpose

This manifest identifies the current documentation authority for DNDNext while active subsystem branches move faster than the older platform-wide roadmap. Current repository source and live Supabase remain higher-trust than historical prose.

## Authoritative starting points

For general platform/tactical history:

1. `Current_Development_Status_and_Roadmap.md`
2. `README.md`
3. the active subsystem or tactical phase ledger
4. current repository source and validators
5. live Supabase schema and migration history

For active Character Forge / progression PR #170, read these branch documents before older platform-wide Forge text:

1. `Unified_Character_Forge_Status.md` — current shared NPC/player Forge state and remaining blockers.
2. `Character_Progression_Foundation.md` — creation/progression architecture and normalized authority boundaries.
3. `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
4. `Character_Progression_and_Higher_Level_Forge.md` — higher-level replay / earned-progression convergence.
5. `Wizard_Spell_Mastery_Runtime_Status.md` — migration-44 Wizard runtime evidence.
6. `Player_Forge_Starting_Magic_v3_Status.md` — migrations-47/48 Spell-step authority.
7. `Player_Forge_Starting_Equipment_Status.md` — migrations-49/51 starting equipment, higher-level wealth, and character-scoped currency authority.
8. `Astral_Trance_Runtime_Status.md` — migrations-52/54 AAG Astral Trance Long-Rest runtime authority.
9. `DNDNext_Current_Handoff_Prompt.md` — copy-ready takeover prompt.

If these documents conflict with the Character Forge/progression section of `Current_Development_Status_and_Roadmap.md`, the PR #170 documents control until the broader roadmap receives a full cross-system rewrite.

## August 8 Character Forge / progression checkpoint

Production includes:

- Battle Master normalized maneuver authority and earned/Forge progression — migrations 38-39;
- Wizard Savant earned progression and higher-level Forge chronology — 40-41;
- Wizard Signature Spells and explicit free-cast resource labels — 42-43;
- Wizard Spell Mastery Long-Rest runtime configuration — 44;
- class-granted Weapon Mastery Long-Rest runtime authority — 45;
- per-instance Weapon Master feat runtime weapon authority and combined projection — 46;
- guarded multi-source Player Forge starting-magic v3 completion — 47;
- authenticated-only Player Forge v3 ACL cleanup — 48;
- source-backed starting equipment, higher-level wealth, and character-scoped currency — 49;
- starting-equipment Background/d10 tamper guard + currency RLS — 50;
- character-scoped starter-equipment projection correction — 51;
- Astral Trance Long-Rest runtime proficiency authority — 52;
- Astral Trance multiword skill-key correction — 53;
- Astral Elf normalized eligibility correction — 54.

## Creation / progression / runtime split

Persistent decisions still follow creation/progression parity. Rest-configurable and per-use features are not frozen into Forge state.

Current examples:

- Savant / Signature → persistent spellbook/progression state;
- Spell Mastery → runtime Long-Rest state;
- class Weapon Mastery → runtime Long-Rest state;
- Weapon Master feat current weapon → per-grant runtime Long-Rest state;
- Player Forge starting magic → server-authoritative creation state through v3;
- starting equipment → canonical character-owned inventory rows;
- starting/higher-level cash → character-scoped copper balance;
- Astral Trance → runtime skill + weapon/tool proficiency pair that expires at the next Long Rest;
- Steps of the Fey → per-use choice, not a rest/persistent Forge choice.

## Starting magic — migrations 47-48

The shared Player Forge calls `create_player_character_v3` and serializes exact `startingMagicSelections` for native class-list spells, Background-expanded class access, Eldritch Knight, and Arcane Trickster including fixed Mage Hand.

Species/feat/class-feature grants remain separate source-owned systems.

Rollback proofs covered native Wizard, non-native Background-expanded Wizard Entangle, Eldritch Knight, Arcane Trickster, and fail-closed invalid submissions. Migration 48 removed the stale explicit anonymous execute grant from v3.

## Starting equipment / currency — migrations 49-51

The Player Forge includes a player-only Equipment step between Spells and Identity. NPC step order is unchanged.

Class packages are restored for the 12 XPHB core classes plus EFA Artificer. XPHB Background equipment uses existing imported metadata. Generic item selectors are server-validated against canonical `items_catalog`.

Concrete starter gear is created as `inventory_items(owner_type='character', owner_id=<character uuid>)` and starts unequipped. Character money is stored in `character_currency`; `player_wallets` is not used.

Normal class + Background equipment remains the base at every starting level. Higher-level cash is additive. Higher-level magic-item quantities remain a DM guide only and are not auto-granted.

Rollback proofs covered concrete gear, cash-only packages, category selectors, Wizard Spellbook resolution, higher-level d10 wealth, and fail-closed tampering. See `Player_Forge_Starting_Equipment_Status.md`.

## Astral Trance — migrations 52-54

AAG Astral Elf Astral Trance is now a sheet-side Long-Rest runtime feature, not a Character Forge choice.

After a completed Long Rest, an eligible character chooses:

- one of all 18 skills; and
- one source-legal PHB-equivalent weapon or tool proficiency.

The pair is stored in `character_runtime_feature_choices` and projected under `sheet.runtimeProficiencies.astralTrance`. Permanent skill/tool/weapon proficiency fields are not rewritten.

At the next Long Rest, the old pair expires automatically and configuration reopens. Short Rest does not expire it. Same-rest second configuration is rejected.

Preferred XPHB equipment rows represent the PHB list; Musket and Pistol are excluded by campaign policy. Current live option count is 74 training choices, with firearms absent.

Migration 53 corrected Animal Handling / Sleight of Hand after the shared normalizer's compact-name behavior was audited. Migration 54 corrected Astral Elf eligibility to normalized `astralelf`. Both bugs failed closed and were fixed before acceptance.

The final deployed rollback proof passed the full lifecycle and left zero runtime/synthetic residue. See `Astral_Trance_Runtime_Status.md`.

## Current production integrity checkpoint

After migrations 52-54 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 0 QA Astral Trance runtime rows;
- 0 synthetic Astral proof characters;
- 18 Astral Trance skill options;
- 74 source-legal training options;
- firearms present in Astral options: false;
- 20 world locations;
- 4 map routes;
- 9 map route points.

Public Astral getter/configure RPCs are authenticated/service-role surfaces. Private Astral helpers and rest trigger functions are service-role-only.

## Remaining active PR #170 work

Starting magic, starting equipment/currency authority, and Astral Trance runtime cadence are closed.

Remaining major work:

1. remaining runtime cadence families, especially Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey;
2. compact post-create character-currency presentation in the inventory/profile UI;
3. Artificer wildcard Magic Item Plan concrete-item instances;
4. remaining persistent/conditional source-choice audit and UI polish;
5. obsolete authenticated progression RPC cleanup;
6. authenticated browser acceptance;
7. merge PR #170 only after those gates close.

## Protected boundaries

Character Forge/progression documentation does not authorize world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting changes. Those systems retain their own controlling handoffs and acceptance history.
