# Unified NPC and Player Character Forge Status

Status date: 2026-08-14
Historical base PR: #170 (`agent/character-forge-resilience-presentation`) — merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`
Active continuation: PR #171 (`agent/species-art-post170`) — open/unmerged
Runtime checkpoint documented here: **89**
Current live database checkpoint: **93**

## Governing architecture

The shared Character Forge is the intended creation surface for NPCs and player-owned characters. Persistent source-owned state should converge between direct creation at level N and earned progression to level N.

That parity rule does **not** convert every source choice into permanent creation state:

- persistent acquisition/attained-level choices → Forge/progression authority;
- proficiency-dependent permanent choices → Training authority;
- spellbook-dependent permanent choices → Spells/progression authority;
- rest-configurable persistent choices → runtime authority;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use/per-cast choices → action/spell resolver;
- informational features → display/consumer logic.

## Player-facing Forge routing

Current player steps separate explanation from decision resolution:

- Species — identity/lore/features; fixed source languages stay fixed;
- Background — background identity/source grants;
- Class — class/subclass explanation and progression preview;
- Abilities — score generation/allocation;
- Training → Skills & Proficiencies;
- Training → Feats & Class Abilities;
- Spells — class magic plus spell-centric Species/Feat/Background/Class-feature decisions;
- Review — manual choices plus automatic source-policy outcomes.

Higher-level feats no longer resolve on Abilities. Warlock Invocations, Artificer plans, and similar persistent catalogues resolve in Training with richer description-first UI. Noncasters can still use Spells for source-owned magic.

Read `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.

## Starting/player creation authority

Player creation remains server-authoritative through `create_player_character_v3`.

Established creation systems include:

- exact starting class/subclass spell selection and fixed/expanded access;
- source-owned feat/species/background magic with distinct provenance;
- starting equipment and character-scoped currency;
- source choice/feat-instance authority;
- higher-level direct creation with persistent attained-level choices;
- portrait choice and multi-character account support.

## Earned progression authority

The active Level Up path composes source-owned persistent acquisition/replacement work transactionally. Established families include feats/boons, subclass entry, class spells, Metamagic, Mystic Arcanum, Eldritch Invocations, Battle Master maneuvers, Wizard Savant chronology, Wizard Signature Spells, and Artificer Magic Item Plans.

Migration 85 retained `get_character_level_class_choice_options_v2` as an authenticated compatibility fallback while revoking anonymous execute in the bounded v1/v2/v3 class-choice getter family. Read `Progression_RPC_ACL_Cleanup_Status.md`.

## Source-owned magic — migrations 86-88

The Forge now routes spell-centric Species/Feat decisions to Spells and materializes validated source magic into `character_spells`.

Accepted regression families:

- Astral Elf / Astral Fire;
- Deep Gnome / Gift of the Svirfneblin at levels 3/5;
- Witherbloom Student / Strixhaven Initiate;
- Magic Initiate;
- deterministic best eligible casting ability.

Migrations 87-88 are additive parser/name-normalization corrections discovered by rollback QA. Read `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.

## Runtime authority checkpoint

The bounded runtime-family sweep is complete through Whispers of the Dead.

Representative semantics:

- Wizard Spell Mastery — immediate initial configuration; Long-Rest optional replacement;
- Weapon Mastery / Weapon Master — current mastery persists; Long-Rest replacement authority;
- Astral Trance — temporary Long-Rest-cycle skill + weapon/tool pair; expires next Long Rest;
- Githyanki Astral Knowledge — temporary Long-Rest-cycle skill + weapon/tool pair;
- Khoravar Skill Versatility — persistent runtime proficiency with Long-Rest replacement;
- Primal Companion — persistent companion with Long-Rest replacement;
- Dread Allegiance — persistent linked package with Long-Rest replacement;
- Fiendish Resilience — first choice after Short/Long Rest; then persistent until later replacement;
- Circle Spells — current land package expires at next Long Rest;
- Armorer Armor Model — immediate initial choice; Short/Long-Rest optional replacement;
- Bestial Soul — first choice after qualifying rest; expires next Short/Long Rest;
- Wild Heart Aspect — immediate initial choice; persistent; Long-Rest replacement;
- Hunter's Prey — PHB permanent Forge choice / XPHB persistent Short/Long-Rest runtime choice;
- Defensive Tactics — PHB permanent Forge choice / XPHB persistent Short/Long-Rest runtime choice;
- Whispers of the Dead — first choice after qualifying rest; borrowed proficiency persists until later replacement.

## Post-rest pending choice presentation — migration 89

`CharacterRestChoiceNotice` is mounted in the always-reachable runtime/currency chain. Its server aggregate separates:

- `needsSelection` — a current rest-cycle benefit is inactive or first rest-backed selection is waiting; attention pulse;
- `optionalChanges` — current persistent benefit remains active; quiet/collapsed;
- `availableActions` — optional post-rest actions; quiet/collapsed.

Rollback acceptance proved:

- Astral Trance after Long Rest → attention true, one temporary pending choice;
- Wild Heart Owl after newer Long Rest → Owl remains active, attention false, one optional persistent replacement.

Read `Pending_Rest_Runtime_Choices_Status.md`.

## Always-reachable runtime presentation

The current character sheet/runtime presentation includes the established species/class/feat runtime panels plus:

- Defensive Tactics;
- Whispers of the Dead;
- pending post-rest choice notice;
- character-scoped currency.

Eligibility in one panel must never hide unrelated downstream controls. Every feature-specific RPC argument is passed explicitly.

## Source-control parity repair

Migration-89 startup found production migrations 83-85 present while their SQL files and two reachable runtime panels were absent from the PR branch. Source was restored without reapplying those already-live migrations.

A fresh checkout must now contain migrations 83-89 in sequence.

## Current production integrity

After migration 89 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 18 inventory rows;
- 0 runtime rows;
- 0 rest-log rows;
- 0 migration-89 QA residue;
- 20 world locations;
- 4 map routes;
- 9 map route points.

Before migration 89 deployment, exact head `a05c4b03f9a36cbf9021108aa07856cfab474fd1` passed 31/31 PR-triggered GitHub workflows and Vercel. Final documentation commits must be exact-head gated again.

## Current continuation

PR #170 is historical and merged. PR #171 preserves this unified creation/progression/runtime architecture while refining the shared Species presentation. Paul considers the Species tab nearly perfect; further broad Species changes should require a concrete reproduction.

Current continuation discipline:

1. keep PR #171 exact-head GitHub/Vercel gated;
2. review the next requested Forge tab as a separate bounded slice;
3. immediately before any explicitly approved merge, re-check head/status, live migrations, ACLs, and zero residue;
4. merge only with explicit user approval.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, tactical encounter/combat execution, or unrelated crafting behavior. `components/MapPageClient.js` remains outside Forge/progression/runtime work.
