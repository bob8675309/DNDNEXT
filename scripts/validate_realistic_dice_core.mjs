import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(`Realistic Dice validation failed: ${message}`);
};

const tray = read("components/dice/RealisticDiceTray.js");
const adapter = read("components/dice/adapters/ForgeAbilityDiceTray.js");
const ability = read("components/NpcForgeAbilityStep.js");
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
expect(physics.includes("wx") && physics.includes("wy") && physics.includes("wz"), "independent angular velocity missing");
expect(physics.includes("createDiceSimulation") && physics.includes("stepDiceSimulation"), "reusable physics engine API missing");
expect(tray.includes("requestAnimationFrame"), "runtime physics frame loop missing");
expect(tray.includes("prefers-reduced-motion"), "reduced-motion fallback missing");
expect(tray.includes("data-settled"), "drag/click gating must wait until dice settle");
expect(css.includes("transform-style: preserve-3d"), "cube must render as a 3D object");
expect(css.includes("face_front") && css.includes("face_top") && css.includes("face_bottom"), "cube face geometry missing");
expect(css.includes(".settled:hover .face b") && css.includes("opacity: 0"), "settled result must hide while hover detail is shown");

expect(adapter.includes('type: "resultCube"'), "Forge must use aggregate resultCube rather than pretending totals are literal d6 faces");
expect(adapter.includes("roll.total"), "Forge adapter must consume existing authoritative totals");
expect(adapter.includes('event.dataTransfer.setData("text/npc-forge-roll", die.id)'), "existing Forge drag MIME contract missing");
expect(adapter.includes("4d6 drop lowest"), "Forge hover math must preserve 4d6-drop-lowest detail");
expect(ability.includes("<ForgeAbilityDiceTray"), "Abilities step is not wired to reusable dice adapter");
expect(ability.includes("onReroll();"), "existing Forge roll authority must remain the source of new totals");
expect(!tray.includes("onReroll") && !physics.includes("roll.total"), "reusable visual core must not own Forge RNG/math");

const protectedTokens = ["MapPageClient", "advance_all_characters", "map_routes", "encounter_weapon_attack", "encounter_roll_save", "supabase"];
for (const source of [tray, adapter, contract, seed, physics]) {
  for (const token of protectedTokens) expect(!source.includes(token), `dice core crossed protected runtime boundary: ${token}`);
}

console.log("Reusable Realistic Dice core validated: authoritative-result contract, independent visual seed, 3D result cubes, wall/die/bumper collisions, settled drag gating, Forge adapter, and protected boundaries.");
