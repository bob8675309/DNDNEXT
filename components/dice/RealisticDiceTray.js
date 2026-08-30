import { useEffect, useMemo, useRef, useState } from "react";
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
  const cube = element.querySelector(`.${styles.cube}`);
  if (cube) cube.style.transform = `rotateX(${body.rx}rad) rotateY(${body.ry}rad) rotateZ(${body.rz}rad)`;
}

function dieStateClasses(die) {
  return [
    die.detail?.selected ? styles.selected : "",
    die.detail?.assigned ? styles.assigned : "",
  ].filter(Boolean).join(" ");
}

function ReducedMotionLayout({ dice, renderTooltip, onDieClick, onDieDragStart }) {
  return <div className={styles.reduced} aria-label="Settled dice results">
    {dice.map((die) => <button
      key={die.id}
      type="button"
      className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${styles.settled} ${dieStateClasses(die)}`.trim()}
      draggable
      data-settled="true"
      onClick={(event) => onDieClick?.(die, event)}
      onDragStart={(event) => onDieDragStart?.(die, event)}
      aria-label={die.label}
    >
      <div className={styles.cube} aria-hidden="true">
        {FACE_NAMES.map((face) => <span key={face} className={`${styles.face} ${styles[`face_${face}`]}`}><b>{die.result}</b></span>)}
      </div>
      {renderTooltip?.(die, styles.detail)}
    </button>)}
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
  onSettled = null,
  dieSize = 44,
}) {
  const sourceDice = Array.isArray(diceInput) ? diceInput : [];
  const diceSignature = JSON.stringify(sourceDice.map((die) => [die?.id, die?.type, die?.result, die?.accent, die?.label, die?.detail]));
  const physicsSignature = JSON.stringify(sourceDice.map((die) => [die?.id, die?.type, die?.result, die?.accent]));
  const dice = useMemo(() => normalizeVisualDice(diceInput), [diceSignature]);
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
      if (nextSettledIds.size !== settledIdsRef.current.size) {
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
    <div ref={surfaceRef} className={styles.surface}>
      <div ref={(node) => { bumperRefs.current[0] = node; }} className={`${styles.bumper} ${styles.bumper_one}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[1] = node; }} className={`${styles.bumper} ${styles.bumper_two}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[2] = node; }} className={`${styles.bumper} ${styles.bumper_three}`} aria-hidden="true" />
      {reducedMotion ? <ReducedMotionLayout dice={dice} renderTooltip={renderTooltip} onDieClick={onDieClick} onDieDragStart={onDieDragStart} /> : dice.map((die) => {
        const settled = simulationKeyRef.current === simulationKey && settledIds.has(die.id);
        return <button
          key={die.id}
          ref={(node) => {
            if (node) dieRefs.current.set(die.id, node);
            else dieRefs.current.delete(die.id);
          }}
          type="button"
          className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${settled ? styles.settled : styles.rolling} ${dieStateClasses(die)}`.trim()}
          draggable={settled}
          data-settled={settled ? "true" : "false"}
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
          aria-label={die.label}
        >
          <span className={styles.shadow} aria-hidden="true" />
          <div className={styles.cube} aria-hidden="true">
            {FACE_NAMES.map((face) => <span key={face} className={`${styles.face} ${styles[`face_${face}`]}`}><b>{die.result}</b></span>)}
          </div>
          {renderTooltip?.(die, styles.detail)}
        </button>;
      })}
    </div>
  </div>;
}
