# DNDNext Current Development Status and Roadmap

## Latest #295 — authenticated Attack authorization preflight

**2026-10-27 #295 identity release gate.** Live `encounter_can_control_participant_v1` has a deliberate service_role bypass; the #293 atomic candidate's service_role-only grant does NOT itself attest which player issued the request. The new authenticated-only `encounter_attack_caller_preflight_shadow_v1` verifies caller JWT-context identity, canonical participant control and exact current Attack turn/budget, but never invokes an attack writer. PG16 checks actual SQL roles + simulated JWT context, not signature validity. Next: design a safe signed-in execution adapter, test real tokens, revocation, concurrency and feature-gated rollout only after full grip/subclass/attunement checks. [Detailed design](Authenticated_Attack_Caller_Boundary_2026-10-27.md).


## Latest draft #294 — production helper parity

**2026-10-27 #294 — actual roll/damage parity before real multiattack rollout.** Read-only live schema fingerprints and latest versioned SQL establish dual Guiding Bolt/Vicious Mockery one-use effects plus equipment resistance/flat reduction applied in resistance-first order. New isolated PG16 integration loads those exact helpers, validates dice cancellation, immunity/resistance/flat/vulnerability/temp HP sequencing, failure rollback and #293 candidate exact replay; candidate event now carries full mitigation data. Do not treat #293 deterministic stubs as sufficient for production. Remaining: true signed-in service-role caller identity, special class/action/hand rules, full encounter LOS, rollout gates and explicit merge approval. [Detailed audit](Canonical_Roll_Damage_Parity_2026-10-27.md).


## 2026-10-27 Atomic Attack candidate, draft #293

Newest #293 candidate: service-role-only, unconnected, transactionally stages one Attack action with per-attack rolls/damage, exact request replay, canonical helper calls and failed-transaction rollback. Its isolated tests cover three Fighter attacks, one Action expenditure and one-shot effect consumption; the tests use deterministic helper doubles. **Not production-ready**: subclass/bonus/multiclass features, real roll/damage/cover parity, hand/shield interactions, account-owned custody and signed-in UI acceptance remain blockers. [Candidate technical notes](Attack_Action_Atomic_Weapon_Candidate_2026-10-27.md).


## Latest 2026-10-27 — #292 canonical weapon resolver parity preflight

Draft [#292](https://github.com/bob8675309/DNDNEXT/pull/292) uses the actual stable canonical weapon-profile and LOS/cover/range read surfaces to preflight a #291 ordinal before any irreversible side effects. It requires exact catalogue source identity and character-specific equipped custody. Real attack roll helper `private.encounter_resolve_attack_roll_v1` **consumes one-shot Guiding Bolt**; no preview may call it. No attack, HP, Action, spell slot, effect or combat-log writer touched. Next reviewed phase: a true transactional Attack-event resolver that reserves a source-verified attack slot, consumes one Action, performs each roll/effect/damage exactly once, and preserves existing one-attack RPC compatibility. [Full audit](Attack_Resolver_Preflight_Parity_2026-10-27.md).



## 2026-10-27 — PR #291 Attack-action source-budget sequence (shadow only)

[PR #291](https://github.com/bob8675309/DNDNEXT/pull/291) stages a server-derived Attack-action slot budget from exact PHB/XPHB class and base-class feature source IDs; Fighter 5/11/20 and four standard level-5 classes are regression tested. A guarded one-per-turn session and replay-safe per-attack ordinal ledger exercise concurrency/source bounds **without touching actual Action, damage, spell slots or battleboard**. Critical next release work: reconcile special subclasses, multiclass and Attack replacements; integrate one real action expenditure with multiple authoritative attack-event transactions; then connect weapon interaction timing, shields and spell focus. [Technical scope](Attack_Action_Source_Budget_Shadow_2026-10-27.md). Readiness remains false and production unchanged.



## Latest release dependency — draft #290 canonical Attack-action sequence gap (2026-10-26)

[PR #290](https://github.com/bob8675309/DNDNEXT/pull/290) verifies the live `encounter_weapon_attack_v1` and unarmed writer consume the only `action_available` flag for a single attack. No per-Attack-action Extra Attack budget, per-attack weapon equip event or verified Shield Utilize RPC exists in the inspected runtime. **Do not attach real draw/stow costs to #288's one-per-turn shadow hand limit.** First design/validate the canonical Attack action and authoritative multiattack sequence with idempotency, class-feature attack counts, and exact one-Action spending; then support per-attack weapon interactions, Shield Utilize and somatic/focus action prerequisites. Service-only read-only log auditing and PG16 regression only; no production change. [Detailed audit](Canonical_Attack_Action_Sequence_Gap_2026-10-26.md).



## Latest 2026-10-26 action-cost evidence — draft #289

Draft [#289](https://github.com/bob8675309/DNDNEXT/pull/289) resolves several **data-source** questions, not gameplay costs: exact `payload.property` weapon codes distinguish Two-Handed (`2H`) from Versatile (`V`), Shield type requires distinct Utilize don/doff modeling, and normalized `spells_catalog.components_s/components_m` allow somatic/material hand signals. The #288 shadow one-change-per-turn limit is **not** a 2024 D&D rule; Attack action per-attack weapon interactions must be integrated with the real battleboard attack event lifecycle. Everything remains read-only/unenforced; canonical actions/HP/slots/items unchanged. [Detailed technical audit](Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md). Next: action-time Attack event/Shield Utilize + components exceptions, then consumer and signed-in acceptance.



## Newest staged step — PR #288 transactional shadow hand request ledger (2026-10-26)

Draft [#288](https://github.com/bob8675309/DNDNEXT/pull/288) adds a guarded, atomic encounter hand *shadow state* mutation using participant/encounter locks, ordered source item checks, exact turn identity, unique request UUID/idempotent replay and full-snapshot version updates. The experimental one-applied-change-per-turn constraint **does not impose any official gameplay action cost**, and no main combat Action, Bonus Action, Reaction, equipment, spell focus effect, HP, combat log or slot resource changes. Next milestone: source-reviewed live action-economy and two-hand/shield/caster material-component design and its guarded, fully consumer-integrated real action, plus character-grant/physical custody/rest authorization. [Technical details](Encounter_Hand_Transition_Command_Shadow_2026-10-26.md).



## 2026-10-26 encounter-hand continuation — draft #287

[PR #287](https://github.com/bob8675309/DNDNEXT/pull/287) implements draft-only participant-scoped precombat hand snapshots plus active-turn **read-only preview** of draw/stow/replace. Control, undefeated active turn, snapshot version, exclusive inventory custody and item changes fail closed; physical mutations invalidate the entire capture. No action cost, draw/stow change, spell effect, HP, slot or log writer is called. The next release dependency is a reviewed **actual action-time hand transition model** with draw/stow, two-handed/shield and action economy rules, tested against existing battle-board operations. Details: [Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md](Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md). No live SQL or production merge.



## Latest roadmap extension — 2026-10-26 draft #286

[PR #286](https://github.com/bob8675309/DNDNEXT/pull/286) introduces a separate authenticated staging record for a character's intended main/off hand items, backed by exact inventory ID and existing canonical `weapon_1`–`weapon_3` slots. Isolated checks guard ownership, ambiguous multi-character player inventory, duplicated physical item, active-combat reconfiguration, source/slot invalidation and unchanged tactical spell slots. **Not live, not action-time holding evidence, not focus effect enforcement.** Next critical design is a character/encounter-controlled active-hand action lifecycle with draw/stow swaps, two-hand and focus/somatic rules; then exact spell grants, stacking and server-rest authorization. See [Character_Hand_Loadout_Staging_2026-10-26.md](Character_Hand_Loadout_Staging_2026-10-26.md). All maps, Forge UI and existing equipment semantics remain unchanged.



## 2026-10-26 latest extension — draft #285 spell-list and hand evidence

Stacked [#285](https://github.com/bob8675309/DNDNEXT/pull/285) uses the live `spells_catalog.classes` array for exact class-list membership, distinguishing that evidence from actual character spell grants. It separately identifies contradictory `main_hand`/`off_hand` equipped items and shared-account custody while refusing to infer what is *actively held*. All flags remain fail-closed. No live spells, equip slots, game effects, persistent slot snapshots or production migration changed. Details: [Attuned_Spell_List_Hand_Evidence_2026-10-26.md](Attuned_Spell_List_Hand_Evidence_2026-10-26.md). The next priority is an authenticated active-hand/worn state and spell acquisition authority design with nonregressive, independently testable lifecycle and RLS.



Last reconciled: 2026-10-26 (newest active-work override first; older roadmaps historical)

## 2026-10-26 active development override — optional attunement/effect consumers

**Current technical release authority:** [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). The previous October 24 section below is retained only as a historical checkpoint. Verify GitHub PR heads and live Supabase before mutation.

- Staged **OFF-by-default max-three attunement**: draft [#267](https://github.com/bob8675309/DNDNEXT/pull/267) (Admin rule) → #268 selection → #269/#270 **existing Inventory/Equipment view + Camp/Downtime link** → #271–#274 eligibility/dashboard/source gate → #275–#283 numerical and tactical consumer **shadows** → #284 focused held/worn and spell-source signal audit. Independent #266 Short/Long Rest popup must be reconciled. Superseded [#257](https://github.com/bob8675309/DNDNEXT/pull/257) standard/unlimited prototype must not be deployed.
- Shadow regression coverage: physical armor/AC/saves/ability, Resistance-before-flat-DR, tactical and sheet weapons (including Rage/Pact), player and tactical spell profiles, per-spell overrides and focus candidates. **No shadow is wired into live rolls, slot spending, HP or sheet calculation**; all enforcement/readiness flags remain false.
- Separate staged generic-effect chain #251 → #253 → #255 needs integration later; Physical Specimen #250 is independent.
- **Next phase, in order:** prove server rest authorization; actively held/worn rather than merely equipped weapon/neck slots; class list/multiclass/item spell provenance and legal stacking; per-consumer source-aware adapter parity; multi-character and signed-in combat regression; only then seek release approval. No live SQL migration or main merge authorized yet.
- Do not touch world/town maps, Forge presentation, paper character sheets, physical equipment slots, existing rest recovery or persistent spell resources while doing this work.



This is the current high-level handoff for DNDNext. It reconciles the living roadmap, phase ledgers, repository source, GitHub state, and deployed Supabase state. Historical phase ledgers remain useful implementation records, but this document controls current status when an older status header or unchecked master-roadmap task conflicts with deployed evidence.

## 2026-10-24 reconciled active work — effects parity and campaign attunement

**Authoritative reference:** [DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md). Last verified main `0e925958b49505e010a011b1de4d6de28f30b7b7`; re-fetch.

- **Merged documentation only:** #249 (Workspace), #252 (items/effects audit), #254 (cross-chat effects/AI handoff), #256 (PR status reconciliation). Do not count these as pending work or instruct a future developer to merge them.
- **Draft gameplay work:** #250 Physical Specimen remains separate/incomplete. The common effects chain is #251 → #253 → #255 (stacked bases, not independent main PRs). #255 includes 16 authentic item-source subsets in isolated PostgreSQL parity tests, with known unsupported effects and attunement issues.
- **New draft campaign configuration:** #257 adds standard three-item or unlimited attunement capacity beside future-tech control, with a separate per-character item-bond model; existing equip slots are unchanged. It is not deployed and does not yet enforce all Short Rest, class/source, magical-property suppression or tactical consumers. Refer to its status ledger.
- **Next ordered tasks:** prove source-specific bond eligibility and rest requirements; verify per-character inventory across player/NPCs, attunement-aware canonical sheet/weapon/spell/damage consumers and class exceptions; then assess a minimal gameplay integration after parity and owner approval.
- Future AI integration remains provider-neutral, read-only and permission-filtered as specified in the existing AI foundation. It is not an active deployment.
- All older Forge, Tarot and tactical milestones below record accepted historical checkpoints rather than current effects-branch instructions. Preserve working systems and source-specific rest lifecycles.

## 2026-10-09 active-work override

Current production authority is consolidated on `main`.

- PR #199 is merged; its floating ruined-library Tarot selector is the accepted Class/subclass presentation.
- PR #202 is merged; Metamagic Adept nested choices, invocation summaries, and Forge SpellCard browsing are part of the current Forge baseline.
- All 36 required new Grim Hollow expansion Tarot cards are installed/mapped on `main`.
- PR #203's Grim Hollow Player's Guide source-content import is reconciled and folded into `main`.
- Live Grim Hollow Player's Guide catalogue now includes 101 spells, 40 subclasses / 258 subclass-feature rows, and 106 items.
- The item seeder's source-price path was hardened so normalized GP prices are retained instead of reading raw 5etools cp values as gp.
- Current Grim Hollow Tarot queue: 0; all 185 runtime-visible subclass choices have dedicated approved Tarot coverage.
- Current `main` checkpoint `3b4cb1113b170d703f4f161f8ac149a3e7f2ffe9` (PR #204) is production-deployed READY; `/profile` returned HTTP 200.

The detailed roadmap below remains useful architecture/history, but branch/PR status in older override sections is historical.

### Current next priority — Character Forge completion with future AI compatibility

Before beginning AI implementation, perform a current-main Character Forge completion audit across Species, Background, Class, Abilities, Training, Spells, Equipment, Identity, Story, and Review. Accepted slices should not be broadly redesigned without a reproduced defect.

The future AI architecture is defined in `docs/DNDNEXT_AI_INTEGRATION_FOUNDATION.md`. Character Forge work should support that future direction by preserving structured canonical ids, source/provenance, lifecycle distinctions, permission boundaries, and reusable read models. No AI-specific persistence or duplicate character state should be introduced.

After Forge completion, the planned first AI proof is a local/admin-only magic-item drafting layer that populates the existing item-creation modal without bypassing its Save/validation path. NPC/monster text interaction comes after that.


## 2026-10-01 active-work override

The detailed roadmap below remains architecture/history. Current active work is PR #199 on `agent/subclass-tarot-scene-rebuild-20260922`.

Validated pre-documentation checkpoint:

- PR #199 head: `89197828b6ae9945ac436da4339ef910c379eb4c`;
- PR state: **open / mergeable / unmerged**;
- GitHub Actions: **11/11 successful**;
- Vercel deployment `3KoiKyA8wXeWPkMfVME5CFfXjToD`: **READY / success**;
- no Supabase migration/data change.

The current Class/subclass work is presentation-only: floating ruined-library Tarot carousel, independent Subclass Codex, and independent Class Feature panel. The two floating windows may coexist and use separate callbacks/state. Subclass persistence, progression, source authority, and protected map/town/tactical/crafting systems remain unchanged.

Next acceptance work is browser validation of readability/coexistence, Wizard and small catalogues, interaction motion, responsive layouts, and reduced motion. Do not merge PR #199 without explicit user approval.

## 2026-08-14 historical active-work checkpoint

The detailed tactical and platform roadmap below remains valid history, but the active development line has moved forward:

- PR #170 is merged at `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- active branch `agent/species-art-post170` is PR #171, open and unmerged;
- latest validated code head is `39a263e034db4023ed7d1a4950a185a832c08867`;
- all 14 workflows triggered for that head and Vercel completed successfully;
- Supabase remains healthy through migration 93, with 166 raw / 102 preferred Species rows;
- no database write or migration was made for the PR #171 artwork/layout/presentation continuation;
- Paul considers the shared Player/NPC Forge Species tab nearly perfect.

The current transition authority is `DNDNext_Current_Handoff_Prompt.md`; the detailed active Species ledger is `Forge_Post170_Species_Artwork_Status.md`. Unless a concrete Species regression is reproduced, the next Forge work should move to Background, Class, or the next tab Paul selects as a separate bounded pass.

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

- Production runtime baseline: current `main`; the last fixed production anchor before this reconciliation was `6f57b8f5827e5b286bf9b7fa66b1108436c8285d` (PR #147 merge).
- PRs #136-#147 exact-head previews and merged `main` production Vercel deployments: green.
- Milestone 2 durable-start PR #113: squash-merged as `8028813cb0ca665d06271946198f2db331d79cf2`; exact-head and production Vercel deployments green.
- Milestone 2 lifecycle-guard PR #114: squash-merged as `e1cfdf9d83ecd18a79fb5ac27db55ae5e96758de`; exact-head and production Vercel deployments green.
- Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`, healthy.
- Latest deployed source migration slice:
  - `20260801_01_crafting_completion_normalization.sql`;
  - `20260801_02_equipped_armor_canonical_ac.sql`;
  - `20260801_03_shared_equipment_effects_pipeline.sql`;
  - `20260801_04_shared_equipment_effects_tactical_modifiers.sql`.
- Protected live baseline: 7 characters, 7 character sheets, 3 Auth users, 3 player profiles, 3 character permissions, 32 character-spell assignments, 18 inventory items, 1 encounter map, 5 encounters, 16 participants, 20 combat-log rows, and 2 resolved reaction windows. One smoke encounter remains active at Round 6 / Version 63.
- Protected world baseline: 20 locations, 4 map routes, and 9 map route points.

## Platform foundations already operating

### Character, NPC, and content systems

- Player creation and NPC Forge.
- Canonical character sheets, permissions, inventories, equipment, portraits, classes, spellbooks, feats, boons, and character options.
- XP, progression state, supported transactional level-up completion, class overview, and level guide.
- Profile-panel Class, Sheet & Rolls, Inventory, Spellbook, optional Shop, and optional Craft surfaces. The direct `/npcs` page and shared Profile panel place the portrait inside the Description content card with text wrapping below it; the old separate full-height portrait/About duplication is retired.
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
- Linked-player profile loads reject superseded session results after every async boundary (PR #138).
- Profile routes now open the character panel after a successful linked-character lookup, and the profile page exposes an explicit open button while preserving navbar and Backspace controls.
- Character inventory reads/equipment writes now honor character permissions through guarded RPCs, so linked player characters retain canonical character-owned inventory without duplicating ownership rows.
- Sheet & Rolls now derives a vertical quick-action list from canonical weapons, known cantrips, prepared spells, and resolved feature rows; standalone clicks calculate or display roll math, while encounter execution remains routed through guarded tactical authority. The direct `/npcs` sheet and embedded NPC profile panel share the same action inputs and high-contrast attack/damage result presentation, each action category can be collapsed independently, dual melee/thrown weapons explain the mode pill in Details, and the pinned Description stays top-aligned with slightly larger body text.
- Barbarian and Monk Unarmored Defense are resolved consistently by the browser sheet and canonical database equipment/AC pipeline.
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

The canonical `Weapon of` catalog drift was source-baked on 2026-08-02, restoring the standing enchanting workflow without changing enchanting formulas, slot rules, completion authority, or database state.

### Milestone 2 — first durable campaign encounter — IN PROGRESS

Production setup and interaction slices complete through 2026-08-02:

- `/encounters/live` now reflects the deployed encounter engine instead of stale Phase 1C guidance and links directly to Turn Play and Combat.
- `admin_start_encounter_v1` atomically validates staged participants, initiative, map bounds, blockers, and occupied start hexes; selects the first initiative participant; initializes turn resources; activates the encounter; and writes an `encounter_started` log.
- The legacy `admin_set_encounter_status_v1` compatibility entry point delegates staged `active` transitions to the same durable-start authority while preserving paused-to-active resume behavior.
- Start/lifecycle authority is validator-backed and passed exact-head plus merged-production Vercel gates.
- `/encounters/smoke` can idempotently prepare the guarded reusable radius-6 arena and four-actor staged encounter without direct table writes or automatic combat start (PR #116).
- Staging roster reads, first-use ability guidance, command lock release, and post-command UI reconciliation were hardened through PRs #118-#124.
- Attack results now expose clearer roll outcomes and durable per-entry attack math while rejecting delayed stale-result reconciliation (PRs #123-#126).
- The reusable smoke encounter was exercised through four full rounds and part of rounds 5-6. Live acceptance covered difficult terrain, movement, equipped crafted weapons, Dodge disadvantage, opportunity reactions, healing, saves, spell slots, multi-target Magic Missile, duplicate-request idempotency, stale-client rejection, pause/resume, refresh, and tab-away/tab-return reconstruction.
- The accepted handoff is Round 6 / Version 63 with Pip active at 5 HP and no pending reaction window. The current encounter is preserved for later observation; it must not be restaged or reset by setup tooling.
- No world-map or town/city-map source was changed, and the protected 20/4/9 world baseline remained exact.
- Account provisioning is complete: the live project now has three Auth users and three player profiles.

Still required before Milestone 2 is complete:

- Prepare a fresh staged smoke session on the reusable arena, assign its actors to GM / Player A / Player B, and start it through the guarded durable-start command. Do not rewrite controller ownership on the active Round 6 session.
- Run the real three-session ownership, turn-sync, movement-sync, reconnect, stale-client, reaction-owner, and GM-override matrix.
- Resolve/archive and verify cleanup only after the multi-client evidence is recorded. Preserve the reusable map and keep campaign/world state unchanged.

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

- Sheet & Rolls now derives a unique Feats & Traits list from Feats & Boons grants, preferred species traits, and acquired base/subclass catalog features through the character's current level. Its compact one-line action rows keep one row per physical weapon, use a melee/thrown mode pill to select the active rules profile, apply conditional species reach without rewriting item data, roll attack and damage together for attack actions, expose expandable details, and support guarded persistent standalone feature state beginning with Rage.
- Reuse the shared Sheet & Rolls quick-action model in a compact battle-board overlay. The overlay should supply encounter targets and submit the selected action through guarded tactical RPCs; it must not spend actions, slots, reactions, or HP through the standalone sheet roller.
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
- Direct `/npcs` and shared Profile portrait placement are source-owned inside the Description content layout; text wraps beside and below the portrait.
- Merchant, crafter, and profile portrait sizing/bleed are source-owned. Treat them as complete unless a new browser reproduction identifies a specific regression.
- Continue the broader audit of route-specific Supabase clients, query shape, dynamic imports, Bootstrap timing, and Realtime subscription duplication. `MapPageClient` remains outside scope until world-map work is explicitly authorized.

### Security and database maintenance

- Review tactical and non-tactical advisor findings in a dedicated hardening pass.
- Do not blanket-revoke authenticated `SECURITY DEFINER` RPCs; many are intentional guarded command boundaries.
- Prioritize proven unindexed foreign keys and per-row RLS auth initialization issues before scale testing.
- Keep storage listing, Auth settings, and managed PostgreSQL patching as explicit platform-administration tasks.

## Documentation authority

Use documents in this order:

1. `DNDNext_Current_Handoff_Prompt.md` and `Documentation_Refresh_Manifest.md` for current GitHub/Supabase/transition authority;
2. the active dedicated ledger for the subsystem being changed;
3. this broad roadmap for platform direction;
4. `Tactical_Encounter_Combat_Roadmap_Blueprint.md` for tactical end-state architecture;
5. historical phase/build notes for implementation evidence only;
6. raw SQL/text exports only as historical snapshots—never as authoritative live schema or executable migrations.
