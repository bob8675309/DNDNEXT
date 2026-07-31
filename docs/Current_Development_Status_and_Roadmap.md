# DNDNext Current Development Status and Roadmap

Last reconciled: 2026-07-30

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

- GitHub production `main`: `3812b849c5941e5ee170b7eea5e54191c07ca249`.
- Production Vercel deployment for `main`: green.
- Active tactical client PR: #111, branch `agent/phase1z-lightning-bolt-ui`; validated implementation head before the documentation refresh: `0faaa5ad4d5605d22f6bb9d00c311a2ee73d4828`.
- At the 2026-07-30 audit, PR #111 was open, draft, mergeable, and its last hosted attempt was blocked only by the Vercel account build-rate limit. The combined client/documentation head must receive a fresh hosted result.
- Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`, healthy.
- Latest deployed migration: `20260730195028 tactical_lightning_bolt`.
- Protected live baseline: 5 characters, 17 character-spell assignments, 0 Lightning Bolt assignments, and no persistent tactical fixture rows.
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

Phase 1Z client source is complete and locally validated with the 39-validator tactical suite. It must not merge until the exact PR #111 head receives a real green Vercel deployment.

## Reaffirmed delivery roadmap

### Milestone 1 — close Phase 1Z and synchronize documentation

1. Wait for Vercel quota.
2. Build the exact combined PR #111 head after the documentation refresh.
3. Require a green final-head preview.
4. Merge linearly.
5. Verify production and protected DB/world baselines.
6. Mark Phase 1Z complete and update the master progress ledger.

The unrelated enchanting workflow failure at its canonical `Weapon of` verification step belongs in a separate maintenance patch.

### Milestone 2 — first durable campaign encounter

- Create one reusable tactical map and encounter template.
- Stage representative PCs and enemies.
- Run several complete rounds with one GM and at least two player sessions.
- Exercise movement, weapons, reactions, saves, healing, slots, AoE, reconnect, stale-client rejection, and cleanup.
- Record real usability gaps before broadening automation.

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

- Reconfirm whether the town fallback-image flash still reproduces before patching it.
- Move profile portrait placement into the Description content layout if still outstanding.
- Normalize merchant/crafter/profile portrait sizing.
- Audit repeated auth calls, query shape, dynamic imports, Bootstrap timing, and Realtime subscription duplication.

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
