# DNDNext Current Handoff Prompt

Status: copy-ready project handoff, reconciled 2026-08-08

---

## Copy from here

You are taking over the `bob8675309/DNDNEXT` repository as a senior developer, technical advisor, and implementation owner.

DNDNext is a Next.js Pages Router + Supabase D&D campaign platform. Styling uses Bootstrap and SCSS. Treat current GitHub state, live Supabase schema/migrations/functions/data, source validators, and the living `docs/` handoffs as the evidence base. Do not trust old conversation summaries when current state can be inspected.

### Required first actions

Before changing anything:

1. Inspect current `main`, PR #170, recent commits, changed-file boundary, and exact CI status.
2. Inspect live Supabase read-only for schema/function/RLS/data questions before making DB changes.
3. Read `docs/README.md` and `docs/Documentation_Refresh_Manifest.md`.
4. For Character Forge/progression, read:
   - `docs/Unified_Character_Forge_Status.md`
   - `docs/Character_Progression_Foundation.md`
   - `docs/Character_Forge_PR_A_Deployment_Evidence.md`
   - `docs/Character_Progression_and_Higher_Level_Forge.md`
   - `docs/Wizard_Spell_Mastery_Runtime_Status.md`
   - `docs/Player_Forge_Starting_Magic_v3_Status.md`
5. Reconcile docs against current source/live Supabase before assuming a listed blocker is still open.
6. Update the relevant handoffs whenever a migration, architecture boundary, validation result, or acceptance state changes.

### Non-negotiable boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map or `components/MapPageClient.js` unless explicitly requested.
- Tactical encounter state stays isolated from routes, travel, weather, camps, and world clock.
- Smiths handle physical gear; Enchanters handle magical A/B/C slots by item tier.
- Generic NPCs do not become crafters without an appropriate role.
- Supabase normalized state remains authoritative for characters, sheets, inventory, equipment, spells, progression, and guarded commands.
- Browser state previews/collects choices but does not bypass guarded database authority.
- Realtime is synchronization, not authority.
- Preserve working systems and avoid broad rewrites.
- Before returning a patch, verify every helper, hook, state variable, memo, RPC argument, and prop is defined and passed at every use site.
- Keep unrelated changes out of the active branch.
- Never describe a visual asset as approved until the user has visually approved it and documented gates have passed.

### Delivery workflow

- Use bounded branch/PR changes.
- Review the exact PR head and CI after each meaningful slice.
- Distinguish a hosted Vercel account/rate-limit failure from an application build failure.
- A successful repository `npm run build:vercel` is valid compile/build evidence but is not the same as a hosted Vercel deployment.
- Batch coherent changes to conserve hosted builds.
- For Supabase changes: source contract → static/build gates → compile against live schema when useful → migration → rollback-only behavior proofs → integrity sweep → docs.
- Proceed when the user says “proceed”; do not repeatedly request confirmation already given.

## Active focus: Character Forge / progression PR #170

PR #170 (`agent/character-forge-resilience-presentation`) remains **open and unmerged**.

Do not restart completed Forge consolidation, Savant/Signature/Spell Mastery, Weapon Mastery cadence, or guarded multi-source starting-magic work.

### Governing parity/cadence model

Persistent decisions made by direct level-N Forge creation and earned level-N progression should converge.

Current cadence model:

- persistent creation/attained-level choice → authoritative Forge/progression state;
- proficiency-dependent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → runtime/action UI;
- informational feature → display only.

### Earned progression authority

The active Level Up UI completes through `public.complete_character_level_up_v5`.

Connected persistent families include General feat/Epic Boon advancement, simple class choices, Bard Magical Secrets, Lore Magical Discoveries, Draconic Elemental Affinity, Champion Additional Fighting Style, Sorcerer Metamagic, Warlock Mystic Arcanum, Magic Initiate replacement, Eldritch Invocations/Lessons, Battle Master maneuvers, Wizard Savant, and Wizard Signature Spells.

Authenticated v3/v4 level-up completion is revoked. Legacy v1/v2 level-up completion grants remain a cleanup item once confirmed unused.

## Live migration checkpoint through 48

### 38-39 — Battle Master

Normalized XPHB maneuver instances shared by higher-level Forge and earned progression. Counts 3/5/7/9 at Fighter 3/7/10/15; later gains allow two new + one optional replacement while preserving acquisition chronology.

### 40-41 — Wizard Savant

Savant additions are class-feature spellbook membership with `wizardSpellbook=true`. Historical direct-Forge chronology is 3/3/5/7/9/11/13/15/17. Cantrips are excluded. Earned progression and direct creation are parity-proven.

### 42-43 — Wizard Signature Spells

Two level-3 spells from the final normalized Wizard spellbook. Signature overlays existing membership, preserves source provenance, and adds one `short_rest` free cast. Direct Forge and earned 19→20 ordering are rollback-proven. Migration 43 provides explicit resource labels/protection.

### 44 — Wizard Spell Mastery runtime

Spell Mastery is **not** a permanent Forge choice. XPHB Wizard 18+ chooses one level-1 and one level-2 Action spell from the actual spellbook. Both are at-will at lowest level. A newer Long Rest allows exactly one same-level replacement. Active encounter state blocks configuration.

### 45 — class Weapon Mastery runtime

Class-granted Weapon Mastery is Long-Rest runtime state. Capacity is canonical class/level-driven. Initial/new capacity is immediate; replacing existing active mastery requires a newer Long Rest.

### 46 — Weapon Master feat runtime

Each permanent Weapon Master feat instance owns an independent runtime weapon. Permanent feat acquisition choices remain immutable history. `sheet.weaponMasteries` is derived from class runtime selections plus all active feat-instance selections.

### 47-48 — Player Forge v3 starting magic

The shared Player Forge now calls `create_player_character_v3`, not v2.

`sheet.startingMagicSelections` is exact Spell-step authority for:

- native class-list spells;
- Background-expanded class access;
- XPHB Eldritch Knight spellcasting;
- XPHB Arcane Trickster spellcasting, including fixed Mage Hand.

Species/feat/class-feature spell grants remain separate source-owned systems.

v3 delegates common creation to v2 but only gives v2 native-class-compatible proxy spell choices. Background-expanded spells receive a temporary same-level native proxy solely for v2 count validation; v3 removes only v2-created temporary/base spell rows and writes exact v3 assignments afterward. Subclass spells never masquerade as Fighter/Rogue native class spells.

Rollback proofs through the real authenticated v3 RPC passed for:

- level-1 native Wizard;
- level-1 Wizard with non-native Background-expanded **Entangle**;
- level-3 Eldritch Knight;
- level-3 Arcane Trickster with fixed Mage Hand exactly once;
- rejection of undeclared Background expansion;
- rejection of invalid fixed subclass spell;
- rejection of duplicate exact starting magic.

Migration 48 removes the stale explicit anonymous execute grant inherited by v3. v1/v2/v3 creation RPCs now expose the same authenticated/service-role execution surface.

Final live integrity after all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 0 synthetic v3 proof characters;
- 20 locations / 4 routes / 9 route points.

## Immediate remaining PR #170 work

Do **not** reopen guarded multi-source starting magic; it is complete.

Current blockers are:

1. remaining runtime cadence families such as Astral Trance, Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey;
2. source-backed starting equipment packages and higher-level starting wealth/equipment;
3. character-scoped starting currency for multi-character accounts;
4. Artificer wildcard Magic Item Plan concrete-item instances;
5. remaining persistent Species / Background / Class / Feat / Subclass coverage and conditional-choice UI audit;
6. obsolete authenticated level-up completion RPC cleanup;
7. final authenticated browser acceptance;
8. merge PR #170 only after those gates close.

### Recommended next implementation slice

Unless current source/live state shows a newer higher-priority blocker, continue with **source-backed starting equipment and higher-level starting wealth/equipment**. Before changing it, inspect the existing item catalogue, inventory/equipment authority, Forge Review payload, and the crafting/equipment handoff docs so creation-time inventory does not bypass canonical inventory/equip state.

Character-scoped starting currency should be designed alongside that equipment slice but must not reuse account-wide wallet state as character inventory currency without an explicit authority model.

## After PR #170

Resume the Dawn high-quality sprite prototype work only after the current Character Forge interruption is accepted. Start with:

- `docs/Dawn_High_Quality_Prototype_Plan.md`
- `docs/Sprite_Production_Work_Map.md`
- `docs/Sprite_Production_Art_Bible.md`
- `docs/Sprite_Production_Run_Log.md`

## Other subsystem handoffs

Always begin with `docs/README.md` and the matching active subsystem ledger.

For character sheet/equipment/crafting/tactical snapshot work, read:

- `docs/Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`
- `docs/Character_Sheet_Formula_Reference.md`
- `docs/NPC_Character_Sheet_Selection_Reconciliation.md`
- `docs/NPC_Profile_Inventory_Equipment_Reference.md`

For tactical work, use the tactical roadmap plus the current phase ledger. Do not recreate existing tactical primitives.

For security/database changes, read `docs/Security_Hardening_Roadmap_Status.md` and inspect live grants/functions. Do not blanket-revoke guarded `SECURITY DEFINER` functions; evaluate the internal authorization contract individually.

### Documentation precedence

When sources disagree:

1. live Supabase schema/migrations/functions/protected data;
2. current repository source/validators;
3. `Documentation_Refresh_Manifest.md` + active PR #170 status/evidence docs;
4. platform-wide roadmap / tactical ledgers;
5. historical exports/runbooks only as provenance.

Begin by verifying PR #170 and the live database. If migrations 47-48 and the zero-residue checkpoint are still current, continue from source-backed starting equipment / higher-level starting wealth rather than reopening Player Forge starting magic.

## End copy
