import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

const STORAGE_KEY = "dndnext.tactical.core-action-guides.v1";
const GUIDES = {
  dash: {
    title: "Dash",
    description: "Gain extra movement equal to your Speed for this turn.",
    note: "Dash does not prevent Opportunity Attacks. Use Disengage for that.",
    cost: "This consumes your Action.",
  },
  disengage: {
    title: "Disengage",
    description: "Your movement does not provoke Opportunity Attacks for the rest of this turn.",
    note: "Use this when you need to leave a hostile creature's reach safely.",
    cost: "This consumes your Action.",
  },
  dodge: {
    title: "Dodge",
    description: "Take a defensive posture; qualifying attack rolls against you have Disadvantage in the tactical encounter engine.",
    note: "Dodge does not grant extra movement and does not suppress Opportunity Attacks.",
    cost: "This consumes your Action.",
  },
};

function readPreferences() {
  if (typeof window === "undefined") return { enabled: true, seen: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: true, seen: [] };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      seen: Array.isArray(parsed?.seen) ? parsed.seen.filter((key) => GUIDES[key]) : [],
    };
  } catch {
    return { enabled: true, seen: [] };
  }
}

function writePreferences(enabled, seen) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, seen }));
  } catch {
    // Browser-local guidance is optional and must never block combat.
  }
}

function actionFromButton(button) {
  if (!button?.closest?.(".action-grid")) return "";
  const text = String(button.textContent || "").trim().toLowerCase();
  return GUIDES[text] ? text : "";
}

export default function TacticalCoreActionGuide() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [seen, setSeen] = useState([]);
  const [pending, setPending] = useState("");
  const [disableAll, setDisableAll] = useState(false);
  const pendingButtonRef = useRef(null);
  const bypassButtonRef = useRef(null);

  useEffect(() => {
    const prefs = readPreferences();
    setEnabled(prefs.enabled);
    setSeen(prefs.seen);
  }, []);

  useEffect(() => {
    if (router.pathname !== "/encounters/combat") {
      setPending("");
      pendingButtonRef.current = null;
      return undefined;
    }

    function onClick(event) {
      const button = event.target?.closest?.("button");
      if (!button || button.disabled) return;
      const action = actionFromButton(button);
      if (!action) return;
      if (bypassButtonRef.current === button) {
        bypassButtonRef.current = null;
        return;
      }
      if (!enabled || seen.includes(action)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      pendingButtonRef.current = button;
      setDisableAll(false);
      setPending(action);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, router.pathname, seen]);

  function close() {
    setPending("");
    setDisableAll(false);
    pendingButtonRef.current = null;
  }

  function confirm() {
    const action = pending;
    const button = pendingButtonRef.current;
    if (!action || !button || button.disabled) {
      close();
      return;
    }

    const nextSeen = seen.includes(action) ? seen : [...seen, action];
    const nextEnabled = disableAll ? false : enabled;
    setSeen(nextSeen);
    setEnabled(nextEnabled);
    writePreferences(nextEnabled, nextSeen);
    setPending("");
    setDisableAll(false);
    pendingButtonRef.current = null;

    bypassButtonRef.current = button;
    button.click();
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    writePreferences(next, seen);
  }

  function reset() {
    setEnabled(true);
    setSeen([]);
    setPending("");
    setDisableAll(false);
    pendingButtonRef.current = null;
    writePreferences(true, []);
  }

  if (router.pathname !== "/encounters/combat") return null;
  const guide = GUIDES[pending];

  return (
    <>
      <div className="tactical-ability-tip-controls" aria-label="Ability tip settings">
        <button type="button" onClick={toggleEnabled}>{enabled ? "Ability Tips: On" : "Ability Tips: Off"}</button>
        <button type="button" onClick={reset}>Reset Tips</button>
      </div>
      {guide ? <div className="tactical-ability-tip-backdrop" role="presentation">
        <section className="tactical-ability-tip-modal" role="dialog" aria-modal="true" aria-labelledby="tactical-ability-tip-title">
          <div className="tactical-ability-tip-kicker">FIRST USE • CORE ACTION</div>
          <h2 id="tactical-ability-tip-title">{guide.title}</h2>
          <div className="tactical-ability-tip-cost">{guide.cost}</div>
          <p>{guide.description}</p>
          <p className="tactical-ability-tip-note">{guide.note}</p>
          <label className="tactical-ability-tip-disable">
            <input type="checkbox" checked={disableAll} onChange={(event) => setDisableAll(event.target.checked)} />
            Don&apos;t show ability tips again
          </label>
          <div className="tactical-ability-tip-actions">
            <button type="button" onClick={close}>Cancel</button>
            <button type="button" className="confirm" onClick={confirm}>Use {guide.title}</button>
          </div>
        </section>
      </div> : null}
      <style jsx>{`
        .tactical-ability-tip-controls{position:fixed;right:18px;bottom:42px;z-index:1200;display:flex;gap:6px;padding:6px;border:1px solid rgba(208,174,255,.2);border-radius:10px;background:rgba(10,12,14,.9);box-shadow:0 10px 34px rgba(0,0,0,.28)}
        .tactical-ability-tip-controls button{border:1px solid rgba(208,174,255,.24);border-radius:7px;padding:6px 8px;background:rgba(118,76,153,.18);color:#eadbff;font-size:.68rem}
        .tactical-ability-tip-backdrop{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;padding:18px;background:rgba(4,5,7,.76);backdrop-filter:blur(3px)}
        .tactical-ability-tip-modal{width:min(520px,100%);border:1px solid rgba(208,174,255,.34);border-radius:14px;padding:20px;background:#101316;color:#f3f0e8;box-shadow:0 24px 80px rgba(0,0,0,.55)}
        .tactical-ability-tip-kicker{font-size:.65rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}
        .tactical-ability-tip-modal h2{margin:6px 0 10px;font-size:1.35rem}
        .tactical-ability-tip-modal p{margin:8px 0;color:rgba(255,255,255,.72);line-height:1.5}
        .tactical-ability-tip-cost{margin:12px 0 6px;padding:9px 10px;border-radius:8px;border:1px solid rgba(242,186,112,.28);background:rgba(135,91,43,.18);color:#f2d3a0;font-weight:800;font-size:.78rem}
        .tactical-ability-tip-note{color:#d9c2ff!important}
        .tactical-ability-tip-disable{display:flex;gap:8px;align-items:center;margin-top:14px;font-size:.75rem;color:rgba(255,255,255,.72)}
        .tactical-ability-tip-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
        .tactical-ability-tip-actions button{border:1px solid rgba(208,174,255,.25);background:rgba(118,76,153,.18);color:#eadbff;border-radius:8px;padding:9px}
        .tactical-ability-tip-actions .confirm{border-color:rgba(120,220,163,.32);background:rgba(54,132,88,.2);color:#bce9cc}
        @media(max-width:650px){.tactical-ability-tip-controls{right:10px;bottom:38px;max-width:calc(100vw - 20px)}}
      `}</style>
    </>
  );
}
