# DNDNext Current Handoff Prompt

Status: copy-ready project handoff, reconciled 2026-08-08

---

## Copy from here

You are taking over the `bob8675309/DNDNEXT` repository as a senior developer, technical advisor, and implementation owner.

DNDNext is a Next.js Pages Router + Supabase D&D campaign platform. Styling uses Bootstrap and SCSS. Treat current GitHub state, live Supabase schema/migrations/functions/data, source validators, and living `docs/` handoffs as the evidence base. Do not trust old conversation summaries when current state can be inspected.

### Required first actions

Before changing anything:

1. Inspect current `main`, PR #170, recent commits, changed-file boundary, and exact CI status.
2. Inspect live Supabase read-only for schema/function/RLS/data questions before making DB changes.
3. Read `docs/README.md` and `docs/Documentation_Refresh_Manifest.md`.
4. For Character Forge/progression/runtime cadence, read:
   - `docs/Unified_Character_Forge_Status.md`
   - `docs/Character_Progression_Foundation.md`
   - `docs/Character_Forge_PR_A_Deployment_Evidence.md`
   - `docs/Character_Progression_and_Higher_Level_Forge.md`
   - `docs/Wizard_Spell_Mastery_Runtime_Status.md`
   - `docs/Player_Forge_Starting_Magic_v3_Status.md`
   - `docs/Player_Forge_Starting_Equipment_Status.md`
   - `docs/Astral_Trance_Runtime_Status.md`
   - `docs/Primal_Companion_Runtime_Status.md`
5. Reconcile docs against current source/live Supabase before assuming a listed blocker is still open.
6. Update relevant handoffs whenever a migration, architecture boundary, validation result, or acceptance state changes.

### Non-negotiable boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map or `components/MapPageClient.js` unless explicitly requested.
- Tactical encounter state stays isolated from routes, travel, weather, camps, and world clock.
- Smiths handle physical gear; Enchanters handle magical A/B/C slots by item tier.
- Generic NPCs do not become crafters without an appropriate role.
- Supabase normalized state remains authoritative for characters, sheets, inventory, equipment, spells, progression, runtime feature choices, and guarded commands.
- Browser state previews/collects choices but does not bypass guarded database authority.
- Realtime is synchronization, not authority.
- Preserve working systems and avoid broad rewrites.
- Before returning a patch, verify every helper, hook, state variable, memo, RPC argument, and prop is defined and passed at every use site.
- Keep unrelated changes out of the active branch.
- Never describe a visual asset as approved until the user has visually approved it and documented gates have passed.

### Delivery workflow

- Use bounded branch/PR changes.
- Review the exact PR head and CI after each meaningful slice.
- Distinguish hosted Vercel account/rate-limit failures from application build failures.
- A successful repository `npm run build:vercel` is compile/build evidence but is not the same as a hosted Vercel deployment.
- Batch coherent changes to conserve hosted builds.
- For Supabase changes: source contract → static/build gates → live-schema rollback compile → migration → rollback-only behavior proofs → integrity sweep → docs.
- Proceed when the user says “proceed”; do not repeatedly request confirmation already given.

## Active focus: Character Forge / progression PR #170

PR #170 (`agent/character-forge-resilience-presentation`) remains **open and unmerged**.

Do not restart completed Forge consolidation, Savant/Signature/Spell Mastery, Weapon Mastery cadence, guarded multi-source starting magic, starting-equipment/currency authority, Astral Trance, or Primal Companion runtime work.

### Governing parity/cadence model

Persistent decisions made by direct level-N Forge creation and earned level-N progression should converge.

Current cadence model:

- persistent creation/attained-level choice → authoritative Forge/progression state;
- proficiency-dependent permanent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → runtime/action UI;
- informational feature → display only.

## Live migration checkpoint through 55

### 38-39 — Battle Master

Normalized XPHB maneuver instances shared by higher-level Forge and earned progression. Counts 3/5/7/9 at Fighter 3/7/10/15; later gains allow two new + one optional replacement while preserving acquisition chronology.

### 40-41 — Wizard Savant

Savant additions are class-feature spellbook membership with `wizardSpellbook=true`. Historical direct-Forge chronology is 3/3/5/7/9/11/13/15/17. Cantrips are excluded. Earned progression and direct creation are parity-proven.

### 42-43 — Wizard Signature Spells

Two level-3 spells from the final normalized Wizard spellbook. Signature overlays existing membership, preserves provenance, and adds one `short_rest` free cast. Direct Forge and earned 19→20 ordering are rollback-proven.

### 44 — Wizard Spell Mastery runtime

Spell Mastery is not a permanent Forge choice. XPHB Wizard 18+ configures one level-1 and one level-2 Action spell from the actual spellbook. A later replacement requires a newer Long Rest and may change only one same-level mastered spell. Active encounter state blocks configuration.

### 45 — class Weapon Mastery runtime

Class-granted Weapon Mastery is Long-Rest runtime state. Capacity is canonical class/level-driven. New capacity is immediate; replacing an existing active mastery requires a newer Long Rest.

### 46 — Weapon Master feat runtime

Each permanent Weapon Master feat instance owns an independent runtime weapon. Permanent feat acquisition choices remain immutable history. `sheet.weaponMasteries` is derived from class runtime selections plus all active feat-instance selections.

### 47-48 — Player Forge v3 starting magic

The shared Player Forge calls `create_player_character_v3`, not v2. `sheet.startingMagicSelections` is exact Spell-step authority for native class-list spells, Background-expanded class access, Eldritch Knight, and Arcane Trickster including fixed Mage Hand. Migration 48 removes the stale anonymous execute grant inherited by v3.

### 49-51 — starting equipment / character currency

Player mode includes an Equipment step between Spells and Identity; NPC step order is unchanged.

Source packages are restored for the 12 XPHB core classes plus EFA Artificer and read from existing XPHB Background equipment metadata.

Concrete starter items are canonical character-owned inventory rows and begin unequipped. Character cash is stored in `character_currency` as copper. Do not use `player_wallets` for character starting currency.

Normal class + Background equipment remains the base at every starting level. Higher-level cash is additive. Higher-level magic-item quantities are a **DM guide only** and must not be randomly/automatically granted.

Migration 50 binds submitted Background equipment to the actual sheet Background and enforces the higher-level d10 rule. Migration 51 removes the legacy account-wide sheet mirror; final starter-equipment projection is character-scoped only.

### 52-54 — Astral Trance runtime

AAG Astral Elf Astral Trance is **not a Character Forge choice**.

After a completed Long Rest, the character chooses one of all 18 skills plus one source-legal PHB-equivalent weapon/tool proficiency. The pair is stored in runtime state and projected under `sheet.runtimeProficiencies.astralTrance` without rewriting permanent skill/tool/weapon proficiency fields.

The pair expires automatically when the **next Long Rest finishes**. Short Rest leaves it active. Same-rest second configuration is rejected.

Preferred XPHB catalogue rows represent the PHB equipment list. Musket and Pistol are excluded by campaign policy. Migrations 53-54 correct compact skill/species normalization. Final deployed rollback proof passed the full lifecycle with zero QA residue.

See `docs/Astral_Trance_Runtime_Status.md`.

### 55 — Primal Companion runtime

XPHB Ranger 3+ / Beast Master Primal Companion is **not a permanent Forge Land/Sea/Sky choice**.

The initial companion can be configured immediately when the feature exists:

- Beast of the Land;
- Beast of the Sea;
- Beast of the Sky;
- plus a 1-80 character animal appearance.

The current beast persists until changed. Short Rest does nothing. Long Rest does **not** dismiss or auto-expire it.

A **newer completed Long Rest** opens one replacement opportunity. Once the player replaces the beast, that same rest cannot be used for another replacement. Failed invalid submissions do not consume the opportunity.

Runtime identity lives in `character_runtime_feature_choices` and `sheet.runtimeCompanions.primalCompanion`. No `classFeatureChoices` entry is created.

Replacement is blocked while the character is a non-defeated participant in an active encounter.

The production schema currently has no normalized creature/bestiary table, so migration 55 intentionally owns only the source form + appearance state. It does not invent a duplicate companion-statblock table or controlled minion entity. Future companion/minion/tactical work should consume this state.

Final rollback proof passed:

- immediate Land / `gray wolf` initial summon;
- immediate replacement rejected;
- Short Rest preserves current beast and does not unlock replacement;
- newer Long Rest preserves current beast and opens replacement;
- invalid form and overlong appearance rejected without consuming the opportunity;
- Land → Sea / `giant otter` replacement succeeds and records previous companion;
- same-rest second replacement rejected;
- second newer Long Rest preserves Sea and reopens replacement;
- active encounter blocks replacement;
- replacement succeeds after encounter resolution to Sky / `red-tailed hawk`;
- XPHB Ranger 3 / Hunter is unavailable and cannot configure;
- zero runtime/synthetic residue after rollback.

Final Primal checkpoint:

- migration 55 registered;
- 3 source forms;
- 0 live QA `primal-companion` rows;
- 0 synthetic Primal proof characters;
- 7 characters / 7 sheets / 30 spell rows / 7 progression rows;
- 20 locations / 4 routes / 9 route points.

See `docs/Primal_Companion_Runtime_Status.md`.

## Immediate remaining PR #170 work

Do **not** reopen starting magic, starting equipment/currency authority, Astral Trance, or Primal Companion.

Current blockers:

1. remaining runtime cadence families:
   - Circle-of-the-Land choices — inspect exact source cadence before implementation;
   - Dread Allegiance — current choice persists until changed after a Long Rest;
   - Fiendish Resilience — current damage type persists until changed after a Short or Long Rest;
   - Steps of the Fey — per-use Misty Step effect choice, not rest-stored state;
2. compact post-create character-currency display in inventory/profile UI;
3. Artificer wildcard Magic Item Plan concrete-item instances;
4. remaining persistent Species / Background / Class / Feat / Subclass coverage and conditional-choice UI audit;
5. obsolete authenticated level-up completion RPC cleanup;
6. final authenticated browser acceptance;
7. merge PR #170 only after those gates close.

### Recommended next implementation slice

Continue with **Dread Allegiance** as an isolated source-backed runtime slice. Its current allegiance should persist until changed, and a newer Long Rest should authorize one change. Do not give it Astral Trance auto-expiry semantics.

Before implementing Circle of the Land, inspect the exact XPHB source row(s) and determine whether each choice is persistent, rest-configurable, or per-use.

Steps of the Fey belongs in per-cast/action UI rather than rest-stored `character_runtime_feature_choices` state.

The character-currency badge remains a bounded UI follow-up that can be batched with a later inventory/profile presentation pass.

## Documentation precedence

When sources disagree:

1. live Supabase schema/migrations/functions/protected data;
2. current repository source/validators;
3. `Documentation_Refresh_Manifest.md` + active PR #170 status/evidence docs;
4. platform-wide roadmap / tactical ledgers;
5. historical exports/runbooks only as provenance.

Begin by verifying PR #170 and live Supabase. If migration 55 and the zero-residue Primal checkpoint are current, continue with Dread Allegiance rather than reopening Primal Companion.

## End copy
