# Tactical Encounter / Dungeon Combat Roadmap & Blueprint

Last updated: 2026-07-26  
Status: living roadmap; implementation is intentionally phased.  
Baseline when this roadmap was created: `35c1cf48df612b2cceff3e0663cb598ec1850c83` (`main`).

This document is the long-term implementation roadmap for DNDNext's tactical encounter system. It exists so individual feature passes do not lose sight of the final product, so completed work can be marked in place, and so design decisions can be changed deliberately instead of being rediscovered ad hoc.

The target experience is a tactical, board-game-readable dungeon encounter presentation inspired by the readability and atmosphere of games such as Gloomhaven, while the rules engine remains D&D 5e-based and DNDNext-specific. The intent is not to reproduce another game's assets, UI, card rules, or encounter mechanics. The system should feel like DNDNext: the existing character sheets, species, classes, feats, spells, equipment, professions, portraits, campaign locations, and GM tools remain the source of truth.

---

## 1. End-state vision

DNDNext has two distinct but connected map experiences.

### World / town exploration

The existing world and town map systems continue to handle campaign travel, routes, locations, weather, camp/travel timing, merchants, crafters, town interactions, and the existing small-map sprites.

### Tactical encounter / dungeon combat

A separate encounter engine presents a hex-grid battle board where:

- 1 hex = 5 feet;
- player characters, allied NPCs, monsters, summons, hazards, and objects occupy the board;
- combat uses D&D 5e movement, initiative, actions, bonus actions, reactions, attacks, saves, spells, class/species/feat abilities, conditions, HP, concentration, and resource consumption;
- each logged-in player controls only the character(s) they are permitted to control;
- the GM controls monsters, NPCs, encounter state, hidden information, map reveals, overrides, and environmental effects;
- all important state transitions are server-authoritative rather than trusted to browser state;
- multiple clients watch the same encounter in real time;
- characters use the same canonical sheets and inventories used elsewhere in DNDNext;
- portraits and sprites are selected assets, not hard-wired to one another;
- a portrait may suggest a matching sprite, but the user can choose a different sprite;
- richer 8-direction sprites support both idle and walking animation while legacy 4-direction assets remain valid.

The final system should support a full encounter from GM setup through initiative, player turns, tactical movement, attacks/spells, victory/defeat, rewards, and return to campaign play without modifying world-route logic.

---

## 2. Non-negotiable architecture boundaries

These constraints apply to every phase unless this document is explicitly amended.

### 2.1 Do not merge tactical movement into world movement

The tactical encounter engine must not reuse or rewrite world-map route progression as its movement authority.

Do not replace or overload:

- route travel functions;
- world character interpolation;
- weather/travel/camp logic;
- world clock travel semantics;
- town movement semantics;
- existing world-map drag placement semantics.

A character can participate in an encounter while still having a campaign/world location, but tactical coordinates are encounter-local state.

### 2.2 One canonical character, multiple presentations

Do not create a separate "combat character" copy of a player or NPC.

The encounter participant references the canonical character and stores only encounter-scoped state such as:

- tactical position;
- current initiative;
- current HP snapshot where appropriate;
- temporary HP;
- movement remaining;
- turn resources;
- conditions/effects;
- facing/animation state;
- hidden/revealed state;
- encounter-specific flags.

Permanent progression, inventory, feats, spells, equipment, class data, and profile identity continue to belong to the canonical character systems.

### 2.3 Server-authoritative gameplay

The browser may preview legal moves and targets, but the server must decide whether a state-changing action is valid.

At minimum the server must validate:

- authentication;
- player ownership/control;
- encounter membership;
- encounter phase;
- active turn;
- legal movement budget;
- destination legality;
- action/bonus action/reaction availability;
- range and targeting rules where supported;
- resource availability;
- spell slot / item / feature consumption;
- GM-only overrides.

### 2.4 Backward compatibility for existing sprites

The existing map renderer remains a valid legacy consumer.

Current baseline behavior:

- 32×32 frames;
- four directions: down, left, right, up;
- three walking frames per direction;
- direction selected from existing movement velocity.

Rich tactical assets must not invalidate these sheets.

### 2.5 Portrait and sprite are independent choices

The visual-asset system should evolve away from a forced one-to-one portrait/sprite relationship.

Desired behavior:

- choose portrait independently;
- choose sprite independently;
- show a "Suggested match" when a portrait and sprite are intentionally paired;
- permit changing either without changing the other;
- preserve tags/metadata so future filters can suggest visually appropriate alternatives.

The current `npc_visual_assets` portrait association is a useful starting point, but the long-term relationship is recommendation/association, not a hard requirement.

### 2.6 5e rules over board-game rules

Hex presentation does not change core D&D 5e rules unless the campaign explicitly adds a house rule.

Examples:

- a 30 ft. speed normally produces six 5 ft. hexes of movement;
- Dash adds movement according to 5e action rules;
- difficult terrain consumes additional movement;
- attacks use attack rolls / AC where applicable;
- spells use the canonical spell data and save/attack rules;
- initiative is D&D initiative unless deliberately overridden by the GM;
- action economy remains Action / Bonus Action / Reaction / movement plus class-specific resources.

---

## 3. Current foundation already available

This section records systems that exist today and should be reused rather than rebuilt.

### Character/profile foundation

- canonical characters and character sheets;
- species/background/class creator flow;
- ability scores, skills, feats, progression, spellbook, inventory, equipment, professions;
- profile panels shared across player/NPC/town/map contexts;
- player-linked accounts and authentication;
- admin authorization patterns.

### Visual foundation

- portrait library;
- portrait selection in NPC Forge;
- existing map `sprite_path`, `sprite_key`, and `sprite_scale` support;
- legacy 4-direction map sprite renderer;
- `npc_visual_assets` metadata foundation;
- rich asset metadata for frame size, direction order, idle frame, walk frames, FPS, and default scale;
- optional legacy companion sprite path for rich assets.

### World foundation

- campaign locations;
- current world/town maps;
- character world placement;
- map NPC/merchant interaction panels;
- separate route/travel simulation.

### Backend foundation

- Supabase/Postgres;
- RLS and authenticated/admin patterns;
- RPC-centered protected state changes;
- Supabase Realtime suitability for encounter subscriptions;
- Vercel/Next.js Pages Router frontend.

---

## 4. Product-level decisions

These are the decisions this roadmap currently treats as approved.

### 4.1 Encounter maps are a separate engine

The encounter surface may be reachable from the main map experience, but its implementation must remain isolated from existing world-map movement.

Recommended routing direction:

- `/map` — current world/town experience;
- `/encounters` — encounter list / GM staging;
- `/encounters/[id]` — live tactical board;
- optional later integration: a Map page mode switch that navigates into the encounter route without merging movement implementations.

### 4.2 Hex scale

`1 hex = 5 feet`.

Use axial hex coordinates internally:

- `q` — column-like axial coordinate;
- `r` — row-like axial coordinate.

Distance for equal-cost hexes:

`distance = (abs(dq) + abs(dr) + abs(dq + dr)) / 2`

Movement cost must be calculated as distance/path cost, not pixel distance.

### 4.3 Visual direction target

Preferred rich sprite format:

- 8 directions;
- 1 idle frame per direction;
- 3 walking frames per direction initially;
- direction order recorded in metadata, never assumed globally;
- recommended master frame size: 64×64 for tactical readability;
- optional 32×32 legacy 4-direction derivative for current world map.

Target logical directions:

1. down / south;
2. down-left / southwest;
3. left / west;
4. up-left / northwest;
5. up / north;
6. up-right / northeast;
7. right / east;
8. down-right / southeast.

The renderer must use metadata rather than rely on this order forever.

### 4.4 Portrait/sprite selection model

Creator flow should eventually present two independent controls:

**Portrait**
- choose from library;
- upload/import later;
- preview;
- filter by species/profession/theme.

**Map / combat sprite**
- suggested sprite displayed first if one is associated with the portrait;
- browse all compatible sprites;
- filter by species/body type/profession/theme/style;
- preview idle and walk cycle;
- choose "No sprite yet" where allowed;
- GM can replace later.

A future many-to-many suggestion table is preferred over making `portrait_library_id` mandatory on every sprite asset.

### 4.5 Tactical aesthetic

Desired presentation:

- dark fantasy tabletop / diorama tone;
- highly readable hexes;
- terrain art beneath gameplay overlays;
- strong selected/current-turn indication;
- reachable movement area clearly highlighted;
- targetable hexes/units clearly differentiated;
- unobtrusive but readable initiative rail;
- character portrait/profile identity still prominent;
- effects should support atmosphere without making board state ambiguous.

---

## 5. Proposed high-level architecture

```text
Canonical Character Systems
  ├─ character sheet / class / species / feats
  ├─ spellbook
  ├─ inventory / equipment
  ├─ portrait
  └─ selected sprite asset
             │
             ▼
Encounter Session
  ├─ encounter map
  ├─ participants
  ├─ initiative / active turn
  ├─ tactical positions
  ├─ movement/action resources
  ├─ conditions / effects
  ├─ visibility
  └─ action log
             │
       server-authoritative RPCs
             │
             ▼
Supabase Realtime
             │
     ┌───────┴────────┐
     ▼                ▼
Player Client      GM Client
own character      all permitted units
legal moves        overrides / enemies
legal actions      map control / reveals
```

The client should never directly update authoritative encounter state tables for gameplay actions.

---

## 6. Proposed database blueprint

Names below are proposed contracts, not permission to create all tables at once. Each phase should introduce only what it needs.

### 6.1 `encounter_maps`

Reusable tactical board definition.

Suggested columns:

- `id uuid primary key`;
- `name text`;
- `description text`;
- `image_bucket text`;
- `image_path text`;
- `hex_orientation text` (`pointy` or `flat`);
- `hex_size numeric` — render scale, not 5e distance;
- `origin_x numeric`;
- `origin_y numeric`;
- `width_hexes integer`;
- `height_hexes integer`;
- `default_environment jsonb`;
- `metadata jsonb`;
- `created_by uuid`;
- timestamps.

### 6.2 `encounter_map_objects`

Doors, walls, cover, traps, chests, objectives, hazards, spawn points, interactables, and decorative blockers.

Suggested columns:

- `id uuid`;
- `map_id uuid`;
- `object_type text`;
- `q integer`;
- `r integer`;
- `footprint jsonb`;
- `blocks_movement boolean`;
- `blocks_los boolean`;
- `cover_level text`;
- `hidden_by_default boolean`;
- `interaction_type text`;
- `state jsonb`;
- `metadata jsonb`.

Do not make terrain rules depend exclusively on image pixels.

### 6.3 `encounter_hex_overrides`

Sparse gameplay data for specific hexes rather than storing every hex as a row.

Suggested columns:

- `map_id`;
- `q`;
- `r`;
- `terrain_type`;
- `movement_multiplier`;
- `elevation`;
- `hazard_key`;
- `metadata`.

Primary key: `(map_id, q, r)`.

### 6.4 `encounters`

One live or historical encounter session.

Suggested columns:

- `id uuid`;
- `map_id uuid`;
- `name text`;
- `status text`: `draft`, `ready`, `initiative`, `active`, `paused`, `resolved`, `archived`;
- `round integer`;
- `turn_index integer`;
- `active_participant_id uuid`;
- `phase text`;
- `gm_user_id uuid`;
- `started_at`;
- `resolved_at`;
- `settings jsonb`;
- `version bigint` for optimistic concurrency / audit ordering.

### 6.5 `encounter_participants`

Encounter-scoped tactical state.

Suggested columns:

- `id uuid`;
- `encounter_id uuid`;
- `character_id uuid nullable`;
- `monster_instance_id uuid nullable` or future canonical creature reference;
- `display_name text`;
- `team text`;
- `controller_user_id uuid nullable`;
- `q integer`;
- `r integer`;
- `facing text`;
- `initiative numeric`;
- `initiative_tiebreaker numeric`;
- `current_hp integer`;
- `temp_hp integer`;
- `movement_spent_ft integer`;
- `action_available boolean`;
- `bonus_action_available boolean`;
- `reaction_available boolean`;
- `concentration_effect_id uuid nullable`;
- `is_hidden boolean`;
- `is_defeated boolean`;
- `sprite_asset_id uuid nullable`;
- `state jsonb`.

Larger creatures must support multi-hex footprints later without rewriting participant identity.

### 6.6 `encounter_effects`

Conditions, spell effects, environmental effects, concentration-linked effects, timed buffs/debuffs.

Suggested columns:

- `id uuid`;
- `encounter_id uuid`;
- `source_participant_id uuid nullable`;
- `target_participant_id uuid nullable`;
- `target_hexes jsonb nullable`;
- `effect_key text`;
- `condition_key text nullable`;
- `duration_type text`;
- `expires_round integer nullable`;
- `expires_turn_marker text nullable`;
- `concentration boolean`;
- `payload jsonb`;
- timestamps.

### 6.7 `encounter_action_log`

Append-only audit/combat log.

Suggested columns:

- `id bigint generated always as identity`;
- `encounter_id uuid`;
- `sequence bigint`;
- `actor_participant_id uuid nullable`;
- `action_type text`;
- `action_key text nullable`;
- `request_id uuid`;
- `payload jsonb`;
- `result jsonb`;
- `created_by uuid`;
- `created_at`.

Every authoritative action should be traceable enough to explain what happened.

### 6.8 `encounter_visibility`

Later-phase per-user/per-team fog/reveal state.

Potential representations:

- discovered hex sets;
- visible object IDs;
- revealed participant IDs;
- team-level visibility groups.

Do not build this before movement and turn authority are stable.

### 6.9 Visual suggestion relation

Long-term preferred structure:

`portrait_sprite_suggestions`

- `portrait_library_id`;
- `visual_asset_id`;
- `match_rank`;
- `match_reason`;
- `is_curated`;
- unique pair constraint.

Then make portrait and sprite selection independent. A sprite asset may still have tags and a primary inspiration portrait, but the creator should not require a strict foreign-key pairing to select it.

---

## 7. Proposed RPC / command boundary

Exact names may change, but the authority pattern should remain stable.

### Encounter lifecycle

- `admin_create_encounter_v1`
- `admin_update_encounter_map_v1`
- `admin_add_encounter_participant_v1`
- `admin_remove_encounter_participant_v1`
- `admin_start_encounter_v1`
- `admin_pause_encounter_v1`
- `admin_resume_encounter_v1`
- `admin_resolve_encounter_v1`

### Initiative / turn control

- `encounter_roll_initiative_v1`
- `encounter_end_turn_v1`
- `admin_set_active_turn_v1`
- `admin_reorder_initiative_v1`

### Movement

- `encounter_preview_move_v1` may be client-side initially, but authoritative submission should use:
- `encounter_move_participant_v1`

Movement RPC validates:

- caller can control participant;
- encounter active;
- participant's turn unless GM override;
- source position current;
- path contiguous;
- path not blocked;
- movement cost <= movement remaining;
- footprint valid;
- destination valid;
- difficult terrain/effects applied;
- version/request ID prevents double application.

### Combat actions

Later:

- `encounter_use_action_v1`
- `encounter_attack_v1`
- `encounter_cast_spell_v1`
- `encounter_use_feature_v1`
- `encounter_use_item_v1`
- `encounter_apply_reaction_v1`

Do not make one huge universal JSON RPC until individual rules are understood. Shared primitives can be extracted after several validated action types exist.

### GM control

- `admin_move_encounter_participant_v1`
- `admin_apply_damage_healing_v1`
- `admin_set_condition_v1`
- `admin_reveal_object_v1`
- `admin_spawn_participant_v1`

Every GM override should be logged.

---

## 8. Authentication and ownership model

### Players

A player can read an encounter when allowed by encounter membership/campaign rules.

A player may command a participant only when:

- the participant resolves to a character they own/control; or
- the GM explicitly grants temporary control.

Players cannot directly:

- move another player's token;
- move monsters;
- alter initiative order;
- alter hidden state;
- grant resources;
- bypass movement cost;
- edit encounter objects;
- change HP directly unless through an authorized action.

### GM/admin

GM/admin can:

- create/edit encounters;
- control NPCs/monsters;
- override movement/turn order;
- reveal/hide information;
- adjust combat state;
- resolve edge cases.

The UI should distinguish a normal rules action from a GM override in the action log.

---

## 9. Hex board rendering blueprint

### Coordinate system

Store logical axial coordinates, render pixels from those coordinates.

Never store authoritative token positions as screen pixels.

### Renderer responsibilities

- board image / terrain;
- hex overlay;
- objects;
- tokens;
- selection;
- reachable-area overlay;
- path preview;
- target overlay;
- AoE overlay;
- condition/effect markers;
- hidden/fog layer;
- initiative/current-turn cues.

### Initial movement pathfinding

Use weighted hex pathfinding such as A*.

Cost inputs:

- 5 ft. base step;
- difficult terrain multiplier;
- occupied blocking hexes;
- walls/doors;
- movement modes later (walk/fly/swim/climb/burrow);
- special effects later.

Do not add elevation, jumping, flight, squeeze, and opportunity attacks all in the first movement milestone.

### Mobile / desktop interaction

Desktop:

- hover preview;
- click token;
- click/drag path or click destination;
- explicit confirm where an action consumes resources.

Touch:

- tap token;
- tap destination;
- visible path preview;
- confirm move.

---

## 10. Turn engine blueprint

### Encounter phases

Recommended initial state machine:

`draft -> ready -> initiative -> active -> paused -> resolved -> archived`

### Per-turn reset

At the beginning of a participant's turn, initialize encounter-scoped resources from canonical rules:

- movement available;
- action available;
- bonus action available;
- start-of-turn effects;
- recharge/feature logic only when supported.

### End turn

End-turn RPC should:

1. validate caller/control;
2. process end-of-turn effects;
3. advance initiative index;
4. increment round when wrapping;
5. reset reaction at the correct rules boundary;
6. process next participant start-of-turn effects;
7. publish new authoritative state;
8. append action log entries.

### Realtime

Clients subscribe to encounter-relevant tables/events.

Realtime informs the UI; it does not grant authority.

A reconnecting client must be able to reconstruct the complete current encounter from database state without relying on missed realtime messages.

---

## 11. 5e movement roadmap

### MVP movement

- walking speed;
- 5 ft. hexes;
- occupied hex blocking;
- map blockers;
- difficult terrain;
- Dash;
- manual GM movement override.

### Next movement layer

- prone;
- grappled;
- restrained;
- disengage tracking;
- opportunity attack trigger prompts;
- forced movement;
- creature size / footprints;
- squeezing.

### Advanced movement

- flying;
- climbing;
- swimming;
- burrowing;
- elevation;
- jump distance;
- teleportation;
- special terrain rules.

Each movement type should be added only after its path/range/occupancy contract is testable.

---

## 12. Combat action roadmap

### Basic attacks

First rules-complete attack slice:

- select attack;
- determine valid targets/range;
- roll attack;
- resolve hit/miss against AC;
- roll damage;
- apply resistance/vulnerability/immunity when canonical data exists;
- update HP;
- log result.

### Saving throw effects

- determine save ability/DC;
- roll/save bonuses from sheet;
- resolve success/failure;
- apply damage/effect;
- log rolls and modifiers.

### Action economy

Track:

- Action;
- Bonus Action;
- Reaction;
- movement spent;
- feature-specific resources.

Do not infer that every feature consumes the same resource type. Use canonical feature/spell metadata or explicit adapters.

---

## 13. Spellcasting blueprint

DNDNext already has spell catalogue and spellbook foundations. Tactical spell support should consume that data instead of creating a second spell list.

### Spell requirements

Supported tactical spell metadata will eventually need:

- casting time;
- range;
- target type;
- attack vs save;
- save ability;
- damage/healing formula;
- damage type;
- duration;
- concentration;
- AoE geometry;
- movement/condition effects;
- resource/slot level;
- upcasting behavior.

### Targeting geometry

Support incrementally:

1. self;
2. one creature;
3. one hex/point;
4. radius;
5. line;
6. cone;
7. cube/area approximations suitable for hexes;
8. persistent zones.

A spell can remain manual/GM-assisted until its structured tactical metadata is validated.

### Concentration

Later implementation must ensure:

- one concentration effect per caster;
- casting a new concentration spell ends the prior one;
- damage can trigger concentration saves;
- losing concentration removes linked effects.

---

## 14. Features, feats, species, and class abilities

Do not attempt to automate every imported rule immediately.

Use three tiers:

### Tier A — fully automated

Rules with structured, tested tactical behavior.

### Tier B — assisted

UI presents the feature and consumes known resources, but the GM confirms or chooses targets/results.

### Tier C — manual

Feature text is accessible from the profile/turn panel and GM applies the result manually.

Over time move high-use features from C -> B -> A.

This avoids blocking tactical play until every 5e edge case is encoded.

---

## 15. Conditions and effects

Initial condition set should prioritize common combat conditions:

- prone;
- grappled;
- restrained;
- poisoned;
- frightened;
- charmed;
- stunned;
- incapacitated;
- unconscious;
- invisible;
- blinded;
- deafened.

Each condition needs explicit tactical consequences rather than only a badge.

Where automation is not ready, store/display the condition and let GM adjudication remain possible.

---

## 16. HP, death, and recovery

Encounter HP must remain consistent with canonical character state.

Decide per participant type whether HP updates should be live-linked or encounter-snapshotted with explicit reconciliation.

Recommended player-character behavior:

- encounter uses canonical current HP as starting state;
- authoritative damage/healing updates canonical current HP promptly;
- temporary HP remains tracked correctly;
- death saves tracked for player characters when appropriate;
- encounter resolution does not silently restore HP.

Monster/NPC encounter instances may use encounter-local HP when they are temporary combatants.

---

## 17. GM encounter builder

The GM needs a usable board-building workflow before advanced combat rules.

### Map setup

- upload/select background art;
- calibrate hex size/origin;
- choose flat/pointy orientation;
- set board extents;
- preview coordinates.

### Object placement

- wall;
- door;
- difficult terrain;
- hazard;
- trap;
- chest/interactable;
- objective;
- spawn zone;
- cover marker.

### Participant staging

- add player characters;
- add existing NPCs;
- add monsters/templates later;
- choose team/faction;
- place spawn hex;
- set hidden/revealed;
- assign controller where necessary.

### Encounter controls

- begin initiative;
- pause;
- resume;
- next turn;
- override turn;
- force move;
- apply HP/effects;
- spawn reinforcement;
- end encounter.

---

## 18. Player turn UX

When it is a player's turn, their profile should expose a focused combat interface.

Recommended layout:

### Persistent information

- portrait;
- name/class/level;
- HP/temp HP;
- AC;
- speed / movement remaining;
- conditions;
- concentration;
- initiative;
- current turn state.

### Action categories

- Move;
- Attack;
- Spells;
- Features;
- Items;
- Bonus Action;
- End Turn.

### Movement UX

1. Select token.
2. Reachable hexes highlight.
3. Hover/tap destination previews path and movement cost.
4. Confirm move.
5. Remaining movement updates.

The player should never need to count hexes manually for ordinary movement.

---

## 19. Sprite and animation blueprint

### Rich tactical master

Initial target:

- 64×64 frame cell;
- 8 directions;
- 4 columns per direction: idle, walk 1, walk 2, walk 3;
- transparent background;
- consistent footprint and anchor point;
- metadata-defined direction order and FPS.

### Legacy derivative

For existing world-map compatibility:

- 32×32;
- 4 directions: down, left, right, up;
- 3 walking frames;
- generated or curated from the same visual design.

### Asset selection

The creator should eventually show:

- selected portrait;
- suggested matching sprite;
- Browse Sprites button;
- sprite preview animation;
- independent selection.

### Sprite catalogue metadata

Recommended filters:

- species/race tags;
- body type;
- presentation/gender tag where useful;
- class/archetype;
- profession;
- armor/clothing theme;
- weapon silhouette;
- visual style;
- source/creator;
- compatible formats.

Do not require exact portrait identity to reuse a sprite.

---

## 20. Fog of war and hidden information

This is a later milestone.

Target capabilities:

- GM always sees full board;
- players see revealed/discovered areas;
- hidden monsters remain invisible until revealed;
- secret doors/traps can exist without leaking through client queries;
- line of sight can affect visibility later;
- revealed terrain can remain remembered if desired.

Security requirement: hidden information must not merely be hidden with CSS while still freely readable from the browser query.

---

## 21. Challenges and non-combat encounters

The same tactical system should eventually support more than combat.

Examples:

- escape sequence;
- collapsing dungeon;
- environmental puzzle;
- protect an NPC;
- reach an objective before a round limit;
- ritual interruption;
- traps/hazards;
- stealth/infiltration board;
- timed reinforcement encounter.

The encounter session therefore should not assume "every participant is an enemy" or "victory means all enemies are dead."

---

## 22. Encounter resolution and campaign handoff

When an encounter resolves, support explicit reconciliation:

- current HP;
- consumed spell slots;
- consumed items/ammunition where tracked;
- class/feature resources;
- conditions that persist;
- loot/rewards;
- XP if used;
- quest/objective results;
- location/campaign state changes explicitly chosen by GM.

Do not automatically alter world routes or character travel position because a tactical encounter ended.

---

# 23. Phased implementation roadmap

The phase order is deliberate. Later automation must not outrun the authority and board foundations.

## Phase 0 — Roadmap, contracts, and visual-selection cleanup

Status: **IN PROGRESS / FOUNDATION EXISTS**

Goals:

- establish this roadmap;
- preserve existing world-map behavior;
- formalize portrait/sprite independence;
- verify current visual registry and creator flows;
- prepare compatibility contracts for both 4-dir and 8-dir assets.

Tasks:

- [x] Add rich visual-asset metadata foundation.
- [x] Preserve legacy 4-dir map sprite support.
- [x] Add 8-dir master + legacy companion concept.
- [x] Make portrait selection part of NPC Forge.
- [x] Create this tactical encounter roadmap.
- [ ] Change portrait->sprite from required pairing semantics to suggested-match semantics.
- [ ] Add independent Sprite Picker UI.
- [ ] Add suggested sprite badge/ranking.
- [ ] Add animated sprite preview.
- [ ] Produce and review the first curated 8-direction sprite batch.
- [ ] Define exact sprite sheet packing/anchor standard from accepted examples.

Exit criteria:

- portrait and sprite can be selected independently;
- old map assets still render unchanged;
- rich assets have documented metadata and compatibility behavior;
- first approved sprite style becomes the production visual reference.

---

## Phase 1 — Encounter map shell and hex renderer

Status: **NOT STARTED**

Goals:

- render a separate tactical board without combat rules;
- calibrate an image to a hex grid;
- pan/zoom reliably;
- translate between screen coordinates and axial hex coordinates.

Tasks:

- [ ] Add `encounter_maps` migration.
- [ ] Add encounter map asset storage convention.
- [ ] Create `/encounters` route.
- [ ] Create `/encounters/[id]` route.
- [ ] Build `EncounterBoard` component.
- [ ] Implement axial coordinate library.
- [ ] Implement pixel <-> axial conversion.
- [ ] Render pointy/flat hex overlays from metadata.
- [ ] Implement pan/zoom.
- [ ] Add GM hex-grid calibration editor.
- [ ] Validate responsive rendering.

Exit criteria:

- GM can create a map, calibrate the grid, save it, reopen it, and click a hex to get stable `(q,r)` coordinates;
- world map code remains untouched behaviorally.

---

## Phase 2 — Map objects and GM encounter staging

Status: **NOT STARTED**

Goals:

- make boards mechanically meaningful;
- place tokens and blockers manually.

Tasks:

- [ ] Add `encounter_map_objects`.
- [ ] Add sparse `encounter_hex_overrides`.
- [ ] Add `encounters`.
- [ ] Add `encounter_participants` minimal form.
- [ ] GM map object palette.
- [ ] walls and blocked hexes.
- [ ] doors.
- [ ] difficult terrain.
- [ ] spawn positions.
- [ ] objectives/interactables.
- [ ] place existing PCs/NPCs.
- [ ] select participant sprite independently.
- [ ] GM drag/reposition in draft mode.

Exit criteria:

- GM can stage a complete static encounter board with characters, monsters/NPC placeholders, walls, doors, terrain, and objectives.

---

## Phase 3 — Authoritative hex movement

Status: **NOT STARTED**

Goals:

- move tokens legally using 5e speed;
- establish the authoritative command pattern.

Tasks:

- [ ] Add movement RPC.
- [ ] Add encounter request IDs/idempotency.
- [ ] Implement weighted hex pathfinding.
- [ ] Calculate speed in 5 ft. increments.
- [ ] Block walls/occupied cells.
- [ ] Apply difficult terrain.
- [ ] Reachable-area preview.
- [ ] path preview.
- [ ] movement remaining UI.
- [ ] GM movement override.
- [ ] audit movement actions.
- [ ] Realtime token position subscriptions.
- [ ] reconnect state reconstruction test.

Exit criteria:

- a permitted controller can move only a legal distance/path;
- another client sees the movement;
- forged browser updates cannot bypass the RPC rules.

---

## Phase 4 — Initiative and multiplayer turn engine

Status: **NOT STARTED**

Goals:

- multiple logged-in players take turns safely.

Tasks:

- [ ] initiative rolls.
- [ ] deterministic tie handling.
- [ ] initiative rail UI.
- [ ] active participant state.
- [ ] round counter.
- [ ] player-control authorization.
- [ ] End Turn RPC.
- [ ] start/end-turn effect hooks.
- [ ] movement reset.
- [ ] action/bonus action/reaction state.
- [ ] disconnect/reconnect handling.
- [ ] GM pause/resume.
- [ ] GM next/previous/override turn.
- [ ] Realtime turn sync.

Exit criteria:

- two or more player clients and one GM client can complete multiple rounds without state divergence;
- only the active authorized participant can use ordinary turn commands.

**This is the first tactical multiplayer MVP milestone.**

---

## Phase 5 — HP, attacks, and basic combat

Status: **NOT STARTED**

Goals:

- make the board playable as a basic D&D battle.

Tasks:

- [ ] combat HP contract.
- [ ] AC display.
- [ ] attack selection from canonical sheet/equipment.
- [ ] target range highlighting.
- [ ] attack roll.
- [ ] critical handling.
- [ ] damage roll.
- [ ] healing.
- [ ] temp HP.
- [ ] defeat/unconscious state.
- [ ] action consumption.
- [ ] combat log.
- [ ] GM manual damage/heal controls.

Exit criteria:

- a normal weapon fight can be completed without manual external bookkeeping, while GM overrides remain available.

---

## Phase 6 — Saves, conditions, reactions, and movement interactions

Status: **NOT STARTED**

Goals:

- cover common 5e battlefield rules.

Tasks:

- [ ] saving throw resolver.
- [ ] common conditions.
- [ ] prone movement/action interactions.
- [ ] grapple/restrained basics.
- [ ] Dash.
- [ ] Disengage.
- [ ] opportunity attack prompt.
- [ ] reaction availability.
- [ ] forced movement.
- [ ] persistent effect durations.
- [ ] concentration foundation.

Exit criteria:

- common melee combat rules operate without forcing the GM to manually track every status.

---

## Phase 7 — Tactical spellcasting

Status: **NOT STARTED**

Goals:

- connect the existing spellbook to tactical play.

Tasks:

- [ ] structured tactical spell adapter.
- [ ] single-target spells.
- [ ] spell attacks.
- [ ] saving-throw spells.
- [ ] healing spells.
- [ ] spell slot consumption.
- [ ] upcasting framework.
- [ ] self/creature/point targeting.
- [ ] radius targeting.
- [ ] line targeting.
- [ ] cone targeting.
- [ ] concentration effects.
- [ ] persistent areas.
- [ ] manual fallback for unsupported spells.

Exit criteria:

- a practical subset of commonly used combat spells can be selected from the character's real spellbook and resolved on the board.

---

## Phase 8 — Class/species/feat/item tactical abilities

Status: **NOT STARTED**

Goals:

- progressively automate character identity mechanics.

Tasks:

- [ ] tactical ability registry/adapter format.
- [ ] high-use class features.
- [ ] high-use species features.
- [ ] common feats.
- [ ] consumable items.
- [ ] equipment activations.
- [ ] resource counters.
- [ ] short/long-rest resource reconciliation where appropriate.
- [ ] Assisted/manual fallback UI.

Exit criteria:

- unsupported features remain usable through a clean GM-assisted flow instead of blocking the encounter.

---

## Phase 9 — Advanced terrain, size, LOS, fog, and hidden information

Status: **NOT STARTED**

Goals:

- add tactical depth and GM secrecy.

Tasks:

- [ ] creature sizes / multi-hex footprints.
- [ ] cover.
- [ ] line of sight.
- [ ] fog of war.
- [ ] hidden monsters.
- [ ] secret traps/doors.
- [ ] elevation model.
- [ ] climb/swim/fly/burrow adapters.
- [ ] teleportation targeting.
- [ ] hazardous terrain triggers.
- [ ] player-safe server filtering of hidden data.

Exit criteria:

- hidden information is secure, not CSS-only;
- tactical geometry supports common complex encounters.

---

## Phase 10 — Encounter objectives, rewards, and campaign consequences

Status: **NOT STARTED**

Goals:

- make encounters part of the campaign instead of isolated battles.

Tasks:

- [ ] objective framework.
- [ ] round/time limits.
- [ ] protect/escort targets.
- [ ] interactable objectives.
- [ ] reinforcement triggers.
- [ ] win/fail conditions.
- [ ] loot/rewards.
- [ ] XP/progression handoff where campaign uses it.
- [ ] persistent resource reconciliation.
- [ ] explicit campaign/location consequence controls.
- [ ] encounter history summary.

Exit criteria:

- a GM can stage, run, and resolve a story encounter with persistent results.

---

## Phase 11 — Polish, accessibility, performance, and content tooling

Status: **NOT STARTED**

Goals:

- make the system pleasant enough for regular campaign use.

Tasks:

- [ ] animation polish.
- [ ] sound hooks/settings if desired.
- [ ] keyboard navigation.
- [ ] accessible targeting state.
- [ ] colorblind-safe overlays.
- [ ] mobile/tablet pass.
- [ ] network latency indicators.
- [ ] optimistic preview with authoritative correction.
- [ ] encounter template duplication.
- [ ] reusable monster presets.
- [ ] reusable map/object palettes.
- [ ] performance tests with larger encounters.
- [ ] archived encounter replay/log summary.

Exit criteria:

- system is reliable for routine sessions rather than only demonstrations.

---

# 24. MVP definitions

## Visual/creator MVP

- independent portrait selection;
- independent sprite selection;
- suggested match available;
- accepted 8-dir sprite specification;
- legacy compatibility retained.

## Tactical board MVP

- separate encounter route;
- map image + calibrated hexes;
- tokens;
- blockers/difficult terrain;
- GM staging.

## Multiplayer movement MVP

- encounter sessions;
- initiative;
- player ownership;
- turn control;
- 5 ft./hex movement;
- movement budget;
- authoritative movement;
- Realtime synchronization.

## Basic combat MVP

- HP/AC;
- basic attacks;
- damage/healing;
- actions;
- End Turn;
- combat log;
- GM override.

The project should demonstrate and validate each MVP before expanding the next rules layer.

---

# 25. Testing strategy

Every phase should have both automated contracts and live multiplayer smoke tests.

### Database tests

- RLS/grant verification;
- non-admin rejection;
- wrong-player rejection;
- out-of-turn rejection;
- idempotent request replay;
- invalid path rejection;
- resource overspend rejection;
- state/version conflict behavior.

### Renderer tests

- stable axial/pixel conversion;
- zoom independence;
- board calibration persistence;
- correct token anchor/facing;
- old sprites unchanged;
- rich sprite metadata interpreted correctly.

### Multiplayer tests

At minimum:

- GM browser;
- Player A browser/session;
- Player B browser/session.

Verify:

- ownership;
- turn sync;
- movement sync;
- reconnect;
- stale client rejection;
- GM override propagation.

### Combat tests

Use deterministic seeded/test rolls where possible for validators.

Test:

- hit/miss;
- crit;
- damage/healing;
- resource consumption;
- saving throws;
- conditions;
- spell slots;
- concentration when implemented.

---

# 26. Migration and deployment rules

For encounter work, retain the project's current safe-change discipline.

1. Inspect all callers before changing shared character/map contracts.
2. Prefer additive schema migrations.
3. Dry-run migrations in a transaction when practical.
4. Include postconditions.
5. Preserve legacy sprite and world movement contracts unless the phase explicitly replaces a tactical-only component.
6. Build feature branches from current `main`.
7. Run focused validators.
8. Run the full production build before merge.
9. Fast-forward `main`; avoid force pushes.
10. Record the migration/commit in this roadmap's Progress Ledger.

---

# 27. Risk register

### Risk: tactical changes break world movement

Mitigation: separate encounter coordinates/tables/routes; do not reuse world route functions.

### Risk: client cheating / accidental invalid state

Mitigation: server-authoritative RPC commands; RLS; ownership checks; idempotency; append-only action log.

### Risk: trying to automate all 5e rules at once

Mitigation: A/B/C automation tiers; GM-assisted fallback; prioritize common rules.

### Risk: realtime desynchronization

Mitigation: database state is authoritative; realtime is notification only; reconnect reconstructs full state.

### Risk: sprite format fragmentation

Mitigation: metadata-defined renderer; accepted rich format; legacy companion support; visual asset validators.

### Risk: portrait/sprite coupling becomes restrictive

Mitigation: independent choice UI and many-to-many recommendation relationship.

### Risk: hidden information leaks

Mitigation: server/RLS-level filtering, not CSS-only hiding.

### Risk: map editor becomes too complex before gameplay works

Mitigation: build minimal walls/terrain/spawns first; defer advanced effects/elevation/LOS.

---

# 28. Decision log

Update this section when a major architectural choice changes.

### 2026-07-26 — Two map engines

Decision: Tactical encounters remain separate from world/town movement logic.

Reason: world travel simulation and turn-based 5 ft. hex movement have different state models and failure modes.

### 2026-07-26 — Hex scale

Decision: 1 hex = 5 feet.

### 2026-07-26 — D&D 5e rules

Decision: Gloomhaven-like tactical/readability inspiration, but D&D 5e action/movement/combat rules.

### 2026-07-26 — Player control

Decision: authenticated players should take their own turns and move/use abilities for controlled characters; GM controls enemies and overrides.

### 2026-07-26 — Visual assets

Decision: target 8-direction idle + 3-frame walking master sprites; maintain 4-direction compatibility for existing map rendering.

### 2026-07-26 — Portrait/sprite relationship

Decision: portrait and sprite become independent selections. Pairing is a recommendation, not a requirement.

---

# 29. Open design decisions

These are intentionally unresolved until the related phase begins.

- [ ] Pointy-top or flat-top hexes as the primary default?
- [ ] Should map art be authored with visible hexes, hidden hexes, or support both?
- [ ] Should diagonal-looking 8-dir sprite facing follow movement vector or nearest target when idle?
- [ ] Should player HP be live canonical on every damage operation or reconciled at encounter resolution? Current recommendation: live canonical.
- [ ] Monster data source/schema for tactical instances.
- [ ] Initiative ties: automatic Dex/tiebreak ordering vs player/GM choice.
- [ ] Exact opportunity-attack interaction UX.
- [ ] How much LOS automation belongs in the first advanced terrain pass?
- [ ] Whether encounter maps can host non-combat free movement outside initiative.
- [ ] Whether initiative UI lives entirely on encounter page or also appears in profile panel globally.
- [ ] Exact ownership model for companions/summons.

Do not silently decide these inside unrelated patches. Update the Decision Log when resolved.

---

# 30. Progress ledger

Add an entry whenever a meaningful roadmap milestone lands.

| Date | Phase | Change | Commit / Migration | Validation | Notes |
|---|---|---|---|---|---|
| 2026-07-25 | Phase 0 | Added portrait/visual-asset foundation and legacy compatibility protections | `sql/20260725_02_portrait_sprite_asset_foundation.sql`, `sql/20260725_03_guard_unrendered_visual_assets.sql`, `sql/20260725_04_visual_asset_legacy_companion.sql` | production build + DB postconditions | Existing world renderer intentionally unchanged. |
| 2026-07-26 | Phase 0 | Established tactical encounter roadmap and living blueprint | this document | docs review | Defines end-state and guarded implementation order. |

---

# 31. Next recommended work

Unless a higher-priority creator bug appears, the recommended next sequence is:

1. **Finish visual selection semantics**
   - decouple portrait and sprite selection;
   - make portrait-linked sprite a suggestion;
   - add independent sprite browser and preview.

2. **Approve the sprite production standard**
   - review several generated sprite examples;
   - choose the accepted style/proportions/packing;
   - define cell anchor and transparent-padding rules;
   - create legacy derivative guidance.

3. **Begin Phase 1 encounter shell**
   - database map record;
   - `/encounters` route;
   - hex renderer;
   - grid calibration.

Do not begin attack/spell automation before authoritative movement and multiplayer turn ownership are stable.

---

# 32. End-goal checklist

The system is considered broadly complete when all of the following are true:

- [ ] Existing world/town travel still works independently.
- [ ] GM can create reusable tactical maps.
- [ ] GM can stage an encounter with PCs, NPCs, monsters, terrain, hazards, and objectives.
- [ ] Players can join from their accounts.
- [ ] Each player controls only permitted characters.
- [ ] Initiative and rounds are authoritative and synchronized.
- [ ] 1 hex equals 5 ft. and movement respects canonical speed.
- [ ] Difficult terrain/blockers/occupancy work.
- [ ] Basic attacks and HP resolution work.
- [ ] Actions, bonus actions, reactions, and movement are tracked.
- [ ] Common saving throws and conditions work.
- [ ] Character spellbooks power tactical spell selection.
- [ ] Important spells support board targeting and AoEs.
- [ ] Common class/species/feat/item abilities have automated or assisted flows.
- [ ] GM can always adjudicate unsupported edge cases.
- [ ] Fog/hidden information is server-safe.
- [ ] Portraits and sprites are independently selectable with suggested matches.
- [ ] 8-direction idle/walking tactical sprites are supported.
- [ ] Existing 4-direction world sprites remain usable.
- [ ] Encounter results persist correctly back to campaign state.
- [ ] Combat log explains important state changes.
- [ ] Realtime reconnection does not lose authoritative state.
- [ ] Desktop and player-facing interaction are usable during an actual campaign session.

This checklist is the destination. Individual phases may change as implementation teaches us more, but changes to the destination should be explicit and recorded in the Decision Log.