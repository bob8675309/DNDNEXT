import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import styles from "./RealisticDiceTray.module.css";
import { normalizeVisualDice } from "../../utils/dice/diceRollContract";
import { createDiceVisualSeed } from "../../utils/dice/diceVisualSeed";
import {
  beginDiceBodyDrag,
  createDiceSimulation,
  endDiceBodyDrag,
  moveDiceBodyDrag,
  resizeDiceSimulation,
  setDiceSimulationActiveIds,
  stepDiceSimulation,
} from "../../utils/dice/physics/dicePhysicsEngine";

const FACE_NAMES = ["front", "back", "right", "left", "top", "bottom"];
const QUARTER_TURN = Math.PI / 2;
const VISUAL_FLAT_EPSILON = 0.0025;
const VISUAL_FLOOR_EPSILON = 0.075;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function shortestAngleDelta(current, target) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function nearestQuarterTurn(value) {
  return Math.round(value / QUARTER_TURN) * QUARTER_TURN;
}

function smoothScalar(current, target, rate, dt) {
  const blend = 1 - Math.exp(-rate * dt);
  return current + (target - current) * blend;
}

function smoothAngle(current, target, rate, dt) {
  const blend = 1 - Math.exp(-rate * dt);
  return current + shortestAngleDelta(current, target) * blend;
}

function createRenderState(body) {
  return {
    x: body.x,
    y: body.y,
    z: body.z,
    rx: body.rx,
    ry: body.ry,
    rz: body.rz,
  };
}

function smoothDieState(previous, body, dt) {
  const state = previous || createRenderState(body);
  const finishing = Boolean(body.settled);
  const targetRx = finishing ? nearestQuarterTurn(body.rx) : body.rx;
  const targetRy = finishing ? nearestQuarterTurn(body.ry) : body.ry;
  const targetZ = finishing ? 0 : body.z;

  // Physics corrections remain immediate and authoritative. Rendering follows them with
  // a short critically-damped-style exponential blend so 180 Hz contacts do not appear
  // as one-frame teleports at a 60/120 Hz paint rate. Position is intentionally stiffer
  // than rotation so conservative collision envelopes still read as solid.
  state.x = smoothScalar(state.x, body.x, finishing ? 54 : 62, dt);
  state.y = smoothScalar(state.y, body.y, finishing ? 54 : 62, dt);
  state.z = smoothScalar(state.z, targetZ, finishing ? 34 : 46, dt);
  state.rx = smoothAngle(state.rx, targetRx, finishing ? 32 : 38, dt);
  state.ry = smoothAngle(state.ry, targetRy, finishing ? 32 : 38, dt);
  state.rz = smoothAngle(state.rz, body.rz, finishing ? 28 : 36, dt);
  return state;
}

function isVisuallyFaceFlat(state, body) {
  if (!body?.settled || !state) return false;
  return Math.abs(shortestAngleDelta(state.rx, nearestQuarterTurn(body.rx))) < VISUAL_FLAT_EPSILON
    && Math.abs(shortestAngleDelta(state.ry, nearestQuarterTurn(body.ry))) < VISUAL_FLAT_EPSILON
    && Math.abs(state.z) < VISUAL_FLOOR_EPSILON;
}

function setDieTransform(element, state) {
  if (!element || !state) return;
  element.style.left = `${state.x}px`;
  element.style.top = `${state.y}px`;
  element.style.zIndex = String(4 + Math.round(state.y / 52) + Math.round(state.z / 28));
  const cube = element.querySelector(`.${styles.cube}`);
  if (cube) {
    // CSS transform functions are composed right-to-left. Rx -> Ry -> world-Z yaw is the
    // same orientation convention used by cubeSupportClearance in the physics engine, so
    // a physics face-flat result now also renders face-flat instead of retaining a visual tilt.
    cube.style.transform = `translate3d(0, ${-state.z}px, 0) rotateZ(${state.rz}rad) rotateY(${state.ry}rad) rotateX(${state.rx}rad)`;
  }
  const shadow = element.querySelector(`.${styles.shadow}`);
  if (shadow) {
    const heightRatio = Math.min(1, Math.max(0, state.z / 120));
    shadow.style.opacity = String(0.5 - heightRatio * 0.32);
    shadow.style.transform = `translate(-50%, -50%) scale(${1 + heightRatio * 0.42})`;
    shadow.style.filter = `blur(${6 + heightRatio * 6}px)`;
  }
}

function dieStateClasses(die) {
  return [
    die.detail?.selected ? styles.selected : "",
    die.detail?.assigned ? styles.assigned : "",
  ].filter(Boolean).join(" ");
}

function TrayArtwork() {
  return <svg className={styles.artwork} viewBox="0 0 800 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g className={styles.artworkOrbit}>
      <ellipse cx="400" cy="180" rx="238" ry="118" />
      <ellipse cx="400" cy="180" rx="174" ry="86" transform="rotate(-17 400 180)" />
      <circle cx="400" cy="180" r="68" />
      <circle cx="400" cy="180" r="45" />
    </g>
    <g className={styles.artworkCompass}>
      <path d="M400 74 426 151 508 180 426 209 400 286 374 209 292 180 374 151Z" />
      <path d="m400 123 33 57-33 57-33-57Z" />
      <path d="M238 180h324M400 47v266" />
    </g>
    <g className={styles.artworkRunes}>
      <path d="m197 134 14-15 10 19 18-8M591 126l11-18 13 17 17-10M207 236l13 15 14-17 17 9M574 245l17 9 11-19 18 7" />
      <circle cx="156" cy="180" r="4" /><circle cx="644" cy="180" r="4" />
      <circle cx="400" cy="54" r="3" /><circle cx="400" cy="306" r="3" />
    </g>
  </svg>;
}

function syncBumperElements(simulation, bumperElements) {
  bumperElements.forEach((bumper, index) => {
    if (!bumper) return;
    const obstacle = simulation?.obstacles?.[index];
    if (!obstacle || obstacle.active === false) {
      bumper.hidden = true;
      return;
    }
    bumper.hidden = false;
    bumper.style.left = `${obstacle.x}px`;
    bumper.style.top = `${obstacle.y}px`;
    bumper.style.width = `${obstacle.radius * 2}px`;
    bumper.style.marginLeft = `${-obstacle.radius}px`;
    bumper.style.marginTop = `${-obstacle.radius}px`;
  });
}

export const ResultCubeDie = forwardRef(function ResultCubeDie({
  die,
  settled = true,
  staticPlacement = false,
  className = "",
  draggable = settled,
  renderTooltip = null,
  onClick = null,
  onDragStart = null,
  onDragEnd = null,
  showShadow = true,
  ariaLabel = null,
  dragging = false,
}, ref) {
  if (!die) return null;
  return <button
    ref={ref}
    type="button"
    className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${settled ? styles.settled : styles.rolling} ${staticPlacement ? styles.staticDie : ""} ${dragging ? styles.dragging : ""} ${dieStateClasses(die)} ${className}`.trim()}
    draggable={Boolean(draggable && settled)}
    data-settled={settled ? "true" : "false"}
    data-dragging={dragging ? "true" : "false"}
    onClick={onClick || undefined}
    onDragStart={onDragStart || undefined}
    onDragEnd={onDragEnd || undefined}
    aria-label={ariaLabel || die.label}
  >
    {showShadow ? <span className={styles.shadow} aria-hidden="true" /> : null}
    <div className={styles.cube} aria-hidden="true">
      {FACE_NAMES.map((face) => <span key={face} className={`${styles.face} ${styles[`face_${face}`]}`}><b>{die.result}</b></span>)}
    </div>
    {renderTooltip?.(die, styles.detail)}
  </button>;
});

function ReducedMotionLayout({ dice, renderTooltip, onDieClick, onDieDragStart }) {
  return <div className={styles.reduced} aria-label="Settled dice results">
    {dice.map((die) => <ResultCubeDie
      key={die.id}
      die={die}
      settled
      staticPlacement
      onClick={(event) => onDieClick?.(die, event)}
      onDragStart={(event) => onDieDragStart?.(die, event)}
      renderTooltip={renderTooltip}
    />)}
  </div>;
}

export default function RealisticDiceTray({
  dice: diceInput = [],
  rollKey = 0,
  className = "",
  ariaLabel = "Realistic dice tray",
  renderTooltip = null,
  onDieClick = null,
  onDieDragStart = null,
  onTrayDrop = null,
  onSettled = null,
  hiddenDieIds = [],
  dieSize = 44,
}) {
  const sourceDice = Array.isArray(diceInput) ? diceInput : [];
  const diceSignature = JSON.stringify(sourceDice.map((die) => [die?.id, die?.type, die?.result, die?.accent, die?.label, die?.detail]));
  const physicsSignature = JSON.stringify(sourceDice.map((die) => [die?.id, die?.type, die?.result, die?.accent]));
  const dice = useMemo(() => normalizeVisualDice(diceInput), [diceSignature]);
  const hiddenSignature = JSON.stringify(Array.from(new Set((hiddenDieIds || []).map(String))).sort());
  const hiddenIds = useMemo(() => new Set((hiddenDieIds || []).map(String)), [hiddenSignature]);
  const visibleDice = dice.filter((die) => !hiddenIds.has(die.id));
  const surfaceRef = useRef(null);
  const dieRefs = useRef(new Map());
  const bumperRefs = useRef([]);
  const simulationRef = useRef(null);
  const simulationKeyRef = useRef("");
  const renderStatesRef = useRef(new Map());
  const settledIdsRef = useRef(new Set());
  const frameRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const dragStateRef = useRef({ dieId: "", offsetX: 0, offsetY: 0 });
  const [settledIds, setSettledIds] = useState(() => new Set());
  const [draggingDieId, setDraggingDieId] = useState("");
  const reducedMotion = prefersReducedMotion();
  const simulationKey = `${rollKey}|${physicsSignature}|${dieSize}`;

  function attachDieRef(dieId, node) {
    if (!node) {
      dieRefs.current.delete(dieId);
      return;
    }
    dieRefs.current.set(dieId, node);
    const body = simulationRef.current?.bodies?.find((entry) => entry.id === dieId);
    const renderState = renderStatesRef.current.get(dieId);
    if (body) setDieTransform(node, renderState || body);
  }

  function renderBodyImmediately(body) {
    if (!body) return;
    const state = createRenderState(body);
    renderStatesRef.current.set(body.id, state);
    setDieTransform(dieRefs.current.get(body.id), state);
  }

  function beginManualDrag(die, event) {
    const simulation = simulationRef.current;
    const surface = surfaceRef.current;
    const body = beginDiceBodyDrag(simulation, die.id);
    if (!body || !surface) return false;
    const surfaceRect = surface.getBoundingClientRect();
    const dieRect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      dieId: die.id,
      offsetX: event.clientX - surfaceRect.left - body.x,
      offsetY: event.clientY - surfaceRect.top - body.y,
    };
    event.dataTransfer?.setDragImage(
      event.currentTarget,
      Math.max(0, Math.min(dieRect.width, event.clientX - dieRect.left)),
      Math.max(0, Math.min(dieRect.height, event.clientY - dieRect.top)),
    );
    setDraggingDieId(die.id);
    renderBodyImmediately(body);
    return true;
  }

  function moveManualDrag(event) {
    const drag = dragStateRef.current;
    const surface = surfaceRef.current;
    if (!drag.dieId || !surface || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect = surface.getBoundingClientRect();
    const body = moveDiceBodyDrag(
      simulationRef.current,
      drag.dieId,
      event.clientX - rect.left - drag.offsetX,
      event.clientY - rect.top - drag.offsetY,
    );
    renderBodyImmediately(body);
    return body;
  }

  function endManualDrag() {
    const dieId = dragStateRef.current.dieId;
    if (!dieId) return null;
    const body = endDiceBodyDrag(simulationRef.current, dieId);
    renderBodyImmediately(body);
    dragStateRef.current = { dieId: "", offsetX: 0, offsetY: 0 };
    setDraggingDieId("");
    return body;
  }

  useEffect(() => {
    if (reducedMotion || !surfaceRef.current || !dice.length) return undefined;
    const surface = surfaceRef.current;
    const rect = surface.getBoundingClientRect();
    const width = Math.max(240, rect.width);
    const height = Math.max(170, rect.height);
    const visualSeed = createDiceVisualSeed(`roll-${rollKey}`);
    const simulation = createDiceSimulation({ dice, width, height, seed: visualSeed, dieSize });
    setDiceSimulationActiveIds(simulation, visibleDice.map((die) => die.id));
    simulationRef.current = simulation;
    simulationKeyRef.current = simulationKey;
    renderStatesRef.current = new Map(simulation.bodies.map((body) => [body.id, createRenderState(body)]));
    settledIdsRef.current = new Set();
    setSettledIds(new Set());
    dragStateRef.current = { dieId: "", offsetX: 0, offsetY: 0 };
    setDraggingDieId("");
    surface.style.setProperty("--tray-wall-inset", `${simulation.wallInset}px`);
    syncBumperElements(simulation, bumperRefs.current);

    for (const body of simulation.bodies) {
      setDieTransform(dieRefs.current.get(body.id), renderStatesRef.current.get(body.id));
    }

    let lastTime = performance.now();
    const animate = (now) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      stepDiceSimulation(simulation, delta);

      let allVisualSettled = true;
      const nextSettledIds = new Set();
      for (const body of simulation.bodies) {
        const previous = renderStatesRef.current.get(body.id);
        const renderState = smoothDieState(previous, body, delta);
        renderStatesRef.current.set(body.id, renderState);
        setDieTransform(dieRefs.current.get(body.id), renderState);

        if (body.active === false) continue;
        const visuallySettled = isVisuallyFaceFlat(renderState, body);
        if (visuallySettled) nextSettledIds.add(body.id);
        else allVisualSettled = false;
      }

      const currentSettled = settledIdsRef.current;
      const changed = nextSettledIds.size !== currentSettled.size
        || [...nextSettledIds].some((id) => !currentSettled.has(id));
      if (changed) {
        settledIdsRef.current = nextSettledIds;
        setSettledIds(nextSettledIds);
      }

      if (simulation.complete && allVisualSettled) {
        frameRef.current = null;
        onSettled?.({ seed: simulation.seed, bodies: simulation.bodies.map((body) => ({ ...body })) });
        return;
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      const next = surface.getBoundingClientRect();
      resizeDiceSimulation(simulation, Math.max(240, next.width), Math.max(170, next.height));
      syncBumperElements(simulation, bumperRefs.current);
      simulation.bodies.forEach((body) => renderBodyImmediately(body));
    }) : null;
    resizeObserver?.observe(surface);
    resizeObserverRef.current = resizeObserver;

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      resizeObserver?.disconnect();
      resizeObserverRef.current = null;
      simulationRef.current = null;
      renderStatesRef.current = new Map();
      dragStateRef.current = { dieId: "", offsetX: 0, offsetY: 0 };
    };
  }, [physicsSignature, dieSize, reducedMotion, rollKey, onSettled, simulationKey]);

  useEffect(() => {
    if (reducedMotion || !simulationRef.current) return;
    setDiceSimulationActiveIds(simulationRef.current, visibleDice.map((die) => die.id));
  }, [hiddenSignature, reducedMotion]);

  if (!dice.length) return null;

  return <div className={`${styles.tray} ${className}`.trim()} aria-label={ariaLabel}>
    <div
      ref={surfaceRef}
      className={styles.surface}
      onDragOver={(event) => {
        const hasForgeRoll = Array.from(event.dataTransfer?.types || []).includes("text/npc-forge-roll");
        if (!dragStateRef.current.dieId && !(onTrayDrop && hasForgeRoll)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        moveManualDrag(event);
      }}
      onDrop={(event) => {
        const rollId = event.dataTransfer?.getData("text/npc-forge-roll");
        if (!dragStateRef.current.dieId && !(onTrayDrop && rollId)) return;
        event.preventDefault();
        moveManualDrag(event);
        endManualDrag();
        if (rollId) onTrayDrop?.(event);
      }}
    >
      <TrayArtwork />
      <div ref={(node) => { bumperRefs.current[0] = node; }} className={`${styles.bumper} ${styles.bumper_one}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[1] = node; }} className={`${styles.bumper} ${styles.bumper_two}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[2] = node; }} className={`${styles.bumper} ${styles.bumper_three}`} aria-hidden="true" />
      {reducedMotion ? <ReducedMotionLayout dice={visibleDice} renderTooltip={renderTooltip} onDieClick={onDieClick} onDieDragStart={onDieDragStart} /> : visibleDice.map((die) => {
        const settled = simulationKeyRef.current === simulationKey && settledIds.has(die.id);
        return <ResultCubeDie
          key={die.id}
          ref={(node) => attachDieRef(die.id, node)}
          die={die}
          settled={settled}
          dragging={draggingDieId === die.id}
          onClick={(event) => {
            if (!settled) return;
            onDieClick?.(die, event);
          }}
          onDragStart={(event) => {
            if (!settled) {
              event.preventDefault();
              return;
            }
            onDieDragStart?.(die, event);
            beginManualDrag(die, event);
          }}
          onDragEnd={endManualDrag}
          renderTooltip={renderTooltip}
        />;
      })}
    </div>
  </div>;
}
