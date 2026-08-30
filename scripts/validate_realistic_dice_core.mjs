import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(`Realistic Dice validation failed: ${message}`);
};

const tray = read("components/dice/RealisticDiceTray.js");
const adapter = read("components/dice/adapters/ForgeAbilityDiceTray.js");
const ability = read("components/NpcForgeAbilityStep.js");
const abilityContext = read("components/NpcForgeAbilityContextCard.js");
const abilityGlyph = read("components/NpcForgeAbilityGlyph.js");
const controller = read("components/useNpcForgeController.js");
const contract = read("utils/dice/diceRollContract.js");
const types = read("utils/dice/diceTypes.js");
const seed = read("utils/dice/diceVisualSeed.js");
const physics = read("utils/dice/physics/dicePhysicsEngine.js");
const css = read("components/dice/RealisticDiceTray.module.css");
const trayLayoutCss = read("styles/character-forge-ability-dice-tray.css");

for (const type of ["d6", "d8", "d10", "d12", "d20", "resultCube"]) {
  expect(types.includes(`"${type}"`), `missing reusable die type ${type}`);
}
expect(contract.includes("normalizeVisualDice"), "missing normalized visual-dice contract");
expect(seed.includes("crypto.getRandomValues"), "visual randomness must use a separate presentation seed");
expect(!physics.includes("Math.random"), "physics engine must not create game-result randomness with Math.random");
expect(physics.includes("resolveSolidCubeCollision"), "solid die-to-die cube collision resolution missing");
expect(physics.includes("verticalCubeOverlap") && physics.includes("collisionHalf") && physics.includes("collisionSize"), "solid cube collision volume missing");
expect(!physics.includes("resolveCircleCollision"), "legacy circular die collision envelope must not remain active");
expect(physics.includes("PHYSICS_HZ") && physics.includes("MAX_SUBSTEPS") && physics.includes("COLLISION_ITERATIONS"), "high-speed collision substeps/iterations missing");
expect(physics.includes("const COLLISION_ITERATIONS = 6"), "solid cube collision solver needs enough iterative separation passes");
expect(physics.includes("resolveAllCubeCollisions") && physics.includes("for (let step = 0; step < substeps; step += 1)"), "multiple collision passes per rendered frame missing");
expect(physics.includes("balancedSpawnSides") && physics.includes("spawnSides[index]"), "six-die entry sides must be shuffled but balanced to avoid same-wall pileups");
expect(physics.includes("Deliberately no die-on-die vertical lift"), "die collisions must side-separate instead of permitting stacking");
expect(physics.includes("resolveObstacle"), "tray obstacle collision resolution missing");
expect(physics.includes("resolveWall"), "tray-wall collision resolution missing");
expect(physics.includes("resolveTrayConstraints") && physics.includes("activeObstacleCountForTray"), "responsive bumper/wall constraint pass missing");
expect(physics.includes("beginDiceBodyDrag") && physics.includes("moveDiceBodyDrag") && physics.includes("endDiceBodyDrag"), "manual settled-die repositioning API missing");
expect(physics.includes("placementIsOpen") && physics.includes("nearestOpenBodyPosition"), "manual placement must not displace or overlap neighboring dice");
expect(physics.includes("resolveFloor") && physics.includes("GRAVITY") && physics.includes("body.vz"), "solid tray-floor gravity/bounce model missing");
expect(physics.includes("effectiveGravity") && physics.includes("gravityRampStart") && physics.includes("gravityRampRate") && physics.includes("gravityMaxScale"), "per-die gravity ramp missing");
expect(physics.includes("Math.exp(rampTime * body.gravityRampRate)"), "gravity ramp must increase exponentially rather than linearly");
expect(physics.includes("cubeSupportClearance") && physics.includes("physicalBottom") && physics.includes("FLOOR_CONTACT_SLOP"), "rotated edge/corner tray support-height model missing");
expect(physics.includes("applyFloorGravityTorque") && physics.includes("gravityRightingComponent"), "gravity-driven edge/corner righting torque missing");
expect(physics.includes("-Math.sin(4 * angle)"), "floor gravity torque must have stable face equilibria and unstable edge equilibria");
expect(physics.includes("const groundedAfterRotation = resolveFloor(body)"), "floor contact must be re-evaluated after cube rotation changes its lowest edge/corner");
expect(physics.includes("wallInset") && physics.includes("wallInsetForSize"), "inset physical tray walls missing");
expect(physics.includes("groundFriction") && physics.includes("rollingResistance") && physics.includes("rollCoupling"), "grounded rolling/contact coupling missing");
expect(physics.includes("groundedTime") && physics.includes("contactGrip") && physics.includes("Math.exp(body.groundedTime * body.contactGripRate)"), "exponential sustained floor-contact grip missing");
expect(!physics.includes("lateDamping"), "dice must not share one synchronized late slowdown");
expect(physics.includes("settleAfter") && physics.includes("forceAfter") && physics.includes("settleFramesRequired"), "per-die staggered settling controls missing");
expect(physics.includes("Math.round(between(random, 3, 6))"), "settled result reveal must not wait through a long hidden stability counter");
expect(physics.includes("guideToFlatFace") && physics.includes("faceSpring") && physics.includes("faceDamping"), "damped supplemental face-seeking torque missing");
expect(physics.includes("body.wx += errorX * strength * dt") && physics.includes("body.wy += errorY * strength * dt"), "flat-face settling must act through angular velocity instead of directly rewriting orientation");
expect(physics.includes("faceFlatError(body) < 0.0045"), "settled face-flat tolerance is too loose for a visibly flush cube");
expect(!physics.includes("Math.round(body.rx / (Math.PI / 2))"), "settling must converge instead of snapping cube rotation");
expect(physics.includes("setDiceSimulationActiveIds") && physics.includes("body.active === false"), "dice removed from the tray must leave active collision participation");
expect(physics.includes("wx") && physics.includes("wy") && physics.includes("wz"), "independent angular velocity missing");
expect(physics.includes("createDiceSimulation") && physics.includes("stepDiceSimulation"), "reusable physics engine API missing");

expect(tray.includes("requestAnimationFrame"), "runtime physics frame loop missing");
expect(tray.includes("prefersReducedMotion"), "reduced-motion fallback missing");
expect(tray.includes("renderStatesRef") && tray.includes("smoothDieState") && tray.includes("smoothAngle"), "per-die render interpolation missing");
expect(tray.includes("shortestAngleDelta") && tray.includes("1 - Math.exp(-rate * dt)"), "frame-rate-independent shortest-path smoothing missing");
expect(tray.includes("rotateZ(${state.rz}rad) rotateY(${state.ry}rad) rotateX(${state.rx}rad)"), "render transform order must match physics X/Y support convention with world-Z yaw last");
expect(!tray.includes("rotateX(${body.rx}rad) rotateY(${body.ry}rad) rotateZ(${body.rz}rad)"), "legacy render rotation order can visually tilt a physics-flat cube");
expect(tray.includes("isVisuallyFaceFlat") && tray.includes("VISUAL_FLAT_EPSILON") && tray.includes("VISUAL_FLOOR_EPSILON"), "visual face-flat acceptance gate missing");
expect(tray.includes("simulation.complete && allVisualSettled"), "render loop must finish smoothing before stopping on the final pose");
expect(tray.includes("body.z") && tray.includes("translate3d"), "visible dice height must track floor/bounce physics");
expect(tray.includes("settledIds") && tray.includes("draggable={Boolean(draggable && settled)}"), "settled interaction state must be React-owned and survive rerenders");
expect(tray.includes('data-settled={settled ? "true" : "false"}'), "drag/click gating must reflect React settled state");
expect(!tray.includes('data-settled="false"\n        onClick'), "normal dice must not hard-code rolling state across React rerenders");
expect(tray.includes("hiddenDieIds") && tray.includes("onTrayDrop"), "assigned dice must be able to leave and return to the physical tray without replaying physics");
expect(tray.includes("setDiceSimulationActiveIds(simulation") && tray.includes("setDiceSimulationActiveIds(simulationRef.current"), "hidden assigned dice must be removed from tray collisions without rebuilding the roll");
expect(tray.includes("TrayArtwork") && tray.includes("styles.artwork"), "subtle tray-floor artwork missing");
expect(tray.includes("beginManualDrag") && tray.includes("moveManualDrag") && tray.includes("endManualDrag"), "tray does not wire settled dice to manual repositioning");
expect(tray.includes("syncBumperElements") && tray.includes("ResizeObserver"), "responsive bumper presentation must follow resized physics");
expect(css.includes("--tray-wall-inset") && css.includes("inset 0 0 0 var(--tray-wall-inset)"), "visual tray walls must match tighter physical inset");
expect(css.includes(".artwork") && css.includes(".dragging"), "tray artwork or manual-drag visual state missing");
expect(css.includes("transform-style: preserve-3d"), "cube must render as a 3D object");
expect(css.includes("face_front") && css.includes("face_top") && css.includes("face_bottom"), "cube face geometry missing");
expect(css.includes(".settled:hover .face b") && css.includes("opacity: 0"), "settled result must hide while hover detail is shown");
expect(css.includes(".selected .face") && css.includes(".assigned .face"), "selected/assigned Forge result feedback missing");
expect(css.includes(".staticDie") && css.includes(".returnButton"), "assigned ability-slot die presentation or return control missing");
expect(css.includes(".modifierBadge"), "assigned ability modifier badge missing");
expect(trayLayoutCss.includes("padding: 0") && trayLayoutCss.includes("forge-ability-realistic-dice"), "physical tray must expand through the outer Forge shell");

expect(adapter.includes('type: "resultCube"'), "Forge must use aggregate resultCube rather than pretending totals are literal d6 faces");
expect(adapter.includes("roll.total"), "Forge adapter must consume existing authoritative totals");
expect(adapter.includes("ForgeAssignedAbilityDie"), "actual colored result die must render inside an assigned ability slot");
expect(adapter.includes("modifierBadge") && adapter.includes("modifier = \"+0\""), "assigned result die modifier is not defined and rendered");
expect(adapter.includes("hiddenDieIds={assignedRollIds}"), "assigned result dice must leave the tray");
expect(adapter.includes("onTrayDrop") && adapter.includes("onReturnRoll"), "assigned result dice must return to the tray when removed");
expect(adapter.includes('selected: selectedRollId === roll.id'), "Forge selected result must remain visibly distinguishable");
expect(adapter.includes('event.dataTransfer.setData("text/npc-forge-roll", rollId)'), "existing Forge drag MIME contract missing");
expect(adapter.includes("4d6 drop lowest"), "Forge hover math must preserve 4d6-drop-lowest detail");
expect(ability.includes("<ForgeAbilityDiceTray") && ability.includes("<ForgeAssignedAbilityDie"), "Abilities step is not wired to tray and assigned-die presentations");
expect(ability.includes('onReturnRoll={(ability) => onAllocate(ability, "")}'), "Abilities step must route die removal through existing allocation authority");
expect(!ability.includes("Replace score"), "obsolete Replace score column must be removed");
expect(controller.includes("delete next[ability]"), "allocation authority must support returning an assigned die to the tray");
expect(controller.includes("if (prior) next[other] = prior") && controller.includes("else delete next[other]"), "moving dice between ability slots must preserve valid allocation swaps");
expect(ability.includes("onReroll();"), "existing Forge roll authority must remain the source of new totals");
expect(ability.includes("showAbilityDetail") && ability.includes("onFocusCapture={showAbilityDetail}"), "ability hover/click/focus detail routing missing");
expect(ability.includes("modifier={modifierLabel(finalAbilities?.[key] ?? roll.total)}"), "assigned die does not receive its current ability modifier");
expect(abilityContext.includes("ABILITY_DETAILED_GUIDE") && abilityContext.includes("activeGuide.uses.map"), "focused ability description and use bullets missing");
expect(abilityGlyph.includes("ABILITY_DETAILED_GUIDE") && abilityGlyph.includes("Athletics checks") && abilityGlyph.includes("Persuasion checks"), "six-ability detailed guide content missing");
expect(!tray.includes("onReroll") && !physics.includes("roll.total"), "reusable visual core must not own Forge RNG/math");

const protectedTokens = ["MapPageClient", "advance_all_characters", "map_routes", "encounter_weapon_attack", "encounter_roll_save", "supabase"];
for (const source of [tray, adapter, contract, seed, physics]) {
  for (const token of protectedTokens) expect(!source.includes(token), `dice core crossed protected runtime boundary: ${token}`);
}

console.log("Reusable Realistic Dice core validated: exponential per-die gravity/contact ramps, rotated corner/edge floor support with gravity righting torque, conservative solid-cube collisions, smoothed shortest-path rendering aligned to the physics rotation convention, strict visual face-flat completion, prompt result reveal, authoritative-result contract, assigned die transfer/return, React-owned drag gating, Forge allocation authority, and protected boundaries.");
