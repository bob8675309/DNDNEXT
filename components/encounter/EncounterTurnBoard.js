import { useMemo } from "react";
import { axialToPixel, hexDistance, hexKey, hexPolygonPoints, makeHexDisk } from "../../utils/encounterHex";

function teamClass(team) {
  if (team === "players") return "player";
  if (team === "allies") return "ally";
  if (team === "enemies") return "enemy";
  return "neutral";
}

export default function EncounterTurnBoard({
  radius = 6,
  hexSize = 38,
  terrainOverrides = [],
  objects = [],
  participants = [],
  activeParticipantId = null,
  path = [],
  targetingLine = [],
  targetingBlockedHex = null,
  selectedAreaOrigin = null,
  areaRadiusHex = 0,
  selectedAreaHexes = [],
  onHexClick,
}) {
  const cells = useMemo(() => makeHexDisk(radius), [radius]);
  const pad = hexSize * 2.3;
  const overrideMap = useMemo(() => new Map((terrainOverrides || []).map((row) => [hexKey(row.q, row.r), row])), [terrainOverrides]);
  const blockingKeys = useMemo(() => new Set((objects || []).filter((row) => row.blocks_movement).map((row) => hexKey(row.q, row.r))), [objects]);
  const pathIndex = useMemo(() => new Map((path || []).map((row, index) => [hexKey(row.q, row.r), index + 1])), [path]);
  const targetingKeys = useMemo(() => new Set((targetingLine || []).slice(1).map((row) => hexKey(row.q, row.r))), [targetingLine]);
  const blockedTargetingKey = targetingBlockedHex ? hexKey(targetingBlockedHex.q, targetingBlockedHex.r) : "";
  const selectedAreaOriginKey = selectedAreaOrigin ? hexKey(selectedAreaOrigin.q, selectedAreaOrigin.r) : "";
  const selectedAreaKeys = useMemo(() => {
    if (!selectedAreaOrigin || Number(areaRadiusHex) < 0) return new Set();
    return new Set(cells
      .filter((hex) => hexDistance(hex, selectedAreaOrigin) <= Number(areaRadiusHex))
      .map((hex) => hexKey(hex.q, hex.r)));
  }, [areaRadiusHex, cells, selectedAreaOrigin]);
  const explicitSelectedAreaKeys = useMemo(
    () => new Set((selectedAreaHexes || []).map((hex) => hexKey(hex.q, hex.r))),
    [selectedAreaHexes]
  );
  const projected = useMemo(() => {
    const rows = cells.map((hex) => ({ ...hex, ...axialToPixel(hex, hexSize) }));
    const xs = rows.map((row) => row.x); const ys = rows.map((row) => row.y);
    return { rows, minX: Math.min(...xs)-pad, maxX: Math.max(...xs)+pad, minY: Math.min(...ys)-pad, maxY: Math.max(...ys)+pad };
  }, [cells, hexSize, pad]);

  return (
    <div className="turn-board-shell">
      <svg className="turn-board" viewBox={`${projected.minX} ${projected.minY} ${projected.maxX-projected.minX} ${projected.maxY-projected.minY}`} role="img" aria-label="Authoritative tactical encounter board">
        <rect x={projected.minX} y={projected.minY} width={projected.maxX-projected.minX} height={projected.maxY-projected.minY} rx="18" className="board-bg" />
        {projected.rows.map((hex) => {
          const key = hexKey(hex.q, hex.r);
          const terrain = blockingKeys.has(key) ? "blocked" : (overrideMap.get(key)?.terrain_type || "normal");
          const step = pathIndex.get(key) || null;
          const isTargeting = targetingKeys.has(key);
          const isTargetingBlocker = blockedTargetingKey === key;
          const isSelectedArea = selectedAreaKeys.has(key) || explicitSelectedAreaKeys.has(key);
          const isSelectedAreaOrigin = selectedAreaOriginKey === key;
          return (
            <g key={key} transform={`translate(${hex.x} ${hex.y})`} onClick={() => onHexClick?.({ q: hex.q, r: hex.r })}>
              <polygon points={hexPolygonPoints(0,0,hexSize-1)} className={`hex hex--${terrain} ${step ? "is-path" : ""} ${isTargeting ? "is-targeting" : ""} ${isTargetingBlocker ? "is-los-blocker" : ""} ${isSelectedArea ? "is-selected-area" : ""} ${isSelectedAreaOrigin ? "is-selected-area-origin" : ""}`} />
              <text textAnchor="middle" y="4" className="coord">{step || `${hex.q},${hex.r}`}</text>
            </g>
          );
        })}
        {(participants || []).map((participant) => {
          const point = axialToPixel({ q:Number(participant.q||0), r:Number(participant.r||0) }, hexSize);
          const active = String(participant.id) === String(activeParticipantId || "");
          const initials = String(participant.display_name || "?").trim().split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase();
          return (
            <g key={participant.id} transform={`translate(${point.x} ${point.y})`} className={`participant participant--${teamClass(participant.team)} ${active ? "is-active" : ""}`}>
              <circle r={hexSize*.46} className="token" />
              <text textAnchor="middle" y="4" className="token-label">{initials}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span>Numbered hexes are proposed movement.</span><span>Outlined hexes show the server targeting line; red marks the LOS blocker.</span>{selectedAreaOrigin || explicitSelectedAreaKeys.size ? <span>Green hexes preview the selected tactical area{selectedAreaOrigin ? "; the bright outline marks its origin." : "."}</span> : null}</div>
      <style jsx>{`
        .turn-board-shell{display:grid;gap:10px}.turn-board{width:100%;height:72vh;min-height:560px;border:1px solid rgba(216,181,112,.24);border-radius:14px;background:#111615}.board-bg{fill:#151a17}.hex{fill:#2d3931;stroke:rgba(234,221,195,.2);stroke-width:1.2;cursor:pointer}.hex--difficult{fill:#5b4d31}.hex--blocked{fill:#3b2929;stroke:rgba(240,145,135,.44)}.hex.is-path{fill:#65458c;stroke:#e0bdff;stroke-width:2.6}.hex.is-targeting{stroke:#86c9ff;stroke-width:2.4}.hex.is-los-blocker{fill:#623535;stroke:#ff8e85;stroke-width:3.2}.hex.is-selected-area{fill:#315b49;stroke:#86ddb0;stroke-width:2.2}.hex.is-selected-area-origin{fill:#3d755b;stroke:#c3ffdc;stroke-width:4}.coord{fill:rgba(255,255,255,.34);font-size:7px;font-weight:700;pointer-events:none}.participant{pointer-events:none}.token{stroke-width:2.2}.participant--player .token{fill:#285c75;stroke:#96e2ff}.participant--ally .token{fill:#346347;stroke:#9de5b6}.participant--enemy .token{fill:#733c37;stroke:#ffaaa0}.participant--neutral .token{fill:#665c3e;stroke:#ead48d}.participant.is-active .token{stroke:#fff1a6;stroke-width:4.5}.token-label{fill:white;font-weight:900;font-size:10px}.legend{display:flex;gap:18px;flex-wrap:wrap;color:rgba(255,255,255,.62);font-size:.72rem}@media(max-width:720px){.turn-board{height:60vh;min-height:430px}}
      `}</style>
    </div>
  );
}
