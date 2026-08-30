import {
  beginDiceBodyDrag,
  createDiceSimulation,
  endDiceBodyDrag,
  moveDiceBodyDrag,
  resizeDiceSimulation,
  setDiceSimulationActiveIds,
  stepDiceSimulation,
} from "../utils/dice/physics/dicePhysicsEngine.js";

const expect = (condition, message) => {
  if (!condition) throw new Error(`Realistic Dice physics validation failed: ${message}`);
};

const QUARTER_TURN = Math.PI / 2;
const EPSILON = 0.001;
const OBSTACLE_EPSILON = 0.1;
const dice = Array.from({ length: 6 }, (_, index) => ({
  id: `stress-die-${index + 1}`,
  type: "resultCube",
  result: 8 + index,
  accent: "violet",
}));

function quarterTurnError(value) {
  const target = Math.round(value / QUARTER_TURN) * QUARTER_TURN;
  return Math.abs(Math.atan2(Math.sin(target - value), Math.cos(target - value)));
}

function assertFiniteBody(body, seed) {
  for (const key of ["x", "y", "z", "rx", "ry", "rz", "vx", "vy", "vz", "wx", "wy", "wz"]) {
    expect(Number.isFinite(body[key]), `${seed} produced non-finite ${body.id}.${key}`);
  }
}

function assertLegalPlacement(simulation, seed) {
  for (const body of simulation.bodies.filter((entry) => entry.active !== false)) {
    assertFiniteBody(body, seed);
    const left = simulation.wallInset + body.collisionHalf;
    const right = simulation.width - simulation.wallInset - body.collisionHalf;
    const top = simulation.wallInset + body.collisionHalf;
    const bottom = simulation.height - simulation.wallInset - body.collisionHalf;
    expect(body.x >= left - EPSILON && body.x <= right + EPSILON, `${seed} left ${body.id} outside horizontal tray bounds`);
    expect(body.y >= top - EPSILON && body.y <= bottom + EPSILON, `${seed} left ${body.id} outside vertical tray bounds`);
    expect(Math.max(quarterTurnError(body.rx), quarterTurnError(body.ry)) < 0.0045, `${seed} left ${body.id} visibly tilted`);

    for (const obstacle of simulation.obstacles.filter((entry) => entry.active !== false)) {
      expect(
        Math.hypot(body.x - obstacle.x, body.y - obstacle.y) + OBSTACLE_EPSILON >= body.collisionHalf + obstacle.radius,
        `${seed} left ${body.id} intersecting ${obstacle.id}`,
      );
    }
  }

  const active = simulation.bodies.filter((entry) => entry.active !== false);
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex];
      const right = active[rightIndex];
      const overlapX = left.collisionHalf + right.collisionHalf - Math.abs(right.x - left.x);
      const overlapY = left.collisionHalf + right.collisionHalf - Math.abs(right.y - left.y);
      expect(overlapX <= EPSILON || overlapY <= EPSILON, `${seed} left ${left.id} overlapping ${right.id}`);
    }
  }
}

let maximumFrames = 0;
for (let index = 0; index < 500; index += 1) {
  const seed = `responsive-tray-stress-${index}`;
  const width = 420 + ((index * 37) % 150);
  const height = 220 + ((index * 53) % 145);
  const dieSize = 38 + (index % 10);
  const simulation = createDiceSimulation({ dice, width, height, seed, dieSize });
  let frames = 0;

  while (!simulation.complete && frames < 1200) {
    if (frames === 45 && index % 7 === 0) {
      resizeDiceSimulation(simulation, Math.max(420, width - 34), Math.max(220, height - 26));
    }
    stepDiceSimulation(simulation, 1 / 60);
    frames += 1;
  }

  expect(simulation.complete, `${seed} did not settle within 1200 frames`);
  maximumFrames = Math.max(maximumFrames, frames);
  assertLegalPlacement(simulation, seed);

  if (index === 0) {
    const dragged = simulation.bodies[0];
    const target = simulation.bodies[1];
    const stationaryBefore = simulation.bodies.slice(1).map((body) => ({ id: body.id, x: body.x, y: body.y }));
    expect(beginDiceBodyDrag(simulation, dragged.id)?.dragging, "settled die did not enter manual drag mode");
    expect(moveDiceBodyDrag(simulation, dragged.id, target.x, target.y)?.dragging, "manual drag did not follow the pointer target");
    stationaryBefore.forEach((before) => {
      const after = simulation.bodies.find((body) => body.id === before.id);
      expect(after.x === before.x && after.y === before.y, `manual drag displaced stationary ${before.id}`);
    });
    expect(endDiceBodyDrag(simulation, dragged.id)?.dragging === false, "manual drag did not end cleanly");
    assertLegalPlacement(simulation, `${seed}-manual-drag`);

    setDiceSimulationActiveIds(simulation, dice.slice(1).map((die) => die.id));
    expect(simulation.bodies[0].active === false, "hidden die remained in active tray collisions");
    setDiceSimulationActiveIds(simulation, dice.map((die) => die.id));
    expect(simulation.bodies.every((body) => body.active), "returned die did not rejoin the active tray");
    assertLegalPlacement(simulation, `${seed}-return`);
  }
}

console.log(`Realistic Dice numerical physics validated across 500 responsive six-die throws (maximum ${maximumFrames} frames), resize constraints, collision-free manual repositioning, and hidden/return lifecycle.`);
