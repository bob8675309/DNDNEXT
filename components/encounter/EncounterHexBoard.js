import { useMemo } from "react";
import {
  axialToPixel,
  feetToHexes,
  hexDistance,
  hexKey,
  hexPolygonPoints,
  hexesToFeet,
  makeHexDisk,
} from "../../utils/encounterHex";

const TERRAIN = Object.freeze({
  normal: { label: "Open", cost: 1 },
  difficult: { label: "Difficult", cost: 2 },
  blocked: { label: "Blocked", cost: Infinity },
});

const DEMO_DIFFICULT = new Set(["-1:0", "0:-1", "1:-1", "2:-2", "-2:1", "1:1"]);
const DEMO_BLOCKED = new Set(["0:2", "-1:2", "2:0"]);

function terrainFor(hex, overrideMap, blockingObjectKeys, demoTerrain) {
  const key = hexKey(hex.q, hex.r);
  const override = overrideMap.get(key);
  if (override?.terrain_type) return override.terrain_type;
  if (blockingObjectKeys.has(key)) return "blocked";
  if (demoTerrain) {
    if (DEMO_BLOCKED.has(key)) return "blocked";
    if (DEMO_DIFFICULT.has(key)) return "difficult";
  }
  return "normal";
}

function objectGlyph(objectType) {
  const type = String(objectType || "").toLowerCase();
  if (type.includes("door")) return "D";
  if (type.includes("wall")) return "W";
  if (type.includes("spawn")) return "S";
  if (type.includes("objective")) return "O";
  if (type.includes("trap")) return "T";
  if (type.includes("chest")) return "C";
  if (type.includes("hazard")) return "H";
  return "•";
}

export default function EncounterHexBoard({
  radius = 5,
  hexSize = 38,
  selected = { q: 0, r: 0 },
  onSelect,
  moveSpeedFeet = 30,
  terrainOverrides = [],
  objects = [],
  demoTerrain = true,
  showPrototypeTokens = true,
}) {
  const cells = useMemo(() => makeHexDisk(radius), [radius]);
  const center = useMemo(() => ({ q: 0, r: 0 }), []);
  const moveHexes = feetToHexes(moveSpeedFeet);
  const pad = hexSize * 2.2;

  const overrideMap = useMemo(() => {
    const map = new Map();
    for (const row of terrainOverrides || []) map.set(hexKey(row.q, row.r), row);
    return map;
  }, [terrainOverrides]);

  const objectsByKey = useMemo(() => {
    const map = new Map();
    for (const row of objects || []) {
      const key = hexKey(row.q, row.r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return map;
  }, [objects]);

  const blockingObjectKeys = useMemo(() => {
    const keys = new Set();
    for (const [key, rows] of objectsByKey.entries()) {
      if (rows.some((row) => row.blocks_movement)) keys.add(key);
    }
    return keys;
  }, [objectsByKey]);

  const projected = useMemo(() => {
    const rows = cells.map((hex) => {
      const p = axialToPixel(hex, hexSize);
      return { ...hex, ...p, terrain: terrainFor(hex, overrideMap, blockingObjectKeys, demoTerrain) };
    });
    const xs = rows.map((h) => h.x);
    const ys = rows.map((h) => h.y);
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return { rows, minX, maxX, minY, maxY };
  }, [cells, hexSize, pad, overrideMap, blockingObjectKeys, demoTerrain]);

  return (
    <div className="encounter-board-shell">
      <div className="encounter-board-status">
        <div><strong>{moveSpeedFeet} ft.</strong><span>Speed</span></div>
        <div><strong>{moveHexes}</strong><span>5-ft hexes</span></div>
        <div><strong>{hexesToFeet(hexDistance(center, selected))} ft.</strong><span>Selected distance</span></div>
        <div><strong>{terrainOverrides?.length || 0}</strong><span>Terrain overrides</span></div>
        <div><strong>{objects?.length || 0}</strong><span>Map objects</span></div>
      </div>

      <div className="encounter-board-viewport">
        <svg
          className="encounter-board-svg"
          viewBox={`${projected.minX} ${projected.minY} ${projected.maxX - projected.minX} ${projected.maxY - projected.minY}`}
          role="img"
          aria-label="Tactical encounter hex board"
        >
          <defs>
            <radialGradient id="encounter-floor" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#394337" />
              <stop offset="100%" stopColor="#171b19" />
            </radialGradient>
            <filter id="encounter-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity="0.55" />
            </filter>
          </defs>

          <rect x={projected.minX} y={projected.minY} width={projected.maxX - projected.minX} height={projected.maxY - projected.minY} fill="url(#encounter-floor)" rx="18" />

          {projected.rows.map((hex) => {
            const distance = hexDistance(center, hex);
            const selectedHere = hex.q === selected.q && hex.r === selected.r;
            const reachable = distance <= moveHexes && hex.terrain !== "blocked";
            const hexObjects = objectsByKey.get(hexKey(hex.q, hex.r)) || [];
            return (
              <g
                key={hexKey(hex.q, hex.r)}
                transform={`translate(${hex.x} ${hex.y})`}
                onClick={() => onSelect?.({ q: hex.q, r: hex.r })}
                style={{ cursor: "pointer" }}
              >
                <polygon
                  points={hexPolygonPoints(0, 0, hexSize - 1)}
                  className={`encounter-hex encounter-hex--${hex.terrain} ${reachable ? "is-reachable" : ""} ${selectedHere ? "is-selected" : ""}`}
                />
                <text className="encounter-hex-coord" textAnchor="middle" y="4">{hex.q},{hex.r}</text>
                {hexObjects.slice(0, 2).map((object, index) => (
                  <g key={object.id || `${object.object_type}-${index}`} transform={`translate(${index ? 12 : -12} -12)`}>
                    <circle r="8" className={`encounter-object ${object.blocks_movement ? "is-blocking" : ""}`} />
                    <text className="encounter-object-label" textAnchor="middle" y="3">{objectGlyph(object.object_type)}</text>
                  </g>
                ))}
              </g>
            );
          })}

          {showPrototypeTokens ? (
            <>
              <g transform="translate(0 0)" filter="url(#encounter-shadow)">
                <circle r={hexSize * 0.48} className="encounter-token encounter-token--hero" />
                <text className="encounter-token-label" textAnchor="middle" y="4">PC</text>
              </g>
              <g transform={`translate(${axialToPixel({ q: 3, r: -2 }, hexSize).x} ${axialToPixel({ q: 3, r: -2 }, hexSize).y})`} filter="url(#encounter-shadow)">
                <circle r={hexSize * 0.48} className="encounter-token encounter-token--enemy" />
                <text className="encounter-token-label" textAnchor="middle" y="4">EN</text>
              </g>
            </>
          ) : null}
        </svg>
      </div>

      <div className="encounter-board-legend">
        {Object.entries(TERRAIN).map(([key, value]) => <span key={key}><i className={`terrain-swatch terrain-swatch--${key}`} />{value.label}{Number.isFinite(value.cost) ? ` ×${value.cost}` : ""}</span>)}
        <span><i className="object-swatch" />Map object</span>
        <span className="ms-auto">Encounter-local board state only — world movement is not called here.</span>
      </div>

      <style jsx>{`
        .encounter-board-shell{display:grid;gap:12px}.encounter-board-status{display:flex;gap:10px;flex-wrap:wrap}.encounter-board-status>div{min-width:112px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(5,8,9,.66);padding:8px 11px;display:grid}.encounter-board-status strong{font-size:1rem;color:#f1e2bb}.encounter-board-status span{font-size:.68rem;color:rgba(255,255,255,.56);text-transform:uppercase;letter-spacing:.08em}.encounter-board-viewport{border:1px solid rgba(216,181,112,.24);border-radius:14px;overflow:hidden;background:#121615;min-height:540px}.encounter-board-svg{display:block;width:100%;height:68vh;min-height:540px}.encounter-board-svg :global(.encounter-hex){fill:rgba(44,54,46,.82);stroke:rgba(224,213,185,.2);stroke-width:1.2;transition:fill .12s ease,stroke .12s ease}.encounter-board-svg :global(.encounter-hex.is-reachable){fill:rgba(53,80,61,.9);stroke:rgba(155,224,170,.42)}.encounter-board-svg :global(.encounter-hex--difficult){fill:rgba(85,70,42,.92)}.encounter-board-svg :global(.encounter-hex--blocked){fill:rgba(49,37,37,.95);stroke:rgba(191,102,94,.34)}.encounter-board-svg :global(.encounter-hex.is-selected){fill:rgba(93,64,130,.96);stroke:#d2a7ff;stroke-width:2.6}.encounter-board-svg :global(.encounter-hex-coord){fill:rgba(255,255,255,.3);font-size:7px;pointer-events:none}.encounter-board-svg :global(.encounter-token){stroke-width:2.4}.encounter-board-svg :global(.encounter-token--hero){fill:#315c73;stroke:#9ee1ff}.encounter-board-svg :global(.encounter-token--enemy){fill:#6a3330;stroke:#f2a09a}.encounter-board-svg :global(.encounter-token-label){fill:#fff;font-size:10px;font-weight:800;pointer-events:none}.encounter-board-svg :global(.encounter-object){fill:#46395b;stroke:#d0aeff;stroke-width:1.4}.encounter-board-svg :global(.encounter-object.is-blocking){fill:#5a342f;stroke:#f0a39b}.encounter-board-svg :global(.encounter-object-label){fill:white;font-size:8px;font-weight:900;pointer-events:none}.encounter-board-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:.72rem;color:rgba(255,255,255,.62)}.encounter-board-legend span{display:flex;gap:5px;align-items:center}.terrain-swatch,.object-swatch{width:12px;height:12px;border-radius:3px;border:1px solid rgba(255,255,255,.2)}.terrain-swatch--normal{background:#354c3b}.terrain-swatch--difficult{background:#55462a}.terrain-swatch--blocked{background:#312525}.object-swatch{background:#46395b;border-color:#d0aeff}@media(max-width:700px){.encounter-board-svg{height:58vh;min-height:430px}.encounter-board-legend .ms-auto{margin-left:0!important;width:100%}}
      `}</style>
    </div>
  );
}
