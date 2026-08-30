import { useEffect, useMemo, useRef } from "react";
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

function setSettledTransform(element, body) {
  if (!element || !body) return;
  element.style.left = `${body.x}px`;
  element.style.top = `${body.y}px`;
  const cube = element.querySelector(`.${styles.cube}`);
  if (cube) cube.style.transform = `rotateX(${body.rx}rad) rotateY(${body.ry}rad) rotateZ(${body.rz}rad)`;
  element.dataset.settled = body.settled ? "true" : "false";
  element.classList.toggle(styles.settled, body.settled);
  element.classList.toggle(styles.rolling, !body.settled);
}

function ReducedMotionLayout({ dice, renderTooltip, onDieClick, onDieDragStart }) {
  return <div className={styles.reduced} aria-label="Settled dice results">
    {dice.map((die) => <button
      key={die.id}
      type="button"
      className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${styles.settled}`}
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
  const frameRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (reducedMotion || !surfaceRef.current || !dice.length) return undefined;
    const surface = surfaceRef.current;
    const rect = surface.getBoundingClientRect();
    const width = Math.max(240, rect.width);
    const height = Math.max(170, rect.height);
    const visualSeed = createDiceVisualSeed(`roll-${rollKey}`);
    const simulation = createDiceSimulation({ dice, width, height, seed: visualSeed, dieSize });
    simulationRef.current = simulation;

    simulation.obstacles.forEach((obstacle, index) => {
      const bumper = bumperRefs.current[index];
      if (!bumper) return;
      bumper.style.left = `${obstacle.x}px`;
      bumper.style.top = `${obstacle.y}px`;
      bumper.style.width = `${obstacle.radius * 2}px`;
      bumper.style.marginLeft = `${-obstacle.radius}px`;
      bumper.style.marginTop = `${-obstacle.radius}px`;
    });

    for (const body of simulation.bodies) setSettledTransform(dieRefs.current.get(body.id), body);

    let lastTime = performance.now();
    const animate = (now) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      stepDiceSimulation(simulation, delta);
      for (const body of simulation.bodies) setSettledTransform(dieRefs.current.get(body.id), body);
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
  }, [physicsSignature, dieSize, reducedMotion, rollKey, onSettled]);

  if (!dice.length) return null;

  return <div className={`${styles.tray} ${className}`.trim()} aria-label={ariaLabel}>
    <div ref={surfaceRef} className={styles.surface}>
      <div ref={(node) => { bumperRefs.current[0] = node; }} className={`${styles.bumper} ${styles.bumper_one}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[1] = node; }} className={`${styles.bumper} ${styles.bumper_two}`} aria-hidden="true" />
      <div ref={(node) => { bumperRefs.current[2] = node; }} className={`${styles.bumper} ${styles.bumper_three}`} aria-hidden="true" />
      {reducedMotion ? <ReducedMotionLayout dice={dice} renderTooltip={renderTooltip} onDieClick={onDieClick} onDieDragStart={onDieDragStart} /> : dice.map((die) => <button
        key={die.id}
        ref={(node) => {
          if (node) dieRefs.current.set(die.id, node);
          else dieRefs.current.delete(die.id);
        }}
        type="button"
        className={`${styles.die} ${styles[`accent_${die.accent}`] || styles.accent_violet} ${styles.rolling}`}
        draggable
        data-settled="false"
        onClick={(event) => {
          if (event.currentTarget.dataset.settled !== "true") return;
          onDieClick?.(die, event);
        }}
        onDragStart={(event) => {
          if (event.currentTarget.dataset.settled !== "true") {
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
      </button>)}
    </div>
  </div>;
}
