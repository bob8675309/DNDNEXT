# DNDNext Current Development Status and Roadmap

Last reconciled: 2026-08-01

This is the current high-level handoff for DNDNext. It reconciles the living roadmap, phase ledgers, repository source, GitHub state, and deployed Supabase state. Historical phase ledgers remain useful implementation records, but this document controls current status when an older status header or unchecked master-roadmap task conflicts with deployed evidence.

## Non-negotiable boundaries

- The tactical encounter engine is separate from world-map and town/city-map behavior.
- Tactical coordinates, movement, turns, combat, and effects must never write world routes, travel, weather, camps, clock, or location simulation state.
- Do not modify world-map behavior unless the campaign owner explicitly requests world-map work.
- One tactical hex equals 5 feet.
- Canonical characters, sheets, equipment, spellbooks, classes, and progression remain the source of truth.
- Browser state may preview an action; guarded Supabase RPCs authorize and resolve it.
- Realtime is a synchronization signal. Database state remains authoritative.
- Gloomhaven is presentation/readability inspiration only; rules remain D&D 5e/2024 and DNDNext-specific.
- New helpers, hooks, memoized values, state, RPC arguments, and component props must be defined and passed at every use site.

## Verified baseline

- Production runtime baseline: `7e912a6fb79731b1dd436c53fb93051bccb6cb75` (PR #136 merge).
- PR #136 exact-head preview and merged `main` production Vercel deployments: green.
- Milestone 2 durable-start PR #113: squash-merged as `8028813cb0ca665d06271946198f2db331d79cf2`; exact-head and production Vercel deployments green.
- Milestone 2 lifecycle-guard PR #114: squash-merged as `e1cfdf9d83ecd18a79fb5ac27db55ae5e96758de`; exact-head and production Vercel deployments green.
- Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`, healthy.
- Latest deployed source migration slice:
  - `20260801_01_crafting_completion_normalization.sql`;
  - `20260801_02_equipped_armor_canonical_ac.sql`;
  - `20260801_03_shared_equipment_effects_pipeline.sql`;
  - `20260801_04_shared_equipment_effects_tactical_modifiers.sql`.
- Protected live baseline: 5 characters, 17 character-spell assignments, and no persistent tactical fixture rows.
- Protected world baseline: 20 locations, 4 map routes, and 9 map route points.

## Platform foundations already operating

### Character, NPC, and content systems

- Player creation and NPC Forge.
- Canonical character sheets, permissions, inventories, equipment, portraits, classes, spellbooks, feats, boons, and character options.
- XP, progression state, supported transactional level-up completion, class overview, and level guide.
- Profile-panel Class, Sheet & Rolls, Inventory, Spellbook, optional Shop, and optional Craft surfaces.
- Live catalog scale at reconciliation:
  - 936 spells;
  - 30 classes;
  - 600 class-level progression rows;
  - 2,118 class-feature rows;
  - 697 character options;
  - 2,633 item-catalog rows;
  - 197 NPC portraits.

### Canonical equipment and character-sheet authority

- Craft completion now normalizes physical-item display metadata and preserves the actual crafter/recipient receipt boundary (PR #127).
- Equipped armor and shields now drive canonical AC through guarded database authority (PR #128).
- Crafting output, equipped numeric effects, character-sheet overlays, and tactical staging share one defined authority pipeline (PR #129 plus the four August 1 migrations).
- Character-sheet AC, Initiative, Passive Perception, saving throws, and skill calculations have pure formula coverage and documented ownership boundaries (PR #130).
- NPC/merchant selection clears every identity-bound surface and guards sheet, equipment, and notes responses with both identity and request IDs (PRs #131-#134).
- Sheet loading has a true eight-second deadline, explicit retry path, and no raw-JSON fallback during loading/failure (PR #135).
- Always-mounted app-shell auth subscribers defer Supabase work until after the cross-tab auth lock is released (PR #136). Rapid switching plus tab-away/tab-return passed the campaign owner's preview test.
- `NPC_Character_Sheet_Selection_Reconciliation.md`, `Character_Sheet_Formula_Reference.md`, and `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md` are the controlling subsystem handoffs.

### Economy, merchants, and crafting

- RLS-hardened wallet and inventory boundaries.
- Atomic merchant purchase flow.
- Modern merchant market and crafter storefront presentation.
- Alchemy, Smithing, Enchanting, profession, material, recipe, and crafting workflow foundations.
- DB-backed NPC known-recipe support and admin Known/sort UI.
- Shared town/map/NPC character interaction shell.
- The source-mutating build patch pipeline has been retired; stable behavior is source-owned and validator-backed.

### World and town systems

World and town behavior are stable protected dependencies, not tactical implementation surfaces. Their movement, routes, weather, camps, travel windows, clock, and simulation rules remain outside this roadmap unless explicitly requested.

## Tactical encounter implementation status

### Visual and board foundations

- Unified 8-direction visual metadata/runtime is deployed.
- Portrait and sprite selection are independent; suggestions never force a pairing.
- The retired 4-direction runtime is not a production requirement.
- Axial pointy-top encounter hex utilities and isolated SVG board rendering are deployed.
- Persistent encounter maps, sparse terrain overrides, encounter objects, staging, and session tables are deployed.
- `/encounters`, `/encounters/live`, `/encounters/play`, and `/encounters/combat` exist.

Remaining visual work:

- migrate the last raw-path sprite caller;
- remove obsolete legacy picker/fallback code after caller verification;
- approve and register the first production-ready 256×512 eight-direction sprite batch;
- lock final anchor/padding guidance from real animated assets.

### Movement, turns, and combat

Deployed and validated:

- canonical Speed and 5-foot hex movement;
- ordered contiguous paths;
- difficult terrain, blockers, occupancy, boundaries, and movement-budget rejection;
- controller and active-turn authorization;
- request idempotency;
- initiative order, rounds, End Turn, and resource reset;
- Action, Bonus Action, Reaction, and movement state;
- Dash, Disengage, Dodge, and Opportunity Attack reaction windows;
- Unarmed Strike and canonical equipped melee/thrown/ranged weapons;
- range, attack rolls, criticals, typed damage, healing, Temporary HP, AC, defeat state, and combat logs;
- LOS, cover, saving throws, damage resistance/immunity/vulnerability;
- generic Conditions and timed effects;
- one-shot attack-roll and saving-throw modifiers;
- speed reduction, healing prevention, and Opportunity Attack suppression effects.

Still required for a campaign-ready shared 5e layer:

- real GM + Player A + Player B multi-round smoke testing and reconnect testing;
- unconsciousness, death saves, stabilization, and recovery;
- broader Condition semantics, including Prone, Grappled, Restrained, Incapacitated, and Stunned;
- forced movement;
- concentration;
- Ready, Help, Hide, Search, and Use an Object;
- persistent areas and start/end-turn hazards;
- reaction-spell authority;
- clean GM-assisted fallback for unsupported actions, spells, and abilities.

### Tactical spellcasting

Server-authoritative spellcasting is deployed for reviewed adapters from Phase 1I through Phase 1Z. The reviewed adapter set is:

- Fire Bolt;
- Cure Wounds;
- Sacred Flame;
- Toll the Dead;
- Poison Spray;
- False Life;
- Inflict Wounds;
- Shocking Grasp;
- Ray of Frost;
- Chill Touch;
- Mind Sliver;
- Word of Radiance;
- Guiding Bolt;
- Vicious Mockery;
- Healing Word;
- Acid Splash;
- Magic Missile;
- Burning Hands;
- Lightning Bolt.

Implemented targeting/resource mechanics include creature, self, caster-centered Emanation, point-targeted Sphere, allocated multi-target darts, directional Cone, and server-deployed directional Line authority; attacks, saves, half/no damage, healing, Temporary HP, slots, upcasting, Bonus Action casting, and the 2024 one-slotted-spell-per-turn guard.

Phase 1Z client source is production-deployed. The exact PR head and squash-merged `main` commit passed Vercel, and the 39-validator tactical suite remains green.

## Reaffirmed delivery roadmap

### Milestone 1 — close Phase 1Z and synchronize documentation — COMPLETE

Completed on 2026-07-30/31:

- combined client/documentation head `a5104ef394d0c29f89e7a98683c2b753f104fd25` passed Vercel;
- PR #111 squash-merged as `7a6d949bfa0f75b17e381574d847de5dc59d6b09`;
- merged production Vercel deployment passed;
- the protected database and world baselines remained exact;
- no illegal Lightning Bolt assignment was created.

The unrelated enchanting workflow failure at its canonical `Weapon of` verification step remains separate maintenance debt.

### Milestone 2 — first durable campaign encounter — IN PROGRESS

Production setup and interaction slices complete through 2026-08-01:

- `/encounters/live` now reflects the deployed encounter engine instead of stale Phase 1C guidance and links directly to Turn Play and Combat.
- `admin_start_encounter_v1` atomically validates staged participants, initiative, map bounds, blockers, and occupied start hexes; selects the first initiative participant; initializes turn resources; activates the encounter; and writes an `encounter_started` log.
- The legacy `admin_set_encounter_status_v1` compatibility entry point delegates staged `active` transitions to the same durable-start authority while preserving paused-to-active resume behavior.
- Start/lifecycle authority is validator-backed and passed exact-head plus merged-production Vercel gates.
- `/encounters/smoke` can idempotently prepare the guarded reusable radius-6 arena and four-actor staged encounter without direct table writes or automatic combat start (PR #116).
- Staging roster reads, first-use ability guidance, command lock release, and post-command UI reconciliation were hardened through PRs #118-#124.
- Attack results now expose clearer roll outcomes and durable per-entry attack math while rejecting delayed stale-result reconciliation (PRs #123-#126).
- No world-map or town/city-map source was changed, and the protected 20/4/9 world baseline remained exact.

Still required before Milestone 2 is complete:

- Run the existing `/encounters/smoke` preparation through an authenticated GM browser session so its reusable map and staged encounter become durable live rows.
- Review the four canonical staged actors, assign controllers, and start through the guarded durable-start command.
- Run several complete rounds with one GM and at least two distinct player sessions. The live project currently has only one Auth user, so this requirement cannot yet be claimed complete.
- Exercise movement, weapons, reactions, saves, healing, slots, AoE, reconnect, stale-client rejection, pause/resume, resolve/archive, and cleanup.
- Record real usability gaps before broadening automation or advancing to shared 5e rules.

### Milestone 3 — shared 5e rules before more spell breadth

Implement death/recovery, concentration, broader Conditions, forced movement, remaining common actions, persistent hazards, reaction spells, and manual fallback as reusable engine primitives.

### Milestone 4 — scalable adapter architecture

The existing versioned RPCs remain compatibility contracts. Add an audited spell/ability adapter registry that composes shared range, action, slot, attack, save, damage, healing, Condition, duration, and targeting primitives. Do not remove old entry points until equivalence validators prove every established adapter.

### Milestone 5 — class/species/feat/item abilities

Add a tactical ability registry, resource counters, common class/species/feat actions, consumables, equipment activations, rest reconciliation, and assisted/manual fallback.

### Milestone 6 — advanced board rules

Add multi-hex creature sizes, fog of war, elevation, climb/swim/fly/burrow movement, teleportation, traps, hazards, and player-safe hidden-information filtering. Existing LOS, cover, and hidden-result masking are foundations, not work to recreate.

### Milestone 7 — objectives and campaign handoff

Add objectives, round/time limits, reinforcements, victory/failure, rewards, XP/progression handoff, resource reconciliation, explicit campaign consequences, and encounter summaries. Encounter resolution must not silently mutate world travel or location simulation.

### Milestone 8 — routine-session polish

Complete accessibility, keyboard targeting, mobile/tablet behavior, colorblind-safe overlays, animation, network feedback, templates, monster presets, performance testing, archive/replay summaries, and production sprite content.

## Parallel non-tactical backlog

### Character progression/content

- Add source-backed selectors for blocked class choices such as Weapon Mastery, Fighting Style, Expertise, orders, Metamagic, Invocations, Magical Secrets, and Epic Boons.
- Add class-and-level-appropriate automatic NPC spell loadouts.
- Repair remaining catalog incompleteness: 16 spells without class metadata, 5 missing class summaries, and 75 class-feature rows without descriptions.

### Town, merchant, and crafter polish

- Configure actual NPC known-recipe rows; the live table is currently empty.
- Keep player-facing NPC crafting focused on player materials and player/Admin receipts.
- Remove player-irrelevant NPC crafter controls without changing crafting formulas or inventory semantics.
- Improve crafter header/portrait presentation and merchant theme/reroll clarity.

### Loading and presentation

- Treat the NPC/merchant sheet-switching incident as resolved at PR #136 unless the production sequence reproduces; preserve its identity guards, true deadline, retry path, and post-auth-lock scheduling.
- Reconfirm whether the town fallback-image flash still reproduces before patching it.
- Move profile portrait placement into the Description content layout if still outstanding.
- Normalize merchant/crafter/profile portrait sizing.
- Continue the broader audit of route-specific Supabase clients, query shape, dynamic imports, Bootstrap timing, and Realtime subscription duplication. `MapPageClient` remains outside scope until world-map work is explicitly authorized.

### Security and database maintenance

- Review tactical and non-tactical advisor findings in a dedicated hardening pass.
- Do not blanket-revoke authenticated `SECURITY DEFINER` RPCs; many are intentional guarded command boundaries.
- Prioritize proven unindexed foreign keys and per-row RLS auth initialization issues before scale testing.
- Keep storage listing, Auth settings, and managed PostgreSQL patching as explicit platform-administration tasks.

## Documentation authority

Use documents in this order:

1. this current-status handoff;
2. the active phase ledger for the subsystem being changed;
3. `Tactical_Encounter_Combat_Roadmap_Blueprint.md` for end-state architecture;
4. historical phase/build notes for implementation evidence only;
5. raw SQL/text exports only as historical snapshots—never as authoritative live schema or executable migrations.
