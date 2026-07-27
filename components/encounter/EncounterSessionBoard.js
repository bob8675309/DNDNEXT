import { useMemo } from "react";
import { axialToPixel, hexKey, hexPolygonPoints, makeHexDisk } from "../../utils/encounterHex";

function terrainFor(hex, overrideMap, blockingKeys) {
  const key = hexKey(hex.q, hex.r);
  if (blockingKeys.has(key)) return "blocked";
  return overrideMap.get(key)?.terrain_type || "normal";
}

function teamClass(team) {
  if (team === "players") return "player";
  if (team === "allies") return "ally";
  if (team === "enemies") return "enemy";
  return "neutral";
}

export default function EncounterSessionBoard({
  radius = 6,
  hexSize = 38,
  selected = { q: 0, r: 0 },
  onSelect,
  terrainOverrides = [],
  objects = [],
  participants = [],
  activeParticipantId = null,
}) {
  const cells = useMemo(() => makeHexDisk(radius), [radius]);
  const pad = hexSize * 2.3;
  const overrideMap = useMemo(() => new Map((terrainOverrides || []).map((row) => [hexKey(row.q, row.r), row])), [terrainOverrides]);
  const blockingKeys = useMemo(() => new Set((objects || []).filter((row) => row.blocks_movement).map((row) => hexKey(row.q, row.r))), [objects]);
  const projected = useMemo(() => {
    const rows = cells.map((hex) => ({ ...hex, ...axialToPixel(hex, hexSize), terrain: terrainFor(hex, overrideMap, blockingKeys) }));
    const xs = rows.map((row) => row.x);
    const ys = rows.map((row) => row.y);
    return {
      rows,
      minX: Math.min(...xs) - pad,
      maxX: Math.max(...xs) + pad,
      minY: Math.min(...ys) - pad,
      maxY: Math.max(...ys) + pad,
    };
  }, [cells, hexSize, pad, overrideMap, blockingKeys]);

  return (
    <div className="session-board-shell">
      <svg
        className="session-board"
        viewBox={`${projected.minX} ${projected.minY} ${projected.maxX - projected.minX} ${projected.maxY - projected.minY}`}
        role="img"
        aria-label="Live encounter staging board"
      >
        <rect x={projected.minX} y={projected.minY} width={projected.maxX - projected.minX} height={projected.maxY - projected.minY} rx="18" className="board-bg" />
        {projected.rows.map((hex) => {
          const isSelected = hex.q === selected.q && hex.r === selected.r;
          return (
            <g key={hexKey(hex.q, hex.r)} transform={`translate(${hex.x} ${hex.y})`} onClick={() => onSelect?.({ q: hex.q, r: hex.r })}>
              <polygon points={hexPolygonPoints(0, 0, hexSize - 1)} className={`hex hex--${hex.terrain} ${isSelected ? "is-selected" : ""}`} />
              <text textAnchor="middle" y="4" className="coord">{hex.q},{hex.r}</text>
            </g>
          );
        })}
        {(participants || []).map((participant) => {
          const p = axialToPixel({ q: Number(participant.q || 0), r: Number(participant.r || 0) }, hexSize);
          const active = String(participant.id) === String(activeParticipantId || "");
          const initials = String(participant.display_name || "?").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
          return (
            <g key={participant.id} transform={`translate(${p.x} ${p.y})`} className={`participant participant--${teamClass(participant.team)} ${active ? "is-active" : ""}`}>
              <circle r={hexSize * 0.46} className="token" />
              <text textAnchor="middle" y="4" className="token-label">{initials}</text>
              {participant.initiative != null ? <text textAnchor="middle" y={hexSize * .76} className="initiative">Init {participant.initiative}</text> : null}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="dot player" />Players</span><span><i className="dot ally" />Allies</span><span><i className="dot enemy" />Enemies</span><span><i className="dot neutral" />Neutral</span>
        <span className="note">Staging coordinates are encounter-local. No world position is changed.</span>
      </div>
      <style jsx>{`
        .session-board-shell{display:grid;gap:10px}.session-board{width:100%;height:68vh;min-height:540px;border:1px solid rgba(216,181,112,.24);border-radius:14px;background:#111615}.board-bg{fill:#151a17}.hex{fill:#2d3931;stroke:rgba(234,221,195,.2);stroke-width:1.2;cursor:pointer}.hex--difficult{fill:#5b4d31}.hex--blocked{fill:#3b2929;stroke:rgba(240,145,135,.4)}.hex.is-selected{fill:#65458c;stroke:#d4afff;stroke-width:2.6}.coord{fill:rgba(255,255,255,.27);font-size:7px;pointer-events:none}.participant{pointer-events:none}.token{stroke-width:2.2}.participant--player .token{fill:#285c75;stroke:#96e2ff}.participant--ally .token{fill:#346347;stroke:#9de5b6}.participant--enemy .token{fill:#733c37;stroke:#ffaaa0}.participant--neutral .token{fill:#665c3e;stroke:#ead48d}.participant.is-active .token{stroke:#fff1a6;stroke-width:4}.token-label{fill:white;font-weight:900;font-size:10px}.initiative{fill:#f3e8c8;font-size:7px;font-weight:800}.legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;color:rgba(255,255,255,.65);font-size:.72rem}.legend span{display:flex;align-items:center;gap:5px}.dot{width:11px;height:11px;border-radius:50%;display:inline-block}.dot.player{background:#285c75}.dot.ally{background:#346347}.dot.enemy{background:#733c37}.dot.neutral{background:#665c3e}.note{margin-left:auto}@media(max-width:720px){.session-board{height:58vh;min-height:430px}.note{margin-left:0;width:100%}}
      `}</style>
    </div>
  );
}
