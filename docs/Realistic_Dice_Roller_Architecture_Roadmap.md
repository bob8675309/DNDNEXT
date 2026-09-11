# Realistic Dice Roller — Architecture, Integration, and Future Roadmap

Updated: 2026-08-30

Status: **planned reusable subsystem; architecture agreed; implementation intentionally not started in this documentation pass.**

This document is the controlling handoff for the planned DNDNext **Realistic Dice Roller**. It exists so a future model can continue the work without reconstructing the design discussion from chat history.

## Executive summary

The current Character Forge Abilities tab has a presentation-only dice-tray prototype. It uses the existing Forge roll objects as the math/RNG authority, then presents the generated totals as draggable result dice with CSS-based tray motion. That prototype was useful for establishing the desired visual direction, but it should **not** become the long-term site-wide dice engine.

The future system must be a reusable dice visualization/physics subsystem that can serve:

- Character Forge ability generation;
- Character Sheet ability checks;
- Character Sheet skill checks;
- Character Sheet saving throws;
- initiative and other d20 checks;
- weapon/spell damage dice;
- future tactical/grid combat roll presentation;
- other future roll surfaces without each feature inventing a new animation system.

The target physical die set is:

- d6;
- d8;
- d10;
- d12;
- d20;
- plus a Forge-specific `resultCube` presentation type for aggregate generated ability totals such as 4d6-drop-lowest results that can legitimately be 3–18.

The most important architecture rule is:

> **Game rules decide the result. Dice physics visualizes that result. Physics never becomes the D&D rules authority.**

This separation is mandatory for deterministic rules, multiplayer encounters, server-authoritative tactical combat, replays, and future reuse.

---

## Current state that the next model must preserve

### Character Forge prototype

The active Character Forge branch currently contains a browser-level Abilities dice-tray prototype. Relevant files include:

- `components/NpcForgeAbilityStep.js`;
- `styles/character-forge-ability-dice-tray.css`;
- `styles/character-forge-ability-dice-bounce.css`;
- imports for those styles in `pages/_app.js`.

The current prototype deliberately keeps the existing Forge roll objects as the mechanical authority. The CSS motion is presentation only. It also keeps the useful player-facing behaviors that the future engine should retain:

- no totals revealed before the player rolls;
- six generated totals for rolled methods;
- hover detail showing the underlying dice math;
- 4d6-drop-lowest detail identifies the dropped die;
- draggable final totals that can be assigned to ability slots;
- an obvious `Roll Again` path;
- reduced-motion handling.

Do **not** regress those behaviors while replacing the visual engine.

### Character Sheet roll path already exists

The sheet already has a reusable roll callback chain:

`CharacterSheet5e` → `onRoll(...)` → `CharacterSheetPanel` → parent `NpcPanel` / player profile shell → `CharacterSheetRollResult`.

`CharacterSheet5e` currently performs local d20 rolls for skill/save/initiative-style checks and emits structured roll data including the chosen roll, optional pair for advantage/disadvantage, modifier, mode, and total.

This is a strong future integration seam. The Realistic Dice subsystem should consume or adapt the structured result; it should not force a rewrite of all Character Sheet formulas just to show 3D dice.

### Tactical encounter authority already exists

Tactical combat is already a separate server-authoritative rules system. Important current surfaces include:

- `pages/encounters/combat.js`;
- `components/encounter/EncounterTurnBoard.js`;
- `components/TacticalAttackResultPanel.js`;
- `utils/encounterHex.js`;
- Supabase encounter RPCs and combat-log tables.

The encounter board uses discrete axial hex coordinates (`q`, `r`), movement paths, terrain, blocking objects, ranges, line of sight, areas, turns, and server-side action resolution.

Live encounter authority includes RPCs such as:

- `encounter_weapon_attack_v1`;
- `encounter_unarmed_strike_v1`;
- `encounter_roll_save_v1`;
- the current encounter spell-casting RPC family;
- `encounter_move_active_participant_v1`;
- `encounter_use_core_action_v1`.

`encounter_combat_log.detail` already carries roll-related fields for current attacks/spells/saves, including examples such as `roll`, `secondRoll`, `attackRoll`, `damageRoll`, `saveRoll`, `healingRoll`, `critical`, `total`, and `requestId` depending on event type.

The future tactical dice adapter should animate those **already resolved** results.

### World-map boundary remains protected

The world map is a separate browser-only system loaded through `pages/map.js` → `components/MapPageClient.js`.

Do not embed dice rules or physics inside `MapPageClient.js`. If a future combat/map surface wants dice, use an encounter/local overlay or, after multiple consumers exist, a global dice overlay host. The world map itself should not learn tactical or dice physics rules.

---

## Locked architecture decisions

### 1. Outcome authority and visual physics are separate

Every consumer produces or receives a mechanical roll result first. The Realistic Dice system gets that result and animates it.

Examples:

- Forge: existing generated ability roll object is authority;
- Character Sheet: existing sheet roll calculation is authority unless a later project moves it server-side;
- Tactical combat: Supabase encounter RPC/combat log is authority;
- future multiplayer rolls: server-authoritative result is authority.

The dice engine must never alter:

- attack hit/miss;
- save success/failure;
- damage/healing amount;
- initiative ordering;
- generated ability score;
- advantage/disadvantage choice;
- spell targeting;
- tactical movement legality.

### 2. Do not reuse dice rigid-body collision rules for tactical grid movement

This is an explicit decision.

Dice physics deals with continuous three-dimensional bodies:

- position/rotation;
- linear and angular velocity;
- mass;
- friction;
- restitution;
- collisions/contact manifolds;
- gravity;
- sleep/settling.

Tactical combat deals with discrete tabletop rules:

- axial hex coordinates;
- occupied cells;
- movement costs;
- movement budget;
- difficult/blocked terrain;
- reach;
- line of sight;
- cover;
- targeting shapes;
- turn/action state.

These are different domains and should keep different authorities.

Future token/minature animation may visually interpolate between server-approved hexes, but physics must not decide whether a character may occupy a hex.

### 3. Build a complete polyhedral core from the start

Even though the first consumer is the Forge Abilities tab, the engine should support the full requested set from its initial core design:

- d6 — cube;
- d8 — octahedron;
- d10 — proper pentagonal trapezohedron-style die mesh;
- d12 — dodecahedron;
- d20 — icosahedron;
- `resultCube` — visual aggregate-value cube for Forge totals.

Do not build an engine whose geometry/result mapping assumes every die is a cube.

### 4. Preferred rendering/physics stack

Current DNDNext runtime is Next.js Pages Router + React 19.

Preferred implementation direction:

- `three` for rendering primitives/geometry/materials;
- `@react-three/fiber` for React integration;
- `@dimforge/rapier3d-compat` directly for rigid-body physics.

The initial recommendation is **not** to make `@react-three/rapier` the core abstraction. Direct Rapier keeps the physics engine usable outside a particular React wrapper and makes the result/physics boundary explicit.

Before adding dependencies, the implementing model must re-check current package versions and React compatibility because library versions can change.

### 5. No database migration for the initial dice core

Phase 1 is client-side presentation infrastructure and a Forge adapter. It should not require:

- a new Supabase table;
- schema changes;
- new encounter RPCs;
- world-map changes;
- tactical movement changes.

Persisted dice preferences, roll-history enhancements, or multiplayer replay records are later projects only if a real requirement appears.

### 6. Do not put a global DiceOverlayHost in the first Forge-only implementation

Prove the engine as a local reusable component first.

Only after at least two real consumers exist should the team consider mounting a global host in `pages/_app.js`, analogous to other global bridges/panels.

This avoids prematurely coupling every page to WebGL/physics initialization.

---

## Proposed mechanical contract

The rendering system should consume a normalized roll-resolution object rather than consumer-specific state.

Illustrative contract:

```js
const rollResolution = {
  id: "unique-roll-id",
  label: "Longsword Attack",
  authority: "encounter-server",

  dice: [
    {
      id: "attack-d20",
      type: "d20",
      result: 17,
    },
  ],

  modifier: 6,
  total: 23,

  // presentation/replay input only
  visualSeed: "request-or-generated-seed",

  // optional consumer-specific explanatory metadata
  detail: {},
};
```

### Forge aggregate example

```js
{
  id: "ability-roll-1",
  label: "Ability Score 1",
  authority: "forge-generator",
  dice: [
    {
      id: "ability-result-1",
      type: "resultCube",
      result: 16,
      detail: {
        formula: "4d6 drop lowest",
        rolls: [6, 6, 5, 1],
        droppedIndex: 3,
        dropped: 1,
      },
    },
  ],
  total: 16,
  visualSeed: "fresh-visual-seed",
}
```

A `resultCube` is intentionally not a literal d6. It may display values larger than 6 because it represents the final generated total.

### Advantage/disadvantage example

```js
{
  id: "save-1",
  label: "Dexterity Save",
  authority: "character-sheet",
  dice: [
    { id: "save-a", type: "d20", result: 7 },
    { id: "save-b", type: "d20", result: 15 },
  ],
  mode: "advantage",
  chosenDieId: "save-b",
  modifier: 4,
  total: 19,
  visualSeed: "...",
}
```

The renderer can visually distinguish the chosen/dropped d20 after settling without deciding which die wins.

---

## Proposed component/module layout

The exact filenames may evolve, but responsibilities should stay separated approximately like this:

```text
components/
  dice/
    RealisticDiceTray.js
    RealisticDiceCanvas.js
    RealisticDie.js
    DiceResultTooltip.js
    DiceFallback.js

    geometry/
      d6.js
      d8.js
      d10.js
      d12.js
      d20.js
      resultCube.js

    physics/
      createDiceWorld.js
      createTray.js
      createDieBody.js
      spawnDice.js
      settleDice.js
      orientDieToResult.js
      dicePhysicsPresets.js

    adapters/
      ForgeAbilityDiceTray.js
      // Later:
      // CharacterSheetDiceOverlay.js
      // TacticalDiceOverlay.js

utils/
  dice/
    diceTypes.js
    diceRollContract.js
    diceVisualSeed.js
    diceNotation.js
```

### Responsibility rules

`RealisticDiceTray`
- consumer-facing orchestration component;
- receives normalized result data;
- owns replay/rethrow presentation state;
- does not calculate D&D outcomes.

`RealisticDiceCanvas`
- WebGL/scene host;
- camera/lights/tray visual environment;
- should be dynamically loaded browser-side where needed.

`RealisticDie`
- visible die mesh/material/face labels;
- paired with physics body but not rules authority.

`geometry/*`
- canonical mesh geometry;
- face/result mapping tables;
- collider vertices/indices as appropriate.

`physics/*`
- Rapier world and rigid-body lifecycle;
- spawn impulse/torque;
- tray walls/bumper colliders;
- settle detection;
- final orientation guidance.

`adapters/*`
- translates an existing subsystem's result into the normalized dice contract;
- keeps consumer-specific wiring out of the core.

---

## Physics behavior

Each visual roll should feel different even when the mechanical result is the same.

A visual seed should generate bounded presentation parameters such as:

- spawn side/zone;
- spawn height;
- initial XYZ position;
- linear velocity;
- angular velocity;
- initial orientation;
- small restitution/friction variation within safe presets;
- optional bumper/tray perturbation preset;
- timing offsets when multiple dice are thrown.

The physics engine then handles actual die-to-die and die-to-tray collisions.

### Tray physics

The tray should have fixed colliders for:

- floor;
- four walls or an equivalent bounded shape;
- optional subtle internal bumper geometry only if visually useful.

The dice are dynamic rigid bodies with convex colliders matching their visible polyhedra as closely as practical.

Enable continuous collision detection only where useful for initial fast throws; do not pay the cost globally if normal discrete collision detection is sufficient after the first high-energy phase.

### Settling

A die is visually settled only after both linear and angular velocity remain below tuned thresholds for a short stability window.

Avoid declaring a result while the die is still visibly rocking.

The system should have a maximum roll timeout/failsafe so a pathological collision never leaves the UI permanently busy.

---

## Predetermined authoritative result orientation

A server/sheet/Forge result must be what the player sees on top when the die stops.

Do not make the visible face random and then separately print a contradictory number elsewhere.

Recommended approach:

1. Let the die undergo genuine rigid-body physics through its high- and medium-energy motion.
2. When the die enters a low-energy settling phase, determine the nearest valid orientation whose top face corresponds to the authoritative result.
3. Apply a small, visually subtle rotational guidance/torque during the final wobble.
4. Allow it to settle at a naturally reached position while converging to the correct face.
5. If the solver cannot safely converge before timeout, use a short final orientation correction/fallback rather than display the wrong mechanical result.

The correction must affect **presentation only**.

### Face mapping is per die type

Each polyhedral die needs a tested mapping from numbered face to a canonical orientation/quaternion. This is not interchangeable between d6/d8/d10/d12/d20.

Automated tests should verify that asking each die type for every legal result produces the expected face-up orientation within tolerance.

---

## Visual seed and deterministic replay

The mechanical outcome and the visual seed are different concepts.

- Mechanical RNG determines the D&D result.
- Visual RNG determines how that already-known result tumbles.

For ordinary local rolls, generate a fresh visual seed each time the animation is started.

For future tactical multiplayer/replay, an existing server `requestId` is a good candidate for the visual seed because it identifies one authoritative command/result without creating another rules authority.

Before promising frame-perfect cross-device replay, test the actual browser/WASM/physics behavior. The architecture should make reproducible initial conditions possible, but the project should not depend on exact cross-device frame identity unless verified.

---

## Character Forge integration plan

The first consumer should remain the Character Forge Abilities tab.

### Preserve the current Forge authority

Do not rewrite ability generation just to support 3D dice.

The existing roll object remains authoritative for:

- 3d6 totals;
- 4d6-drop-lowest totals;
- individual underlying dice values;
- dropped die index;
- final total;
- allocation ID/state.

### Replace only presentation

`ForgeAbilityDiceTray` should adapt each generated total into one `resultCube` roll-resolution entry.

Preserve:

- six results;
- hover math;
- dropped-die explanation;
- drag/select-to-assign behavior;
- reroll behavior;
- clear busy state during animation;
- keyboard/accessibility path;
- reduced motion.

### ResultCube behavior

The visible cube may have a large central result label or a generated texture/face presentation because it is not a literal six-valued die.

The underlying true dice remain visible in the tooltip/detail, not encoded as fake cube faces.

---

## Character Sheet integration plan

This is a later phase after the core + Forge adapter is accepted.

Use the existing `onRoll` result seam rather than rewriting the entire sheet.

Initial coverage should include:

- ability checks;
- skill checks;
- saving throws;
- initiative;
- advantage/disadvantage pairs.

Then extend to damage/healing expressions where the current action result exposes die notation/results.

The sheet can continue to show textual math/result information alongside or after the animation. The 3D dice should improve presentation, not make the calculation opaque.

If the project later moves player sheet RNG server-side, the adapter contract should remain stable: only the `authority`/result source changes.

---

## Tactical encounter integration plan

This is a later phase when tactical combat work resumes.

### Server remains authoritative

The tactical adapter must consume encounter RPC/combat-log results. It must not independently reroll an attack or save on the client.

Potential presentation flows:

- weapon attack → d20, then damage dice if hit;
- advantage/disadvantage → two d20s, visually mark chosen die;
- saving throw spell → target d20, then damage dice as resolved;
- healing → healing dice;
- critical hit → animate the authoritative critical damage dice/result presentation;
- multiplayer → all clients may visualize from the same normalized combat-log event.

### Do not alter encounter movement/collision rules

`EncounterTurnBoard`, `encounterHex`, pathing, LOS, cover, occupancy, movement cost, reaction windows, and server action state remain separate from Rapier.

If miniature/token motion is later animated, interpolate along the **server-approved path**. Do not replace the path validator with free-body physics.

---

## World map / town map integration boundary

The Realistic Dice subsystem is allowed to be reusable by a combat overlay that happens to be visible while another map surface exists, but it should not blur established DNDNext boundaries.

- World map remains world travel/location/weather/clock authority.
- Town/city map remains local town/city interaction authority.
- Tactical encounter grid remains encounter movement/combat authority.
- Dice physics remains presentation authority only.

Do not move combat physics into the world map and do not make the town map consume world-map movement rules while implementing dice.

---

## Performance and loading requirements

A physics/WebGL subsystem is materially heavier than the current CSS prototype. Treat loading and lifecycle carefully.

Requirements:

- dynamically import browser-only Three/Rapier surfaces;
- do not initialize the physics world on pages that never show dice;
- dispose meshes/materials/listeners/world state when a local tray unmounts;
- avoid one animation loop per die; use one scene/world step;
- support device-pixel-ratio limits if necessary;
- cap simultaneous dice count or degrade gracefully for very large damage pools;
- prefer pooling/reuse after correctness is proven;
- preserve normal site interaction if WebGL/WASM fails.

### Fallback

`DiceFallback` should render a lightweight accessible 2D/text result if:

- WebGL is unavailable;
- Rapier fails to load;
- reduced motion requests a simpler mode;
- the device is too constrained;
- a runtime error occurs.

The fallback result must still be mechanically correct and usable.

---

## Accessibility requirements

The 3D animation cannot be the only source of information.

Every roll should expose:

- semantic label;
- die result(s);
- modifier;
- total;
- advantage/disadvantage mode when applicable;
- dropped/chosen die information where relevant;
- Forge underlying generation math;
- keyboard-operable roll/replay/assignment controls;
- reduced-motion alternative.

Do not require hovering a moving 3D object to know the result.

---

## Validation/test plan

Create dedicated focused validation rather than weakening existing Forge/tactical validators.

Suggested tests/checks:

### Pure unit/semantic tests

- legal die types: d6/d8/d10/d12/d20/resultCube;
- result bounds per true die type;
- `resultCube` accepts Forge aggregate range without pretending to be d6;
- normalized roll contract validation;
- visual seed repeatability for generated initial conditions;
- face-to-quaternion mapping for every face of every true die;
- advantage/disadvantage chosen-die metadata remains mechanical input, not recomputed.

### Physics integration checks

- bodies stay inside tray bounds under supported spawn presets;
- dice collide with one another;
- every die eventually settles or hits a controlled timeout;
- requested authoritative result ends face-up;
- no NaN transforms/velocities;
- reroll fully resets body state;
- unmount disposes world/resources cleanly.

### Forge regression

- current ability-method switching still works;
- rolling still generates exactly six authoritative totals;
- reroll uses the existing Forge authority;
- drag/select allocation still works after animation;
- tooltip math still matches the underlying roll object;
- Point Buy/Standard Array/Manual modes are unaffected;
- NPC Forge is not accidentally forced through a player-only 3D path unless deliberately supported.

### Protected-boundary checks

The initial dice-core/Forge PR should reject changes to:

- `components/MapPageClient.js`;
- world route/travel/weather/camp/clock runtime;
- town/city map runtime;
- encounter movement/path/LOS RPCs;
- crafting/inventory/merchant runtime;
- Supabase migrations.

### Browser acceptance

Test at minimum:

- repeated six-result Forge rolls do not follow an obvious repeated path;
- dice-to-dice collisions are visible;
- wall/floor collisions look believable;
- no clipping through tray walls;
- each die has a distinct physical trajectory;
- results remain readable after settling;
- drag assignment is reliable after settling;
- reduced-motion mode is usable;
- desktop + smaller viewport behavior remains reachable;
- performance remains acceptable on a typical non-gaming laptop.

---

## Recommended implementation phases

### Phase 0 — checkpoint and branch discipline

Before implementation:

1. inspect current `main`;
2. inspect current open PR #176 exact head and acceptance state;
3. inspect relevant docs, especially this one and `DNDNext_Current_Handoff_Prompt.md`;
4. confirm current package versions;
5. confirm no newer Realistic Dice implementation already landed;
6. inspect the current Abilities prototype before replacing anything.

**Do not turn PR #176 into the permanent physics-engine PR.**

PR #176 is already a large Character Forge browser-review branch. The reusable physics engine should be built on a new bounded branch/PR from the accepted Forge checkpoint once Paul approves the current Forge state.

Documentation about the future subsystem may live on #176; the actual reusable physics infrastructure should get its own review boundary.

### Phase 1 — Realistic Dice Core + Forge adapter

Scope:

- add checked compatible Three/R3F/Rapier dependencies;
- implement normalized roll contract;
- implement all five requested true die geometries + `resultCube`;
- implement tray/world/spawn/collision/settle/orientation logic;
- implement fallback/reduced-motion behavior;
- implement `ForgeAbilityDiceTray`;
- replace current CSS trajectory system only after parity tests pass;
- keep current Forge RNG/math/allocation authority unchanged.

Out of scope:

- Character Sheet integration;
- tactical integration;
- map changes;
- Supabase changes;
- multiplayer synchronization;
- dice skins marketplace/customization.

### Phase 2 — Character Sheet adapter

Scope:

- adapt existing structured `onRoll` results;
- ability/skill/save/initiative d20 presentation;
- advantage/disadvantage pairs;
- preserve existing formulas and text breakdown;
- optionally add standard damage/healing dice after the d20 path is stable.

### Phase 3 — Tactical encounter adapter

Scope:

- consume authoritative RPC/combat-log outcomes;
- use request/event identity as seed input where useful;
- support attack/save/damage/healing visual sequences;
- preserve Realtime/log authority;
- no movement/path/LOS physics changes.

### Phase 4 — Shared overlay/replay host if justified

Only after multiple consumers prove the need:

- consider `DiceOverlayHost` at `_app.js` level;
- queue overlapping roll requests;
- optional synchronized multiplayer animation;
- replay from stored normalized result + visual seed;
- user sound/motion preferences;
- dice material/skin preferences.

Do not build Phase 4 preemptively.

---

## Open design choices to resolve during implementation

These are intentionally not locked until the prototype provides evidence:

- exact tray camera angle and perspective;
- exact material style (metal/stone/resin/etc.);
- whether face numerals are textures, geometry, or atlas materials;
- exact gravity/restitution/friction presets;
- amount of final result-orientation guidance that looks natural;
- maximum simultaneous true dice before batching/summary mode;
- whether ordinary local sheet rolls keep fresh visual seeds after page reload;
- whether tactical multiplayer needs identical cross-client trajectories or simply identical outcomes with locally pleasing animations;
- sound effects and volume preference storage;
- whether resultCube remains a cube or becomes a branded Forge token while preserving drag semantics.

Do not decide these by theory alone. Browser-test them.

---

## Explicit non-goals

The Realistic Dice project is **not** authorization to:

- redesign D&D combat rules;
- make client physics authoritative;
- replace encounter RPC resolution;
- replace `encounterHex` pathing with Rapier;
- mix world-map and town-map behavior;
- touch world travel/weather/camps/clock;
- rebalance Character Forge ability methods;
- rewrite Character Sheet formulas;
- add unrelated crafting/inventory changes;
- rewrite deployed Supabase migration history.

---

## Handoff checklist for the next model

If this chat ends before implementation, the next model should do the following before coding:

1. Read `docs/DNDNext_Current_Handoff_Prompt.md`.
2. Read this file in full.
3. Inspect current PR #176 and current `main`; do not trust the SHA in an older conversation.
4. Inspect current `NpcForgeAbilityStep.js` and both current ability-dice CSS files.
5. Inspect the Character Sheet roll callback chain.
6. Inspect the tactical combat-log/result path and encounter board boundaries.
7. Re-check dependency compatibility for the current React/Next versions.
8. Propose the exact Phase 1 changed-file scope before writing.
9. Build the reusable core on a dedicated branch/PR from the user-accepted Forge checkpoint, not by continuously widening PR #176.
10. Verify every new helper, hook, state variable, prop, callback, physics-world reference, and result-contract field is defined and correctly passed.
11. Run focused dice/Forge regressions and protected-boundary validators.
12. Browser-test repeated rolls before claiming the physics feels realistic.
13. Verify exact-head CI and Vercel readiness before requesting merge.

## Definition of success

Phase 1 is successful when the Forge can throw six authoritative result cubes that:

- enter from varied positions with varied spin/velocity;
- physically collide with each other and the tray;
- visibly settle in different natural positions;
- always show the already-generated authoritative total;
- preserve hover math and drag assignment;
- do not change Character Forge mechanics;
- use the same core geometry/physics architecture that can later throw true d6/d8/d10/d12/d20 dice;
- leave tactical/map/database systems untouched.

That is the foundation to carry forward into Character Sheet and tactical combat without rebuilding the roller again.