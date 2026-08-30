import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(`Realistic Dice validation failed: ${message}`);
};

const tray = read("components/dice/RealisticDiceTray.js");
const adapter = read("components/dice/adapters/ForgeAbilityDiceTray.js");
const ability = read("components/NpcForgeAbilityStep.js");
const controller = read("components/useNpcForgeController.js");
const contract = read("utils/dice/diceRollContract.js");
const types = read("utils/dice/diceTypes.js");
const seed = read("utils/dice/diceVisualSeed.js");
const physics = read("utils/dice/physics/dicePhysicsEngine.js");
const css = read("components/dice/RealisticDiceTray.module.css");

for (const type of ["d6", "d8", "d10", "d12", "d20", "resultCube"]) {
  expect(types.includes(`"${type}"`), `missing reusable die type ${type}`);
}
expect(contract.includes("normalizeVisualDice"), "missing normalized visual-dice contract");
expect(seed.includes("crypto.getRandomValues"), "visual randomness must use a separate presentation seed");
expect(!physics.includes("Math.random"), "physics engine must not create game-result randomness with Math.random");
expect(physics.includes("resolveCircleCollision"), "die-to-die collision resolution missing");
expect(physics.includes("resolveObstacle"), "tray obstacle collision resolution missing");
expect(physics.includes("resolveWall"), "tray-wall collision resolution missing");
expect(physics.includes("resolveFloor") && physics.includes("GRAVITY") && physics.includes("body.vz"), "solid tray-floor gravity/bounce model missing");
expect(physics.includes("wallInset") && physics.includes("wallInsetForSize"), "inset physical tray walls missing");
expect(physics.includes("groundFriction") && physics.includes("rollingResistance") && physics.includes("rollCoupling"), "grounded rolling/contact coupling missing");
expect(!physics.includes("lateDamping"), "dice must not share one synchronized late slowdown");
expect(physics.includes("settleAfter") && physics.includes("forceAfter") && physics.includes("settleFramesRequired"), "per-die staggered settling controls missing");
expect(physics.includes("guideToFlatFace") && !physics.includes("Math.round(body.rx / (Math.PI / 2))"), "settling must converge instead of snapping cube rotation");
expect(physics.includes("wx") && physics.includes("wy") && physics.includes("wz"), "independent angular velocity missing");
expect(physics.includes("createDiceSimulation") && physics.includes("stepDiceSimulation"), "reusable physics engine API missing");

expect(tray.includes("requestAnimationFrame"), "runtime physics frame loop missing");
expect(tray.includes("prefers-reduced-motion"), "reduced-motion fallback missing");
expect(tray.includes("body.z") && tray.includes("translate3d"), "visible dice height must track floor/bounce physics");
expect(tray.includes("settledIds") && tray.includes("draggable={Boolean(draggable && settled)}"), "settled interaction state must be React-owned and survive rerenders");
expect(tray.includes('data-settled={settled ? "true" : "false"}'), "drag/click gating must reflect React settled state");
expect(!tray.includes('data-settled="false"\n        onClick'), "normal dice must not hard-code rolling state across React rerenders");
expect(tray.includes("hiddenDieIds") && tray.includes("onTrayDrop"), "assigned dice must be able to leave and return to the physical tray without replaying physics");
expect(css.includes("--tray-wall-inset") && css.includes("inset 0 0 0 var(--tray-wall-inset)"), "visual tray walls must match tighter physical inset");
expect(css.includes("transform-style: preserve-3d"), "cube must render as a 3D object");
expect(css.includes("face_front") && css.includes("face_top") && css.includes("face_bottom"), "cube face geometry missing");
expect(css.includes(".settled:hover .face b") && css.includes("opacity: 0"), "settled result must hide while hover detail is shown");
expect(css.includes(".selected .face") && css.includes(".assigned .face"), "selected/assigned Forge result feedback missing");
expect(css.includes(".staticDie") && css.includes(".returnButton"), "assigned ability-slot die presentation or return control missing");

expect(adapter.includes('type: "resultCube"'), "Forge must use aggregate resultCube rather than pretending totals are literal d6 faces");
expect(adapter.includes("roll.total"), "Forge adapter must consume existing authoritative totals");
expect(adapter.includes("ForgeAssignedAbilityDie"), "actual colored result die must render inside an assigned ability slot");
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
expect(!tray.includes("onReroll") && !physics.includes("roll.total"), "reusable visual core must not own Forge RNG/math");

const protectedTokens = ["MapPageClient", "advance_all_characters", "map_routes", "encounter_weapon_attack", "encounter_roll_save", "supabase"];
for (const source of [tray, adapter, contract, seed, physics]) {
  for (const token of protectedTokens) expect(!source.includes(token), `dice core crossed protected runtime boundary: ${token}`);
}

console.log("Reusable Realistic Dice core validated: grounded floor/gravity, tighter walls, staggered rolling/settling, authoritative-result contract, independent visual seed, assigned die transfer/return, React-owned drag gating, Forge allocation authority, and protected boundaries.");
