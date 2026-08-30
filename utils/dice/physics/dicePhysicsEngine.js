import { createSeededRandom } from "../diceVisualSeed";

const TAU = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const GRAVITY = 980;
const SIDES = ["left", "right", "top", "bottom"];

function between(random, min, max) {
  return min + (max - min) * random();
}

function choose(random, values) {
  return values[Math.floor(random() * values.length) % values.length];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function speed(body) {
  return Math.hypot(body.vx, body.vy);
}

function angularSpeed(body) {
  return Math.hypot(body.wx, body.wy, body.wz);
}

function shortestAngleDelta(current, target) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function nearestQuarterTurn(value) {
  return Math.round(value / QUARTER_TURN) * QUARTER_TURN;
}

function faceFlatError(body) {
  return Math.max(
    Math.abs(shortestAngleDelta(body.rx, nearestQuarterTurn(body.rx))),
    Math.abs(shortestAngleDelta(body.ry, nearestQuarterTurn(body.ry))),
  );
}

function guideToFlatFace(body, dt, strength = 7) {
  if (!Number.isFinite(body.flatTargetX)) body.flatTargetX = nearestQuarterTurn(body.rx);
  if (!Number.isFinite(body.flatTargetY)) body.flatTargetY = nearestQuarterTurn(body.ry);
  const blend = 1 - Math.exp(-strength * dt);
  body.rx += shortestAngleDelta(body.rx, body.flatTargetX) * blend;
  body.ry += shortestAngleDelta(body.ry, body.flatTargetY) * blend;
}

function wakeBody(body) {
  if (!body?.settled) return;
  body.settled = false;
  body.settleFrames = 0;
  body.flatTargetX = null;
  body.flatTargetY = null;
}

function addImpactLift(body, impact) {
  if (body.z > body.radius * 0.4 || impact < 115) return;
  wakeBody(body);
  body.vz = Math.max(body.vz, Math.min(155, 22 + impact * 0.16));
}

function trayBounds(simulation, body) {
  const inset = simulation.wallInset;
  return {
    left: inset + body.radius,
    right: simulation.width - inset - body.radius,
    top: inset + body.radius,
    bottom: simulation.height - inset - body.radius,
  };
}

function resolveWall(body, simulation) {
  const bounds = trayBounds(simulation, body);
  if (body.x < bounds.left) {
    const impact = Math.abs(body.vx);
    body.x = bounds.left;
    body.vx = Math.abs(body.vx) * body.restitution;
    body.wy -= impact / Math.max(12, body.radius) * 0.42;
    body.wz += body.vy * 0.006;
    addImpactLift(body, impact);
  } else if (body.x > bounds.right) {
    const impact = Math.abs(body.vx);
    body.x = bounds.right;
    body.vx = -Math.abs(body.vx) * body.restitution;
    body.wy += impact / Math.max(12, body.radius) * 0.42;
    body.wz -= body.vy * 0.006;
    addImpactLift(body, impact);
  }
  if (body.y < bounds.top) {
    const impact = Math.abs(body.vy);
    body.y = bounds.top;
    body.vy = Math.abs(body.vy) * body.restitution;
    body.wx += impact / Math.max(12, body.radius) * 0.42;
    body.wz -= body.vx * 0.006;
    addImpactLift(body, impact);
  } else if (body.y > bounds.bottom) {
    const impact = Math.abs(body.vy);
    body.y = bounds.bottom;
    body.vy = -Math.abs(body.vy) * body.restitution;
    body.wx -= impact / Math.max(12, body.radius) * 0.42;
    body.wz += body.vx * 0.006;
    addImpactLift(body, impact);
  }
}

function resolveFloor(body) {
  if (body.z > 0) return false;
  body.z = 0;
  if (body.vz < -body.floorBounceThreshold) {
    const impact = -body.vz;
    body.vz = impact * body.floorRestitution;
    body.wx += body.vy / Math.max(12, body.radius) * 0.11;
    body.wy -= body.vx / Math.max(12, body.radius) * 0.11;
    body.wz += (body.vx - body.vy) * 0.0018;
    body.settleFrames = 0;
    body.flatTargetX = null;
    body.flatTargetY = null;
    return false;
  }
  body.vz = 0;
  return true;
}

function resolveCircleCollision(a, b) {
  const verticalDistance = Math.abs(a.z - b.z);
  if (verticalDistance > Math.max(a.radius, b.radius) * 1.25) return;

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

  const impact = Math.abs(alongNormal);
  if (impact > 22) {
    wakeBody(a);
    wakeBody(b);
  }

  const restitution = Math.min(a.restitution, b.restitution);
  const impulse = -(1 + restitution) * alongNormal / totalInvMass;
  const ix = impulse * nx;
  const iy = impulse * ny;
  a.vx -= ix * a.invMass;
  a.vy -= iy * a.invMass;
  b.vx += ix * b.invMass;
  b.vy += iy * b.invMass;

  const tangentKick = (a.wz - b.wz) * 0.016;
  a.vx -= ny * tangentKick;
  a.vy += nx * tangentKick;
  b.vx += ny * tangentKick;
  b.vy -= nx * tangentKick;
  a.wz += (rvx * ny - rvy * nx) * 0.024;
  b.wz -= (rvx * ny - rvy * nx) * 0.024;

  if (impact > 90) {
    const lift = Math.min(125, 14 + impact * 0.12);
    if (a.z < a.radius * 0.45) a.vz = Math.max(a.vz, lift * 0.72);
    if (b.z < b.radius * 0.45) b.vz = Math.max(b.vz, lift);
  }
}

function resolveObstacle(body, obstacle) {
  if (body.z > body.radius * 0.95) return;
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
    const impact = Math.abs(alongNormal);
    const impulse = -(1 + body.restitution * 0.88) * alongNormal;
    body.vx += impulse * nx;
    body.vy += impulse * ny;
    body.wz += (body.vx * ny - body.vy * nx) * 0.025;
    addImpactLift(body, impact);
  }
}

function wallInsetForSize(size) {
  return Math.max(16, size * 0.42);
}

function spawnBody(die, index, count, width, height, random, size, wallInset) {
  const radius = size * 0.52;
  const side = choose(random, SIDES);
  const left = wallInset + radius;
  const right = Math.max(left, width - wallInset - radius);
  const top = wallInset + radius;
  const bottom = Math.max(top, height - wallInset - radius);
  const targetX = between(random, width * 0.28, width * 0.72);
  const targetY = between(random, height * 0.28, height * 0.72);
  const edgeDepth = between(random, 0, radius * 0.3);
  let x;
  let y;
  if (side === "left") { x = left + edgeDepth; y = between(random, top, bottom); }
  else if (side === "right") { x = right - edgeDepth; y = between(random, top, bottom); }
  else if (side === "top") { x = between(random, left, right); y = top + edgeDepth; }
  else { x = between(random, left, right); y = bottom - edgeDepth; }

  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const launchSpeed = between(random, 470, 760) * (count > 8 ? 0.88 : 1);
  const lateral = between(random, -135, 135);
  const nx = dx / distance;
  const ny = dy / distance;
  const tx = -ny;
  const ty = nx;

  return {
    id: die.id,
    index,
    x,
    y,
    z: between(random, 12, 48),
    vx: nx * launchSpeed + tx * lateral,
    vy: ny * launchSpeed + ty * lateral,
    vz: between(random, 70, 175),
    rx: between(random, -Math.PI, Math.PI),
    ry: between(random, -Math.PI, Math.PI),
    rz: between(random, -Math.PI, Math.PI),
    wx: between(random, -11, 11) || 6,
    wy: between(random, -12, 12) || -7,
    wz: between(random, -5, 5) || 3,
    radius,
    invMass: 1,
    restitution: between(random, 0.62, 0.82),
    floorRestitution: between(random, 0.25, 0.39),
    floorBounceThreshold: between(random, 34, 48),
    airDamping: between(random, 0.08, 0.16),
    groundFriction: between(random, 0.62, 1.12),
    rollingResistance: between(random, 0.42, 0.82),
    angularAirDamping: between(random, 0.18, 0.34),
    yawDamping: between(random, 1.15, 2.15),
    rollCoupling: between(random, 7.5, 12),
    settleAfter: between(random, 1.35, 2.35),
    forceAfter: between(random, 4.4, 5.65),
    settleFramesRequired: Math.round(between(random, 11, 22)),
    settled: false,
    settleFrames: 0,
    flatTargetX: null,
    flatTargetY: null,
    forced: false,
  };
}

export function createDiceSimulation({ dice = [], width, height, seed, dieSize = 44 }) {
  const random = createSeededRandom(seed);
  const wallInset = wallInsetForSize(dieSize);
  const bodies = dice.map((die, index) => spawnBody(die, index, dice.length, width, height, random, dieSize, wallInset));
  const obstacleCount = dice.length >= 5 ? 3 : 2;
  const obstacles = Array.from({ length: obstacleCount }, (_, index) => ({
    id: `bumper-${index + 1}`,
    x: between(random, width * 0.31, width * 0.69),
    y: between(random, height * 0.3, height * 0.7),
    radius: between(random, dieSize * 0.38, dieSize * 0.6),
  }));

  return {
    seed,
    width,
    height,
    dieSize,
    wallInset,
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

  for (const body of simulation.bodies) {
    if (body.settled) continue;

    body.vz -= GRAVITY * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.z += body.vz * dt;

    const grounded = resolveFloor(body);
    const planarDamping = grounded ? body.groundFriction : body.airDamping;
    const linearDecay = Math.exp(-planarDamping * dt);
    body.vx *= linearDecay;
    body.vy *= linearDecay;

    if (grounded) {
      const targetWx = body.vy / Math.max(12, body.radius);
      const targetWy = -body.vx / Math.max(12, body.radius);
      const rollBlend = 1 - Math.exp(-body.rollCoupling * dt);
      body.wx += (targetWx - body.wx) * rollBlend;
      body.wy += (targetWy - body.wy) * rollBlend;
      const rollingDecay = Math.exp(-body.rollingResistance * dt);
      body.wx *= rollingDecay;
      body.wy *= rollingDecay;
      body.wz *= Math.exp(-body.yawDamping * dt);
    } else {
      const angularDecay = Math.exp(-body.angularAirDamping * dt);
      body.wx *= angularDecay;
      body.wy *= angularDecay;
      body.wz *= angularDecay;
    }

    body.rx = (body.rx + body.wx * dt) % TAU;
    body.ry = (body.ry + body.wy * dt) % TAU;
    body.rz = (body.rz + body.wz * dt) % TAU;

    resolveWall(body, simulation);
    for (const obstacle of simulation.obstacles) resolveObstacle(body, obstacle);
  }

  for (let i = 0; i < simulation.bodies.length; i += 1) {
    for (let j = i + 1; j < simulation.bodies.length; j += 1) {
      resolveCircleCollision(simulation.bodies[i], simulation.bodies[j]);
    }
  }

  for (const body of simulation.bodies) {
    if (body.settled) continue;
    const grounded = body.z <= 0.001 && Math.abs(body.vz) < 0.001;
    const planarSpeed = speed(body);
    const spin = angularSpeed(body);
    const forceSettle = simulation.elapsed > body.forceAfter;

    if (grounded && simulation.elapsed > body.settleAfter && (planarSpeed < 56 || forceSettle)) {
      guideToFlatFace(body, dt, forceSettle ? 13 : 6.5);
      const braking = Math.exp(-(forceSettle ? 5.6 : 1.5) * dt);
      body.vx *= braking;
      body.vy *= braking;
      body.wx *= braking;
      body.wy *= braking;
      body.wz *= Math.exp(-(forceSettle ? 7 : 2.4) * dt);
      if (forceSettle) body.forced = true;
    } else {
      body.flatTargetX = null;
      body.flatTargetY = null;
    }

    const quiet = grounded
      && planarSpeed < 8
      && spin < 0.55
      && faceFlatError(body) < 0.035;
    body.settleFrames = quiet ? body.settleFrames + 1 : 0;
    if (body.settleFrames > body.settleFramesRequired) {
      body.vx = 0;
      body.vy = 0;
      body.vz = 0;
      body.wx = 0;
      body.wy = 0;
      body.wz = 0;
      body.z = 0;
      body.settled = true;
    }
  }

  simulation.complete = simulation.bodies.every((body) => body.settled);
  return simulation;
}
