import { useMemo, useState } from "react";
import EncounterHexBoard from "../components/encounter/EncounterHexBoard";
import { feetToHexes, hexDistance, hexesToFeet } from "../utils/encounterHex";

const SPEED_OPTIONS = [20, 25, 30, 35, 40, 50, 60];

export default function EncountersPage() {
  const [selected, setSelected] = useState({ q: 0, r: 0 });
  const [speed, setSpeed] = useState(30);
  const distanceHexes = useMemo(() => hexDistance({ q: 0, r: 0 }, selected), [selected]);
  const reachable = distanceHexes <= feetToHexes(speed);

  return (
    <main className="encounter-page">
      <div className="encounter-page__frame">
        <header className="encounter-page__header">
          <div>
            <div className="encounter-kicker">TACTICAL ENCOUNTER SYSTEM • PHASE 1</div>
            <h1>Encounter Board</h1>
            <p>Separate hex-grid combat foundation. One hex represents 5 feet. This page does not call the existing world/town route or travel movement systems.</p>
          </div>
          <div className="encounter-phase-badge">Foundation</div>
        </header>

        <section className="encounter-page__layout">
          <aside className="encounter-sidebar">
            <div className="encounter-panel">
              <div className="encounter-panel__kicker">Movement sandbox</div>
              <h2>5e movement scale</h2>
              <label>
                <span>Creature Speed</span>
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                  {SPEED_OPTIONS.map((value) => <option key={value} value={value}>{value} ft.</option>)}
                </select>
              </label>
              <div className="encounter-readout"><span>Turn budget</span><strong>{feetToHexes(speed)} hexes</strong></div>
              <div className="encounter-readout"><span>Selected</span><strong>{selected.q}, {selected.r}</strong></div>
              <div className="encounter-readout"><span>Direct distance</span><strong>{hexesToFeet(distanceHexes)} ft.</strong></div>
              <div className={`encounter-validity ${reachable ? "is-valid" : "is-invalid"}`}>{reachable ? "Within base Speed" : "Requires Dash / additional movement"}</div>
              <button type="button" className="encounter-reset" onClick={() => setSelected({ q: 0, r: 0 })}>Return selection to origin</button>
            </div>

            <div className="encounter-panel">
              <div className="encounter-panel__kicker">Architecture boundary</div>
              <h2>Encounter-only state</h2>
              <ul>
                <li>Axial hex coordinates, not world pixels.</li>
                <li>5 ft. per base hex step.</li>
                <li>Terrain can modify movement cost.</li>
                <li>Blocked cells reject selection.</li>
                <li>World routes, camps, weather, and travel clocks remain separate.</li>
              </ul>
            </div>

            <div className="encounter-panel encounter-panel--next">
              <div className="encounter-panel__kicker">Next milestone</div>
              <h2>Authoritative encounter state</h2>
              <p>The next layer will persist encounter maps/sessions/tokens and validate movement server-side before Realtime broadcasts the accepted state.</p>
            </div>
          </aside>

          <section className="encounter-board-panel">
            <div className="encounter-board-panel__head">
              <div><span>Prototype dungeon chamber</span><strong>Axial hex renderer</strong></div>
              <div><span>Scale</span><strong>1 hex = 5 ft.</strong></div>
            </div>
            <EncounterHexBoard selected={selected} onSelect={setSelected} moveSpeedFeet={speed} />
          </section>
        </section>
      </div>

      <style jsx>{`
        .encounter-page{min-height:100vh;background:radial-gradient(circle at 70% 5%,rgba(80,61,101,.24),transparent 35%),linear-gradient(180deg,#080a0c,#111512 55%,#080a0b);color:#f3f0e8;padding:28px}.encounter-page__frame{max-width:1580px;margin:0 auto}.encounter-page__header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:20px;padding:20px 22px;border:1px solid rgba(190,151,89,.22);border-radius:14px;background:rgba(12,14,16,.86);box-shadow:0 18px 50px rgba(0,0,0,.32)}.encounter-page__header h1{font-size:2rem;margin:4px 0 5px}.encounter-page__header p{margin:0;max-width:900px;color:rgba(255,255,255,.62);line-height:1.55}.encounter-kicker,.encounter-panel__kicker{font-size:.66rem;letter-spacing:.12em;color:#c8aee5;font-weight:800}.encounter-phase-badge{border:1px solid rgba(143,222,195,.36);background:rgba(69,139,116,.13);color:#a8ead4;border-radius:999px;padding:7px 12px;font-size:.72rem;font-weight:700}.encounter-page__layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.encounter-sidebar{display:grid;align-content:start;gap:12px}.encounter-panel,.encounter-board-panel{border:1px solid rgba(255,255,255,.09);background:rgba(13,16,17,.91);border-radius:13px;box-shadow:0 15px 40px rgba(0,0,0,.25)}.encounter-panel{padding:16px}.encounter-panel h2{font-size:1.02rem;margin:4px 0 13px}.encounter-panel label{display:grid;gap:5px;color:rgba(255,255,255,.62);font-size:.72rem}.encounter-panel select{background:#090c0e;border:1px solid rgba(255,255,255,.14);color:#eee;border-radius:8px;padding:8px}.encounter-readout{display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);font-size:.76rem}.encounter-readout span{color:rgba(255,255,255,.55)}.encounter-validity{margin-top:12px;border-radius:8px;padding:8px 10px;font-size:.72rem}.encounter-validity.is-valid{border:1px solid rgba(98,198,142,.28);background:rgba(58,130,88,.15);color:#aee9c5}.encounter-validity.is-invalid{border:1px solid rgba(221,145,91,.28);background:rgba(145,83,46,.14);color:#f3c29f}.encounter-reset{margin-top:10px;width:100%;border:1px solid rgba(204,177,126,.24);background:rgba(193,151,77,.08);color:#e4d6bc;border-radius:8px;padding:7px;font-size:.72rem}.encounter-panel ul{margin:0;padding-left:18px;color:rgba(255,255,255,.63);font-size:.75rem;line-height:1.7}.encounter-panel--next p{margin:0;color:rgba(255,255,255,.58);font-size:.75rem;line-height:1.55}.encounter-board-panel{padding:14px;min-width:0}.encounter-board-panel__head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:3px 4px 12px}.encounter-board-panel__head>div{display:grid}.encounter-board-panel__head span{font-size:.65rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em}.encounter-board-panel__head strong{font-size:.86rem;color:#e9dfc8}@media(max-width:980px){.encounter-page{padding:14px}.encounter-page__layout{grid-template-columns:1fr}.encounter-sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}.encounter-panel--next{grid-column:1/-1}}@media(max-width:650px){.encounter-page__header{display:grid}.encounter-sidebar{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
