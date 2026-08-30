import { createSeededRandom } from "../diceVisualSeed";

const TAU = Math.PI * 2;
const SIDES = ["left", "right", "top", "bottom"];

function between(random, min, max) {
  return min + (max - min) * random();
}

function choose(random, values) {
  return values[Math.floor(random() * values.length) % values.length];
}

function speed(body) {
  return Math.hypot(body.vx, body.vy);
}

function angularSpeed(body) {
  return Math.hypot(body.wx, body.wy, body.wz);
}

function resolveWall(body, width, height) {
  const r = body.radius;
  if (body.x < r) {
    body.x = r;
    body.vx = Math.abs(body.vx) * body.restitution;
    body.wy *= -0.88;
  } else if (body.x > width - r) {
    body.x = width - r;
    body.vx = -Math.abs(body.vx) * body.restitution;
    body.wy *= -0.88;
  }
  if (body.y < r) {
    body.y = r;
    body.vy = Math.abs(body.vy) * body.restitution;
    body.wx *= -0.88;
  } else if (body.y > height - r) {
    body.y = height - r;
    body.vy = -Math.abs(body.vy) * body.restitution;
    body.wx *= -0.88;
  }
}

function resolveCircleCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDistance = a.radius + b.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared <= 0 || distanceSquared >= minDistance * minDistance) return;

  const distance = Math.sqrt(distanceSquared);
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const totalInvMass = a.invMass + b.invMass || 1;
  a.x -= nx * overlap * (a.invMass / totalInvMass);
  a.y -= ny * overlap * (a.invMass / totalInvMass);
  b.x += nx * overlap * (b.invMass / totalInvMass);
  b.y += ny * overlap * (b.invMass / totalInvMass);

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const alongNormal = rvx * nx + rvy * ny;
  if (alongNormal > 0) return;

  const restitution = Math.min(a.restitution, b.restitution);
  const impulse = -(1 + restitution) * alongNormal / totalInvMass;
  const ix = impulse * nx;
  const iy = impulse * ny;
  a.vx -= ix * a.invMass;
  a.vy -= iy * a.invMass;
  b.vx += ix * b.invMass;
  b.vy += iy * b.invMass;

  const tangentKick = (a.wz - b.wz) * 0.012;
  a.vx -= ny * tangentKick;
  a.vy += nx * tangentKick;
  b.vx += ny * tangentKick;
  b.vy -= nx * tangentKick;
  a.wz += (rvx * ny - rvy * nx) * 0.018;
  b.wz -= (rvx * ny - rvy * nx) * 0.018;
}

function resolveObstacle(body, obstacle) {
  const dx = body.x - obstacle.x;
  const dy = body.y - obstacle.y;
  const minDistance = body.radius + obstacle.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared <= 0 || distanceSquared >= minDistance * minDistance) return;

  const distance = Math.sqrt(distanceSquared);
  const nx = dx / distance;
  const ny = dy / distance;
  body.x = obstacle.x + nx * minDistance;
  body.y = obstacle.y + ny * minDistance;
  const alongNormal = body.vx * nx + body.vy * ny;
  if (alongNormal < 0) {
    const impulse = -(1 + body.restitution * 0.9) * alongNormal;
    body.vx += impulse * nx;
    body.vy += impulse * ny;
    body.wz += (body.vx * ny - body.vy * nx) * 0.02;
  }
}

function spawnBody(die, index, count, width, height, random, size) {
  const radius = size * 0.52;
  const side = choose(random, SIDES);
  const margin = radius * between(random, 1.2, 2.8);
  const targetX = between(random, width * 0.2, width * 0.8);
  const targetY = between(random, height * 0.2, height * 0.8);
  let x;
  let y;
  if (side === "left") { x = -margin; y = between(random, radius, height - radius); }
  else if (side === "right") { x = width + margin; y = between(random, radius, height - radius); }
  else if (side === "top") { x = between(random, radius, width - radius); y = -margin; }
  else { x = between(random, radius, width - radius); y = height + margin; }

  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const launchSpeed = between(random, 280, 520) * (count > 8 ? 0.86 : 1);
  const lateral = between(random, -95, 95);
  const nx = dx / distance;
  const ny = dy / distance;
  const tx = -ny;
  const ty = nx;

  return {
    id: die.id,
    index,
    x,
    y,
    vx: nx * launchSpeed + tx * lateral,
    vy: ny * launchSpeed + ty * lateral,
    rx: between(random, -Math.PI, Math.PI),
    ry: between(random, -Math.PI, Math.PI),
    rz: between(random, -Math.PI, Math.PI),
    wx: between(random, -12, 12) || 7,
    wy: between(random, -13, 13) || -8,
    wz: between(random, -10, 10) || 6,
    radius,
    invMass: 1,
    restitution: between(random, 0.58, 0.78),
    linearDamping: between(random, 0.74, 1.02),
    angularDamping: between(random, 0.6, 0.92),
    settled: false,
    settleFrames: 0,
    forced: false,
  };
}

export function createDiceSimulation({ dice = [], width, height, seed, dieSize = 44 }) {
  const random = createSeededRandom(seed);
  const bodies = dice.map((die, index) => spawnBody(die, index, dice.length, width, height, random, dieSize));
  const obstacleCount = dice.length >= 5 ? 3 : 2;
  const obstacles = Array.from({ length: obstacleCount }, (_, index) => ({
    id: `bumper-${index + 1}`,
    x: between(random, width * 0.27, width * 0.73),
    y: between(random, height * 0.26, height * 0.74),
    radius: between(random, dieSize * 0.42, dieSize * 0.7),
  }));

  return {
    seed,
    width,
    height,
    elapsed: 0,
    bodies,
    obstacles,
    complete: false,
  };
}

export function resizeDiceSimulation(simulation, width, height) {
  if (!simulation) return;
  const sx = width / Math.max(1, simulation.width);
  const sy = height / Math.max(1, simulation.height);
  simulation.width = width;
  simulation.height = height;
  simulation.bodies.forEach((body) => {
    body.x *= sx;
    body.y *= sy;
  });
  simulation.obstacles.forEach((obstacle) => {
    obstacle.x *= sx;
    obstacle.y *= sy;
  });
}

export function stepDiceSimulation(simulation, deltaSeconds) {
  if (!simulation || simulation.complete) return simulation;
  const dt = Math.min(1 / 30, Math.max(1 / 240, deltaSeconds || 1 / 60));
  simulation.elapsed += dt;

  const lateDamping = simulation.elapsed > 2.6 ? 2.5 : 1;
  for (const body of simulation.bodies) {
    if (body.settled) continue;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.rx = (body.rx + body.wx * dt) % TAU;
    body.ry = (body.ry + body.wy * dt) % TAU;
    body.rz = (body.rz + body.wz * dt) % TAU;

    const linearDecay = Math.exp(-body.linearDamping * lateDamping * dt);
    const angularDecay = Math.exp(-body.angularDamping * lateDamping * dt);
    body.vx *= linearDecay;
    body.vy *= linearDecay;
    body.wx *= angularDecay;
    body.wy *= angularDecay;
    body.wz *= angularDecay;
    resolveWall(body, simulation.width, simulation.height);
    for (const obstacle of simulation.obstacles) resolveObstacle(body, obstacle);
  }

  for (let i = 0; i < simulation.bodies.length; i += 1) {
    for (let j = i + 1; j < simulation.bodies.length; j += 1) {
      resolveCircleCollision(simulation.bodies[i], simulation.bodies[j]);
    }
  }

  for (const body of simulation.bodies) {
    if (body.settled) continue;
    const quiet = speed(body) < 13 && angularSpeed(body) < 1.25;
    body.settleFrames = quiet ? body.settleFrames + 1 : 0;
    if (body.settleFrames > 18 || simulation.elapsed > 5.2) {
      body.vx = 0;
      body.vy = 0;
      body.wx = 0;
      body.wy = 0;
      body.wz = 0;
      body.rx = Math.round(body.rx / (Math.PI / 2)) * (Math.PI / 2);
      body.ry = Math.round(body.ry / (Math.PI / 2)) * (Math.PI / 2);
      body.rz = Math.round(body.rz / (Math.PI / 2)) * (Math.PI / 2);
      body.settled = true;
      body.forced = simulation.elapsed > 5.2;
    }
  }
  simulation.complete = simulation.bodies.every((body) => body.settled);
  return simulation;
}
