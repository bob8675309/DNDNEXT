import { createSeededRandom } from "../diceVisualSeed.js";

const TAU = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const GRAVITY = 1120;
const SIDES = ["left", "right", "top", "bottom"];
const PHYSICS_HZ = 180;
const MAX_SUBSTEPS = 6;
const COLLISION_ITERATIONS = 6;
const FLOOR_CONTACT_SLOP = 0.65;

function between(random, min, max) {
  return min + (max - min) * random();
}

function choose(random, values) {
  return values[Math.floor(random() * values.length) % values.length];
}

function balancedSpawnSides(count, random) {
  const sides = Array.from({ length: count }, (_, index) => SIDES[index % SIDES.length]);
  for (let index = sides.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [sides[index], sides[swapIndex]] = [sides[swapIndex], sides[index]];
  }
  return sides;
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

function effectiveGravity(body, elapsed) {
  const rampTime = Math.max(0, elapsed - body.gravityRampStart);
  const scale = Math.min(body.gravityMaxScale, Math.exp(rampTime * body.gravityRampRate));
  return GRAVITY * scale;
}

// Height that the cube center must rise above its face-flat center height so the
// lowest rotated corner/edge stays on or above the tray. This turns rotation into
// gravitational potential: a cube balanced on an edge/corner has a higher center
// of mass than one resting on a face.
function cubeSupportClearance(body) {
  const sx = Math.sin(body.rx);
  const cx = Math.cos(body.rx);
  const sy = Math.sin(body.ry);
  const cy = Math.cos(body.ry);
  const supportHalf = body.halfExtent * (
    Math.abs(sy)
    + Math.abs(cy * sx)
    + Math.abs(cy * cx)
  );
  return Math.max(0, supportHalf - body.halfExtent);
}

function physicalBottom(body) {
  return body.z - cubeSupportClearance(body);
}

function isGrounded(body) {
  return physicalBottom(body) <= FLOOR_CONTACT_SLOP && Math.abs(body.vz) < body.floorBounceThreshold;
}

// Gravity acts through the currently lowest edge/corner as soon as the cube is in
// floor contact. The periodic torque has stable face-down equilibria and unstable
// edge-balanced equilibria, so a leading edge/corner naturally tips down.
function gravityRightingComponent(angle, angularVelocity) {
  let component = -Math.sin(4 * angle);
  const edgeBalanced = Math.cos(4 * angle) < -0.965 && Math.abs(component) < 0.08;
  if (edgeBalanced) {
    const direction = Math.abs(angularVelocity) > 0.04
      ? Math.sign(angularVelocity)
      : -Math.sign(Math.sin(2 * angle) || 1);
    component += direction * 0.18;
  }
  return component;
}

function applyFloorGravityTorque(body, dt, gravity) {
  const gravityScale = gravity / GRAVITY;
  const contactScale = 1 + Math.min(1.35, body.groundedTime * body.edgeTorqueRamp);
  const torque = body.edgeGravityTorque * gravityScale * contactScale;

  body.wx += gravityRightingComponent(body.rx, body.wx) * torque * dt;
  body.wy += gravityRightingComponent(body.ry, body.wy) * torque * dt;

  const damping = Math.exp(-body.edgeContactDamping * contactScale * dt);
  body.wx *= damping;
  body.wy *= damping;
}

// Low-energy supplemental face guidance remains a torque, never a direct angle rewrite.
function guideToFlatFace(body, dt, strength = body.faceSpring, damping = body.faceDamping) {
  if (!Number.isFinite(body.flatTargetX)) body.flatTargetX = nearestQuarterTurn(body.rx);
  if (!Number.isFinite(body.flatTargetY)) body.flatTargetY = nearestQuarterTurn(body.ry);

  const errorX = shortestAngleDelta(body.rx, body.flatTargetX);
  const errorY = shortestAngleDelta(body.ry, body.flatTargetY);
  body.wx += errorX * strength * dt;
  body.wy += errorY * strength * dt;

  const dampingDecay = Math.exp(-damping * dt);
  body.wx *= dampingDecay;
  body.wy *= dampingDecay;
}

function wakeBody(body) {
  if (!body?.settled || body.active === false || body.dragging) return;
  body.settled = false;
  body.settleFrames = 0;
  body.groundedTime = 0;
  body.flatTargetX = null;
  body.flatTargetY = null;
}

function addImpactLift(body, impact) {
  if (body.active === false || physicalBottom(body) > body.halfExtent * 0.5 || impact < 150) return;
  wakeBody(body);
  body.vz = Math.max(body.vz, Math.min(92, 8 + impact * 0.075));
}

function trayBounds(simulation, body) {
  const inset = simulation.wallInset;
  const half = body.collisionHalf;
  return {
    left: inset + half,
    right: simulation.width - inset - half,
    top: inset + half,
    bottom: simulation.height - inset - half,
  };
}

function resolveWall(body, simulation) {
  const bounds = trayBounds(simulation, body);
  if (body.x < bounds.left) {
    const impact = Math.abs(body.vx);
    body.x = bounds.left;
    body.vx = Math.abs(body.vx) * body.restitution;
    body.wy -= impact / Math.max(12, body.halfExtent) * 0.35;
    body.wz += body.vy * 0.004;
    addImpactLift(body, impact);
  } else if (body.x > bounds.right) {
    const impact = Math.abs(body.vx);
    body.x = bounds.right;
    body.vx = -Math.abs(body.vx) * body.restitution;
    body.wy += impact / Math.max(12, body.halfExtent) * 0.35;
    body.wz -= body.vy * 0.004;
    addImpactLift(body, impact);
  }

  if (body.y < bounds.top) {
    const impact = Math.abs(body.vy);
    body.y = bounds.top;
    body.vy = Math.abs(body.vy) * body.restitution;
    body.wx += impact / Math.max(12, body.halfExtent) * 0.35;
    body.wz -= body.vx * 0.004;
    addImpactLift(body, impact);
  } else if (body.y > bounds.bottom) {
    const impact = Math.abs(body.vy);
    body.y = bounds.bottom;
    body.vy = -Math.abs(body.vy) * body.restitution;
    body.wx -= impact / Math.max(12, body.halfExtent) * 0.35;
    body.wz += body.vx * 0.004;
    addImpactLift(body, impact);
  }
}

function resolveFloor(body) {
  const clearance = cubeSupportClearance(body);
  if (body.z > clearance + FLOOR_CONTACT_SLOP) return false;

  // Keep the lowest rotated edge/corner exactly on the tray. As the die tips toward
  // a face, clearance falls and gravity lowers the center smoothly rather than snapping.
  body.z = clearance;

  if (body.vz < -body.floorBounceThreshold) {
    const impact = -body.vz;
    body.vz = impact * body.floorRestitution;
    body.wx += body.vy / Math.max(12, body.halfExtent) * 0.08;
    body.wy -= body.vx / Math.max(12, body.halfExtent) * 0.08;
    body.wz += (body.vx - body.vy) * 0.0012;
    body.settleFrames = 0;
    body.groundedTime = 0;
    body.flatTargetX = null;
    body.flatTargetY = null;
    return false;
  }

  body.vz = 0;
  return true;
}

function verticalCubeOverlap(a, b) {
  const aBottom = physicalBottom(a);
  const aTop = aBottom + a.collisionSize;
  const bBottom = physicalBottom(b);
  const bTop = bBottom + b.collisionSize;
  return Math.min(aTop, bTop) - Math.max(aBottom, bBottom);
}

function collisionSign(delta, relativeVelocity) {
  if (Math.abs(delta) > 0.0001) return delta > 0 ? 1 : -1;
  return relativeVelocity >= 0 ? 1 : -1;
}

// Conservative solid-cube contact envelope. We intentionally use a slightly oversized,
// axis-aligned footprint so CSS-perspective corners never visibly pass through another die.
// Vertical overlap is required, but separation is always lateral; dice are not allowed to
// "solve" penetration by climbing onto one another.
function resolveSolidCubeCollision(a, b) {
  if (a.active === false || b.active === false || a.dragging || b.dragging) return false;
  if (verticalCubeOverlap(a, b) <= 0) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const overlapX = a.collisionHalf + b.collisionHalf - Math.abs(dx);
  const overlapY = a.collisionHalf + b.collisionHalf - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return false;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const resolveX = overlapX <= overlapY;
  const nx = resolveX ? collisionSign(dx, rvx) : 0;
  const ny = resolveX ? 0 : collisionSign(dy, rvy);
  const overlap = (resolveX ? overlapX : overlapY) + 0.35;
  const totalInvMass = a.invMass + b.invMass || 1;

  a.x -= nx * overlap * (a.invMass / totalInvMass);
  a.y -= ny * overlap * (a.invMass / totalInvMass);
  b.x += nx * overlap * (b.invMass / totalInvMass);
  b.y += ny * overlap * (b.invMass / totalInvMass);

  const alongNormal = rvx * nx + rvy * ny;
  const impact = Math.abs(alongNormal);
  if (impact > 18) {
    wakeBody(a);
    wakeBody(b);
  }

  if (alongNormal < 0) {
    const restitution = Math.min(a.restitution, b.restitution) * 0.88;
    const impulse = -(1 + restitution) * alongNormal / totalInvMass;
    const ix = impulse * nx;
    const iy = impulse * ny;
    a.vx -= ix * a.invMass;
    a.vy -= iy * a.invMass;
    b.vx += ix * b.invMass;
    b.vy += iy * b.invMass;

    const tx = -ny;
    const ty = nx;
    const tangentSpeed = rvx * tx + rvy * ty;
    const frictionImpulse = clamp(-tangentSpeed * 0.16, -Math.abs(impulse) * 0.24, Math.abs(impulse) * 0.24);
    a.vx -= tx * frictionImpulse * a.invMass;
    a.vy -= ty * frictionImpulse * a.invMass;
    b.vx += tx * frictionImpulse * b.invMass;
    b.vy += ty * frictionImpulse * b.invMass;

    const spinKick = (rvx * ny - rvy * nx) * 0.014;
    a.wz += spinKick;
    b.wz -= spinKick;
  }

  // Deliberately no die-on-die vertical lift. This 2.5D tray model keeps cubes solid and
  // side-separates them instead of allowing one die to stack on top of another.
  return true;
}

function resolveObstacle(body, obstacle) {
  if (body.active === false || body.dragging || obstacle.active === false || physicalBottom(body) > body.collisionSize * 0.95) return;
  const dx = body.x - obstacle.x;
  const dy = body.y - obstacle.y;
  const obstacleDistance = body.collisionHalf + obstacle.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared <= 0 || distanceSquared >= obstacleDistance * obstacleDistance) return;

  const distance = Math.sqrt(distanceSquared);
  const nx = dx / distance;
  const ny = dy / distance;
  body.x = obstacle.x + nx * obstacleDistance;
  body.y = obstacle.y + ny * obstacleDistance;
  const alongNormal = body.vx * nx + body.vy * ny;
  if (alongNormal < 0) {
    const impact = Math.abs(alongNormal);
    const impulse = -(1 + body.restitution * 0.82) * alongNormal;
    body.vx += impulse * nx;
    body.vy += impulse * ny;
    body.wz += (body.vx * ny - body.vy * nx) * 0.018;
    addImpactLift(body, impact);
  }
}

function resolveTrayConstraints(body, simulation) {
  for (let iteration = 0; iteration < 4; iteration += 1) {
    resolveWall(body, simulation);
    for (const obstacle of simulation.obstacles) resolveObstacle(body, obstacle);
    // An obstacle can separate a die toward an edge or a neighboring bumper.
    // Reapply the compact constraint set so the final position satisfies all
    // bumpers and, last of all, the visible tray boundary.
    resolveWall(body, simulation);
  }
}

function obstacleAxisPosition(random, length, preferredMin, preferredMax, clearance) {
  const hardMin = Math.min(length / 2, clearance);
  const hardMax = Math.max(length / 2, length - clearance);
  const min = Math.max(hardMin, length * preferredMin);
  const max = Math.min(hardMax, length * preferredMax);
  if (max > min) return between(random, min, max);
  return clamp(length / 2, hardMin, hardMax);
}

function clampObstacleToSafeArea(simulation, obstacle, maxCollisionHalf) {
  const clearance = simulation.wallInset + maxCollisionHalf + obstacle.radius + 1;
  obstacle.x = clamp(obstacle.x, Math.min(simulation.width / 2, clearance), Math.max(simulation.width / 2, simulation.width - clearance));
  obstacle.y = clamp(obstacle.y, Math.min(simulation.height / 2, clearance), Math.max(simulation.height / 2, simulation.height - clearance));
}

function activeObstacleCountForTray(dieCount, width, height, dieSize) {
  const maximum = dieCount >= 5 ? 3 : 2;
  if (height < dieSize * 5.25 || width < dieSize * 8.5) return 1;
  if (height < dieSize * 6.25 || width < dieSize * 10.5) return Math.min(2, maximum);
  return maximum;
}

function bodyAt(simulation, dieId) {
  return simulation?.bodies?.find((entry) => String(entry.id) === String(dieId)) || null;
}

function stopBody(body) {
  body.vx = 0;
  body.vy = 0;
  body.vz = 0;
  body.wx = 0;
  body.wy = 0;
  body.wz = 0;
}

function clampedBodyPosition(simulation, body, x, y) {
  const bounds = trayBounds(simulation, body);
  return {
    x: clamp(Number.isFinite(x) ? x : body.x, Math.min(bounds.left, bounds.right), Math.max(bounds.left, bounds.right)),
    y: clamp(Number.isFinite(y) ? y : body.y, Math.min(bounds.top, bounds.bottom), Math.max(bounds.top, bounds.bottom)),
  };
}

function placementIsOpen(simulation, body, x, y) {
  for (const other of simulation.bodies) {
    if (other === body || other.active === false) continue;
    const overlapX = body.collisionHalf + other.collisionHalf - Math.abs(other.x - x);
    const overlapY = body.collisionHalf + other.collisionHalf - Math.abs(other.y - y);
    if (overlapX > 0 && overlapY > 0) return false;
  }
  for (const obstacle of simulation.obstacles) {
    if (obstacle.active === false) continue;
    if (Math.hypot(x - obstacle.x, y - obstacle.y) < body.collisionHalf + obstacle.radius) return false;
  }
  return true;
}

function nearestOpenBodyPosition(simulation, body, targetX, targetY) {
  const target = clampedBodyPosition(simulation, body, targetX, targetY);
  if (placementIsOpen(simulation, body, target.x, target.y)) return target;

  const spacing = Math.max(8, body.collisionHalf * 0.38);
  const maxRadius = Math.hypot(simulation.width, simulation.height);
  const angleOffset = (body.index % 12) * (Math.PI / 12);
  for (let radius = spacing; radius <= maxRadius; radius += spacing) {
    const samples = Math.max(16, Math.ceil((Math.PI * 2 * radius) / spacing));
    for (let index = 0; index < samples; index += 1) {
      const angle = angleOffset + (index / samples) * Math.PI * 2;
      const candidate = clampedBodyPosition(
        simulation,
        body,
        target.x + Math.cos(angle) * radius,
        target.y + Math.sin(angle) * radius,
      );
      if (placementIsOpen(simulation, body, candidate.x, candidate.y)) return candidate;
    }
  }
  return clampedBodyPosition(simulation, body, body.dragOrigin?.x, body.dragOrigin?.y);
}

function wallInsetForSize(size) {
  return Math.max(16, size * 0.42);
}

function spawnBody(die, index, count, width, height, random, size, wallInset, side) {
  const halfExtent = size / 2;
  const collisionHalf = size * between(random, 0.59, 0.64);
  const collisionSize = collisionHalf * 2;
  const left = wallInset + collisionHalf;
  const right = Math.max(left, width - wallInset - collisionHalf);
  const top = wallInset + collisionHalf;
  const bottom = Math.max(top, height - wallInset - collisionHalf);
  const targetX = between(random, width * 0.28, width * 0.72);
  const targetY = between(random, height * 0.28, height * 0.72);
  const edgeDepth = between(random, 0, halfExtent * 0.25);
  let x;
  let y;

  if (side === "left") { x = left + edgeDepth; y = between(random, top, bottom); }
  else if (side === "right") { x = right - edgeDepth; y = between(random, top, bottom); }
  else if (side === "top") { x = between(random, left, right); y = top + edgeDepth; }
  else { x = between(random, left, right); y = bottom - edgeDepth; }

  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const launchSpeed = between(random, 500, 790) * (count > 8 ? 0.88 : 1);
  const lateral = between(random, -140, 140);
  const nx = dx / distance;
  const ny = dy / distance;
  const tx = -ny;
  const ty = nx;

  return {
    id: die.id,
    index,
    active: true,
    dragging: false,
    x,
    y,
    z: between(random, 10, 38),
    vx: nx * launchSpeed + tx * lateral,
    vy: ny * launchSpeed + ty * lateral,
    vz: between(random, 58, 138),
    rx: between(random, -Math.PI, Math.PI),
    ry: between(random, -Math.PI, Math.PI),
    rz: between(random, -Math.PI, Math.PI),
    wx: between(random, -10.5, 10.5) || 6,
    wy: between(random, -11.5, 11.5) || -7,
    wz: between(random, -4.5, 4.5) || 3,
    halfExtent,
    collisionHalf,
    collisionSize,
    radius: halfExtent,
    invMass: 1,
    restitution: between(random, 0.56, 0.72),
    floorRestitution: between(random, 0.16, 0.26),
    floorBounceThreshold: between(random, 28, 38),
    airDamping: between(random, 0.12, 0.22),
    groundFriction: between(random, 1.0, 1.6),
    rollingResistance: between(random, 0.78, 1.28),
    angularAirDamping: between(random, 0.34, 0.56),
    yawDamping: between(random, 1.6, 2.7),
    rollCoupling: between(random, 9, 14),
    gravityRampStart: between(random, 0.1, 0.5),
    gravityRampRate: between(random, 0.22, 0.34),
    gravityMaxScale: between(random, 1.55, 1.85),
    contactGripRate: between(random, 0.38, 0.58),
    maxContactGrip: between(random, 1.75, 2.25),
    edgeGravityTorque: between(random, 11.5, 16.5),
    edgeTorqueRamp: between(random, 0.7, 1.05),
    edgeContactDamping: between(random, 1.5, 2.4),
    faceSpring: between(random, 18, 26),
    faceDamping: between(random, 4.8, 6.6),
    settleAfter: between(random, 0.72, 1.25),
    forceAfter: between(random, 3.8, 4.9),
    settleFramesRequired: Math.round(between(random, 3, 6)),
    groundedTime: 0,
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
  const spawnSides = balancedSpawnSides(dice.length, random);
  const bodies = dice.map((die, index) => spawnBody(die, index, dice.length, width, height, random, dieSize, wallInset, spawnSides[index]));
  const obstacleCount = dice.length >= 5 ? 3 : 2;
  const activeObstacleCount = activeObstacleCountForTray(dice.length, width, height, dieSize);
  const maxCollisionHalf = Math.max(dieSize * 0.64, ...bodies.map((body) => body.collisionHalf));
  const obstacles = Array.from({ length: obstacleCount }, (_, index) => {
    const radius = between(random, dieSize * 0.38, dieSize * 0.58);
    const clearance = wallInset + maxCollisionHalf + radius + 1;
    return {
      id: `bumper-${index + 1}`,
      x: obstacleAxisPosition(random, width, 0.31, 0.69, clearance),
      y: obstacleAxisPosition(random, height, 0.3, 0.7, clearance),
      radius,
      active: index < activeObstacleCount,
    };
  });

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
  const maxCollisionHalf = Math.max(simulation.dieSize * 0.64, ...simulation.bodies.map((body) => body.collisionHalf));
  const activeObstacleCount = activeObstacleCountForTray(simulation.bodies.length, width, height, simulation.dieSize);
  simulation.obstacles.forEach((obstacle, index) => { obstacle.active = index < activeObstacleCount; });
  simulation.obstacles.forEach((obstacle) => clampObstacleToSafeArea(simulation, obstacle, maxCollisionHalf));
  simulation.bodies.forEach((body) => resolveTrayConstraints(body, simulation));
}

export function beginDiceBodyDrag(simulation, dieId) {
  const body = bodyAt(simulation, dieId);
  if (!body || body.active === false || !body.settled) return null;
  body.dragOrigin = { x: body.x, y: body.y };
  body.dragging = true;
  stopBody(body);
  body.z = cubeSupportClearance(body);
  return body;
}

export function moveDiceBodyDrag(simulation, dieId, x, y) {
  const body = bodyAt(simulation, dieId);
  if (!body?.dragging) return null;
  const position = clampedBodyPosition(simulation, body, x, y);
  body.x = position.x;
  body.y = position.y;
  body.z = cubeSupportClearance(body);
  stopBody(body);
  return body;
}

export function endDiceBodyDrag(simulation, dieId) {
  const body = bodyAt(simulation, dieId);
  if (!body?.dragging) return null;
  const position = nearestOpenBodyPosition(simulation, body, body.x, body.y);
  body.x = position.x;
  body.y = position.y;
  body.z = cubeSupportClearance(body);
  body.dragging = false;
  delete body.dragOrigin;
  body.settled = true;
  stopBody(body);
  simulation.complete = simulation.bodies.every((entry) => entry.active === false || entry.settled);
  return body;
}

export function setDiceSimulationActiveIds(simulation, activeIds = []) {
  if (!simulation) return;
  const active = new Set((activeIds || []).map(String));
  simulation.bodies.forEach((body) => {
    const nextActive = active.has(String(body.id));
    if (body.active && !nextActive) {
      stopBody(body);
      body.z = cubeSupportClearance(body);
      body.settled = true;
      body.dragging = false;
      delete body.dragOrigin;
    }
    body.active = nextActive;
  });
  simulation.complete = simulation.bodies.every((body) => body.active === false || body.settled);
}

function advanceBody(body, simulation, dt) {
  if (body.active === false || body.settled || body.dragging) return;

  const gravity = effectiveGravity(body, simulation.elapsed);
  body.vz -= gravity * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.z += body.vz * dt;

  const grounded = resolveFloor(body);
  body.groundedTime = grounded ? body.groundedTime + dt : 0;

  const contactGrip = grounded
    ? Math.min(body.maxContactGrip, Math.exp(body.groundedTime * body.contactGripRate))
    : 1;
  const planarDamping = grounded ? body.groundFriction * contactGrip : body.airDamping;
  const linearDecay = Math.exp(-planarDamping * dt);
  body.vx *= linearDecay;
  body.vy *= linearDecay;

  if (grounded) {
    const targetWx = body.vy / Math.max(12, body.halfExtent);
    const targetWy = -body.vx / Math.max(12, body.halfExtent);
    const rollBlend = 1 - Math.exp(-body.rollCoupling * dt);
    body.wx += (targetWx - body.wx) * rollBlend;
    body.wy += (targetWy - body.wy) * rollBlend;
    applyFloorGravityTorque(body, dt, gravity);
    const rollingDecay = Math.exp(-body.rollingResistance * contactGrip * dt);
    body.wx *= rollingDecay;
    body.wy *= rollingDecay;
    body.wz *= Math.exp(-body.yawDamping * contactGrip * dt);
  } else {
    const angularDecay = Math.exp(-body.angularAirDamping * dt);
    body.wx *= angularDecay;
    body.wy *= angularDecay;
    body.wz *= angularDecay;
  }

  body.rx = (body.rx + body.wx * dt) % TAU;
  body.ry = (body.ry + body.wy * dt) % TAU;
  body.rz = (body.rz + body.wz * dt) % TAU;

  // Re-resolve after rotation because changing orientation changes the height of the
  // lowest corner/edge. This is the key contact step that prevents a tilted cube from
  // hovering or penetrating the tray while gravity tips it toward a face.
  const groundedAfterRotation = resolveFloor(body);
  if (!groundedAfterRotation && grounded) body.groundedTime = Math.max(0, body.groundedTime - dt * 0.5);

  resolveTrayConstraints(body, simulation);

  const planarSpeed = speed(body);
  const spin = angularSpeed(body);
  const forceSettle = simulation.elapsed > body.forceAfter;
  const contactReady = groundedAfterRotation && body.groundedTime > 0.055 && simulation.elapsed > body.settleAfter;

  if (contactReady && (planarSpeed < 105 || forceSettle)) {
    const lowEnergy = clamp(1 - planarSpeed / 108, 0, 1) * clamp(1 - spin / 8, 0.2, 1);
    const springStrength = body.faceSpring * (0.38 + lowEnergy * 0.82) + (forceSettle ? 5 : 0);
    const springDamping = body.faceDamping * (0.72 + lowEnergy * 0.7) + (forceSettle ? 1.1 : 0);
    if (faceFlatError(body) < 0.42) {
      guideToFlatFace(body, dt, springStrength, springDamping);
    } else {
      body.flatTargetX = null;
      body.flatTargetY = null;
    }

    const brakingStrength = 0.42 + lowEnergy * 1.7 + (forceSettle ? 1.15 : 0);
    const braking = Math.exp(-brakingStrength * dt);
    body.vx *= braking;
    body.vy *= braking;
    body.wz *= Math.exp(-(1.45 + lowEnergy * 2.35 + (forceSettle ? 1.4 : 0)) * dt);
    if (forceSettle) body.forced = true;
  } else if (!groundedAfterRotation || planarSpeed > 120) {
    body.flatTargetX = null;
    body.flatTargetY = null;
  }
}

function resolveAllCubeCollisions(simulation) {
  for (let iteration = 0; iteration < COLLISION_ITERATIONS; iteration += 1) {
    let hadCollision = false;
    for (let i = 0; i < simulation.bodies.length; i += 1) {
      for (let j = i + 1; j < simulation.bodies.length; j += 1) {
        if (resolveSolidCubeCollision(simulation.bodies[i], simulation.bodies[j])) hadCollision = true;
      }
    }
    if (!hadCollision) break;
    for (const body of simulation.bodies) {
      if (body.active === false) continue;
      resolveTrayConstraints(body, simulation);
    }
  }
}

export function stepDiceSimulation(simulation, deltaSeconds) {
  if (!simulation || simulation.complete) return simulation;

  const frameDt = Math.min(1 / 30, Math.max(1 / 240, deltaSeconds || 1 / 60));
  const substeps = clamp(Math.ceil(frameDt * PHYSICS_HZ), 2, MAX_SUBSTEPS);
  const dt = frameDt / substeps;

  for (let step = 0; step < substeps; step += 1) {
    simulation.elapsed += dt;
    for (const body of simulation.bodies) advanceBody(body, simulation, dt);
    resolveAllCubeCollisions(simulation);
  }

  for (const body of simulation.bodies) {
    if (body.active === false || body.settled) continue;

    const grounded = isGrounded(body);
    const planarSpeed = speed(body);
    const spin = angularSpeed(body);
    const quiet = grounded
      && body.groundedTime > 0.07
      && planarSpeed < 6
      && spin < 0.34
      && faceFlatError(body) < 0.0045;
    body.settleFrames = quiet ? body.settleFrames + 1 : 0;

    if (body.settleFrames >= body.settleFramesRequired) {
      body.vx = 0;
      body.vy = 0;
      body.vz = 0;
      body.wx = 0;
      body.wy = 0;
      body.wz = 0;
      body.z = cubeSupportClearance(body);
      body.settled = true;
    }
  }

  simulation.complete = simulation.bodies.every((body) => body.active === false || body.settled);
  return simulation;
}
