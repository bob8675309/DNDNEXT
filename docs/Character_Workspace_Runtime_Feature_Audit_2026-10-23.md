# Character Workspace and Runtime Feature Audit — 2026-10-23

Status: **pre-implementation architecture / source and live-schema audit**. No UI, gameplay, schema, data, or permissions have been changed by this document.

## Exact evidence checkpoint

- Reviewed repository: `bob8675309/DNDNEXT` production `main` at `f55c224006dbc9c3613470cafa2cf65e7c350f00` (merged PR #248). Recheck `main` before making any new changes.
- Live project inspected read-only: current class feature catalogue, `character_progression`, `character_sheets`, `character_runtime_feature_choices`, and available RPC function names.
- Read historical authority: `docs/Unified_Character_Forge_Status.md`, `docs/Character_Progression_and_Higher_Level_Forge.md`, `docs/Pending_Rest_Runtime_Choices_Status.md`, and feature-specific runtime ledgers. Old PR/migration checkpoints are **not** live truth.
- Feature screening on this snapshot: `class_feature_catalog` has **2,390** rows, **1,691** with a subclass, and **573** subclass rows matching broad rest/choice/action wording. **573 is a deliberately noisy text-screening pool, not a count of missing handlers.** Different editions and sources are separate catalogue rows.
- Current live `character_runtime_feature_choices` contains one Echoing Soul Expertise instance; absence of rows for other characters does not imply their handlers are missing. Coverage must be confirmed from source, available server functions, eligibility, and behavior.

## Confirmed coverage gap — Grim Hollow Parasite Patron: Physical Specimen

Canonical source row:
- `class_feature_catalog.feature_key`: `subclass:warlock:xphb:parasite:physical-specimen:grimhollowpg24:3`
- `class_name`: Warlock; `subclass_name`: The Parasite Patron; feature level 3; `source`: GrimHollowPG24
- Source says: activate as a **Bonus Action once per Long Rest**; choose **up to Charisma modifier (minimum 1)** benefits; these **end on completing a Long Rest**. After finishing a **Short Rest**, replace **one selected benefit**.
- Six benefits from the source: maximum HP + Warlock level; Darkvision 60 feet (or existing range +60); Speed +5 feet; Advantage on saves against Poisoned; triple jump distance and climb Speed equal to Speed; add Charisma modifier to Athletics or Acrobatics checks.
- A reviewed level-3 Parasite Patron character has its subclass and Eldritch Invocations recorded, but no Physical Specimen runtime configuration. No dedicated Physical Specimen UI component or source-matched runtime handler was found on this head.
- **Not a missing permanent Forge-pick count.** This belongs to configurable runtime/action state. Avoid storing selections in `classFeatureChoices` or auto-seeding them during creation.

### Required contract before implementation

1. **Eligibility/provenance**: use progression class/subclass identity, class level, source, and the exact feature key; do not use character display role or a substring of subclass text. Fail closed on ineligible characters.
2. **Choice exactness**: six stable, source-derived option IDs; unique selections; allowed count `1..min(6,max(1,CHA modifier))`; reject unknown, duplicate, or excess options; read modifier from canonical character data.
3. **Lifecycle**: record Bonus Action activation and its once-per-Long-Rest limit; end all chosen effects on completing the next Long Rest; permit exactly one chosen-benefit swap per completed Short Rest (without refreshing the Bonus Action activation or extending duration). Check how existing rest receipts and timestamps are sequenced.
4. **Atomic behavior**: use authenticated, character-scoped, guarded RPC(s), transactional updates and row locking. Reuse existing permission checks and avoid duplicate persistence/REST hooks. No owner-agnostic direct JSONB writes from the browser.
5. **Effects**: provide one non-destructive runtime projection consumed by sheet/rolls; never bake max HP, Speed, vision, or proficiency overlays into permanent source choices. HP-max changes must be tested for current/temporary HP consistency, including expiration.
6. **Combat boundary**: this feature is a Bonus Action and should eventually work during an encounter, but existing generic runtime configuration functions block changes while an encounter is active. **Do not bypass that lock or insert a tactical action shortcut without separately reviewing the encounter command economy.** Decide gameplay activation and encounter integration as a guarded implementation step.
7. **Persistence and visibility**: preserve state on profile switching, page refresh, and rest; group under Features & Rest; use source's exact feature name in explanatory UI; keep the existing shared character sheet runtime host until replaced in a separately reviewed UI change.
8. **Testing**: include source eligibility, CHA limits, duplicate selections, Short-Rest swap once per rest, Long-Rest expiry/reuse, active-encounter constraints, owner versus non-owner, rollback-only SQL fixtures, and sheet/roll projections.

Source may require a finer-grained interpretation for the last listed benefit; inspect structured raw `entries` before building the effect adapter.

## Other source-backed candidates to classify, NOT confirmed missing

| Source | Feature | Why it merits inspection | Status |
|---|---|---|---|
| GrimHollowPG24 Barbarian / Path of the Wrathful Dead 3 | Final Night Catharsis | Explicit choice change at a Long Rest | Candidate; verify implementation/eligibility |
| GrimHollowPG24 Bard / College of Adventurers 14 | Improvisational Talent | Rest-based replacement of an acquired talent | Candidate; inspect current talent grant authority |
| GrimHollowPG24 Artificer / Reanimator 5 | Strange Modifications | Chooses a companion modification on creation | Candidate; creature/companion-specific, not necessarily permanent build |
| GrimHollowPG24 Warlock / The Parasite Patron 3 | Spell Siphon | Reaction, temporary spell acquisition, Long-Rest expiry | Distinct per-use/combat system, **not** a Physical Specimen selection |
| XPHB Barbarian / Wild Heart 6 | Aspect of the Wilds | Long-Rest replaceable | **Already implemented** in `sql/20260809_81_wild_heart_aspect_runtime.sql` and `CharacterWildHeartAspectPanel` |
| XPHB Ranger / Hunter 7 | Defensive Tactics | Short/Long-Rest replaceable | **Already implemented** in `sql/20260809_83_defensive_tactics_runtime.sql` |
| XPHB Warlock / Fiend Patron | Fiendish Resilience | Short/Long-Rest replacement | **Already implemented** in `sql/20260808_57_fiendish_resilience_runtime.sql` |

Expand the gap audit in manageable class/source batches. Do not equate a keyword hit, no runtime row, or an older status document with an unimplemented feature.

## Player/NPC/Forge responsibilities to preserve

- `components/character/CharacterInteractionPanel.js` is intentionally the shared interaction shell. Prefer character-type-aware content over reimplementing Class, Spellbook, Inventory, Sheet, or Craft.
- `components/PlayerCharacterProfilePanelUnified.js` remains the day-to-day PC entry point.
- `components/NpcPanel.js` owns NPC narrative/GM reveal interactions. The shared `characters.kind='npc'` plus a `player-character` tag means a PC can be rendered with NPC-only controls; rendering must distinguish them **without changing the table's `kind`**.
- The NPC roster `pages/npcs.js` is an admin/roster surface and currently includes player-character rows. Filter deliberately; do not alter NPC world/town handling as a side effect.
- Forge's rich source-backed Species/Class/Heritage/Feat/Spell pickers should be reused for **read-only View Build**, and eventually for **Level Up** via `complete_character_level_up_v5`, never by submitting a second character-creation write path.
- `CharacterCurrencyBadge` currently mounts the rest/runtime panel chain. Keep those capabilities reachable until a separately approved feature registry replaces the mounting pattern.
- Full-sheet JSONB save paths on NPC screens need caller and data-ownership review before offering player editing. Equipment, persistent spell resources, and tactical encounter snapshots retain their own authorities.
- Preserve portal/stacking, drag/resize, saved draft, character switch / stale-response guards, and approved compact Forge typography.

## UI approval gate (explicit requirement)

**No existing UI code may change as part of this audit.**

Review conceptual mock-ups with Paul before changing the character panel, Forge entry points, runtime-feature surfaces, roster filtering UI, or styling.

Mock-up concepts for approval:
1. Current Player Profile with minimal additional entry points and NPC-only controls hidden, retaining portrait, layout, and existing tabs until explicitly accepted.
2. View Build opens the *existing Forge presentation* loaded from saved canonical choices, visibly read-only; no second creation submit.
3. Features & Rest reuses established purple card style with an actionable Physical Specimen panel and rest-based status; gameplay action authority remains on the server.
4. Level Up retains current progression transactions and uses Forge-style selectors for new legal choices.

These are proposals, not claims that particular choices/levels shown in a mock-up are source-correct. Subclass features, unlocked levels, and spell/heritage counters must come from actual persisted canonical data in the final UI.

## First bounded engineering slices

- **A (non-visual)**: finalize Physical Specimen source/eligibility and rest/action RPC contract; prepare a reviewed additive migration and rollback-only tests. No unreviewed live-data mutation.
- **B (non-visual)**: implement server runtime state and non-destructive effective sheet projections, separate from tactical action handling; verify ACL/grants, active encounter guard and HP behavior.
- **C (mock-up approved only)**: reuse the current character feature-card visuals for the actual selector and connect to the new RPC.
- **D (mock-up approved only)**: role-aware player/NPC shell and read-only View Build.
- **E (mock-up approved only)**: Forge-quality earned Level Up and navigation consolidation.
- Do not touch `components/MapPageClient.js`, world/town movement, travel/weather/camp/clock, unrelated crafting/merchant logic, or tactical combat execution under these slices.
