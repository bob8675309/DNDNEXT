import React from "react";

export default function MapOverlay({
  routes = [],
  active,
  onSelect,
  className = "",
  scaleX = 1,
  scaleY = 1,
}) {
  const sx = Number(scaleX) || 1;
  const sy = Number(scaleY) || 1;

  const toSvg = (p) => ({
    x: (Number(p?.x) || 0) * sx,
    y: (Number(p?.y) || 0) * sy,
  });

  return (
    <svg
      className={`map-vectors route-overlay ${className}`.trim()}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {routes
        .filter((r) => r && r.visible !== false)
        .map((r) => {
          const points = Array.isArray(r.points) ? r.points : [];
          const typeClass = r.type ? `route-type-${r.type}` : "";

          return (
            <g key={r.id || r.name || Math.random()}>
              {points.slice(1).map((p, i) => {
                const a = toSvg(points[i]);
                const b = toSvg(p);
                return (
                  <line
                    key={`${r.id || "r"}-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={`route-path ${typeClass}`.trim()}
                    onClick={() => onSelect?.(r)}
                    style={{
                      cursor: onSelect ? "pointer" : "default",
                      pointerEvents: onSelect ? "stroke" : "none",
                    }}
                  />
                );
              })}

              {points.map((p, i) => {
                const v = toSvg(p);
                const isActive = active && (active.id === r.id || active === r.id);

                return (
                  <circle
                    key={`${r.id || "r"}-pt-${i}`}
                    cx={v.x}
                    cy={v.y}
                    r={0.8}
                    fill={isActive ? "#ffca28" : "#00e6ff"}
                    opacity={0.95}
                  />
                );
              })}
            </g>
          );
        })}
    </svg>
  );
}
