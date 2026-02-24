// hooks/useInterpolatedPoses.js
// Owns the requestAnimationFrame loop and computes per-frame interpolated poses
// from segment timing + route points.
//
// This isolates movement math so UI edits in MapPageClient are less likely to break movement.

import { useCallback, useEffect } from "react";
import { asLocPct, asCharPct } from "../lib/map/coords";
import { tsToMs, computeProgress } from "../lib/map/movement";

export function useInterpolatedPoses({
  merchants = [],
  npcs = [],
  pointsByRouteSeq,
  locById,
  getRenderWorldMs,
  renderPositionsRef,
  setAnimNonce,
  enabled = true,
} = {}) {
  const pointXY = useCallback(
    (routeId, seq) => {
      if (!routeId || seq == null) return null;
      const inner = pointsByRouteSeq?.get(String(routeId));
      const p = inner?.get(Number(seq));
      if (!p) return null;
      const x = Number(p.x);
      const y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y, location_id: p.location_id ?? null };
    },
    [pointsByRouteSeq]
  );

  const locXY = useCallback(
    (locId) => {
      if (!locId) return null;
      const l = locById?.get(String(locId));
      if (!l) return null;
      const x = asLocPct(l.x);
      const y = asLocPct(l.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    },
    [locById]
  );

  const computeCharRenderPos = useCallback(
    (kind, row, renderWorldMs) => {
      if (!row?.id) return null;
      const st = String(row.state || "").toLowerCase();

      const segStart = tsToMs(row.segment_started_at);
      const segEnd = tsToMs(row.segment_ends_at);

      // Default to DB x/y when not moving or when we cannot interpolate.
      let x = asCharPct(row.x);
      let y = asCharPct(row.y);
      let vx = 0;
      let vy = 0;
      let t = null;
      let debug = null;
      let moving = false;

      const canInterpolate =
        renderWorldMs != null &&
        segStart != null &&
        segEnd != null &&
        Number.isFinite(segStart) &&
        Number.isFinite(segEnd) &&
        segEnd > segStart;

      const traveling = st === "moving" || st === "excursion";
      const shouldInterpolate = traveling;

      if (canInterpolate && shouldInterpolate) {
        const totalMs = segEnd - segStart;
        t = computeProgress(renderWorldMs, segStart, segEnd);
        if (t == null) {
          debug = "bad_progress";
        }

        // Preferred: route point endpoints (seq-based)
        let a = null;
        let b = null;
        if (row.route_id && row.current_point_seq != null && row.next_point_seq != null) {
          a = pointXY(row.route_id, row.current_point_seq);
          b = pointXY(row.route_id, row.next_point_seq);
        }

        // Fallback: location endpoints
        if (!a) {
          const fromLoc = row.last_known_location_id ?? row.location_id;
          const la = locXY(fromLoc);
          if (la) a = { x: la.x, y: la.y };
        }
        if (!b) {
          const toLoc = row.projected_destination_id;
          const lb = locXY(toLoc);
          if (lb) b = { x: lb.x, y: lb.y };
        }

        if (
          t != null &&
          a &&
          b &&
          Number.isFinite(a.x) &&
          Number.isFinite(a.y) &&
          Number.isFinite(b.x) &&
          Number.isFinite(b.y)
        ) {
          x = a.x + (b.x - a.x) * t;
          y = a.y + (b.y - a.y) * t;

          const durS = Math.max(0.001, totalMs / 1000);
          vx = (b.x - a.x) / durS;
          vy = (b.y - a.y) / durS;
          moving = traveling && t < 0.999999;
        } else {
          debug = "missing_endpoints";
        }
      } else if (shouldInterpolate && traveling) {
        debug = "missing_segment_times";
      }

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        x = 0;
        y = 0;
        debug = debug ? `${debug};bad_xy` : "bad_xy";
      }

      x = Math.min(100, Math.max(0, x));
      y = Math.min(100, Math.max(0, y));

      return { x, y, vx, vy, t, debug, moving, state: st, kind };
    },
    [locXY, pointXY]
  );

  useEffect(() => {
    if (!enabled) return;
    if (!renderPositionsRef || typeof renderPositionsRef !== "object") return;
    let raf = 0;

    const tick = () => {
      const wms = getRenderWorldMs?.();

      if (wms != null) {
        const next = {};
        for (const m of merchants || []) {
          if (!m?.id) continue;
          const pos = computeCharRenderPos("merchant", m, wms);
          if (pos) next[`merchant:${m.id}`] = pos;
        }
        for (const n of npcs || []) {
          if (!n?.id) continue;
          const pos = computeCharRenderPos("npc", n, wms);
          if (pos) next[`npc:${n.id}`] = pos;
        }
        renderPositionsRef.current = next;
        if (typeof setAnimNonce === "function") {
          setAnimNonce((v) => (v + 1) % 1000000);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    enabled,
    merchants,
    npcs,
    computeCharRenderPos,
    getRenderWorldMs,
    renderPositionsRef,
    setAnimNonce,
  ]);

  return {
    // exported for debugging/extensibility
    computeCharRenderPos,
    pointXY,
    locXY,
  };
}
