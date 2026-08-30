import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import styles from "./RealisticDiceTray.module.css";
import { normalizeVisualDice } from "../../utils/dice/diceRollContract";
import { createDiceVisualSeed } from "../../utils/dice/diceVisualSeed";
import {
  createDiceSimulation,
  resizeDiceSimulation,
  stepDiceSimulation,
} from "../../utils/dice/physics/dicePhysicsEngine";

const FACE_NAMES = ["front", "back", "right", "left", "top", "bottom"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function setDieTransform(element, body) {
  if (!element || !body) return;
  element.style.left = `${body.x}px`;
  element.style.top = `${body.y}px`;
  element.style.zIndex = String(4 + Math.round(body.y / 52) + Math.round(body.z / 28));
  const cube = element.querySelector(`.${styles.cube}`);
  if (cube) cube.style.transform = `translate3d(0, ${-body.z}px, 0) rotateX(${body.rx}rad) rotateY(${body.ry}rad) rotateZ(${body.rz}rad)`;
  const shadow = element.querySelector(`.${styles.shadow}`);
  if (shadow) {
    const heightRatio = Math.min(1, Math.max(0, body.z / 120));
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

export const ResultCubeDie = forwardRef(function ResultCubeDie({
  die,
  settled = true,
  staticPlacement = false,
  className = "",
  draggable = settled,
  renderTooltip = null,
  onClick = null,
  onDragStart = null,
  showShadow = true,
  ariaLabel = null,
}, ref) {
  if (!die) return null;
  return <button
    ref={ref}
    type="button"
    className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${settled ? styles.settled : styles.rolling} ${staticPlacement ? styles.staticDie : ""} ${dieStateClasses(die)} ${className}`.trim()}
    draggable={Boolean(draggable && settled)}
    data-settled={settled ? "true" : "false"}
    onClick={onClick || undefined}
    onDragStart={onDragStart || undefined}
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
  const settledIdsRef = useRef(new Set());
  const frameRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [settledIds, setSettledIds] = useState(() => new Set());
  const reducedMotion = prefersReducedMotion();
  const simulationKey = `${rollKey}|${physicsSignature}|${dieSize}`;

  function attachDieRef(dieId, node) {
    if (!node) {
      dieRefs.current.delete(dieId);
      return;
    }
    dieRefs.current.set(dieId, node);
    const body = simulationRef.current?.bodies?.find((entry) => entry.id === dieId);
    if (body) setDieTransform(node, body);
  }

  useEffect(() => {
    if (reducedMotion || !surfaceRef.current || !dice.length) return undefined;
    const surface = surfaceRef.current;
    const rect = surface.getBoundingClientRect();
    const width = Math.max(240, rect.width);
    const height = Math.max(170, rect.height);
    const visualSeed = createDiceVisualSeed(`roll-${rollKey}`);
    const simulation = createDiceSimulation({ dice, width, height, seed: visualSeed, dieSize });
    simulationRef.current = simulation;
    simulationKeyRef.current = simulationKey;
    settledIdsRef.current = new Set();
    setSettledIds(new Set());
    surface.style.setProperty("--tray-wall-inset", `${simulation.wallInset}px`);

    simulation.obstacles.forEach((obstacle, index) => {
      const bumper = bumperRefs.current[index];
      if (!bumper) return;
      bumper.style.left = `${obstacle.x}px`;
      bumper.style.top = `${obstacle.y}px`;
      bumper.style.width = `${obstacle.radius * 2}px`;
      bumper.style.marginLeft = `${-obstacle.radius}px`;
      bumper.style.marginTop = `${-obstacle.radius}px`;
    });

    for (const body of simulation.bodies) setDieTransform(dieRefs.current.get(body.id), body);

    let lastTime = performance.now();
    const animate = (now) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      stepDiceSimulation(simulation, delta);
      for (const body of simulation.bodies) setDieTransform(dieRefs.current.get(body.id), body);

      const nextSettledIds = new Set(simulation.bodies.filter((body) => body.settled).map((body) => body.id));
      const currentSettled = settledIdsRef.current;
      const changed = nextSettledIds.size !== currentSettled.size
        || [...nextSettledIds].some((id) => !currentSettled.has(id));
      if (changed) {
        settledIdsRef.current = nextSettledIds;
        setSettledIds(nextSettledIds);
      }

      if (simulation.complete) {
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
    }) : null;
    resizeObserver?.observe(surface);
    resizeObserverRef.current = resizeObserver;

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      resizeObserver?.disconnect();
      resizeObserverRef.current = null;
      simulationRef.current = null;
    };
  }, [physicsSignature, dieSize, reducedMotion, rollKey, onSettled, simulationKey]);

  if (!dice.length) return null;

  return <div className={`${styles.tray} ${className}`.trim()} aria-label={ariaLabel}>
    <div
      ref={surfaceRef}
      className={styles.surface}
      onDragOver={onTrayDrop ? (event) => {
        if (event.dataTransfer?.types?.includes("text/npc-forge-roll")) event.preventDefault();
      } : undefined}
      onDrop={onTrayDrop ? (event) => {
        if (!event.dataTransfer?.getData("text/npc-forge-roll")) return;
        event.preventDefault();
        onTrayDrop(event);
      } : undefined}
    >
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
          }}
          renderTooltip={renderTooltip}
        />;
      })}
    </div>
  </div>;
}
