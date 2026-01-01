import { useMemo, useState } from "react";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function abilityMod(score) {
  const s = num(score);
  if (s == null) return null;
  return Math.floor((s - 10) / 2);
}

function getAny(sheet, keys) {
  for (const k of keys) {
    const parts = String(k).split(".");
    let cur = sheet;
    let ok = true;
    for (const p of parts) {
      cur = cur?.[p];
      if (cur == null) {
        ok = false;
        break;
      }
    }
    if (ok && cur != null && String(cur).trim() !== "") return cur;
  }
  return null;
}

function SheetBox({ title, children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: 10,
        ...style,
      }}
    >
      <div className="small fw-semibold mb-1" style={{ color: "rgba(255,255,255,0.70)" }}>
        {title}
      </div>
      <div style={{ color: "rgba(255,255,255,0.92)" }}>{children}</div>
    </div>
  );
}

function TinyStat({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "8px 10px",
      }}
    >
      <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
        {label}
      </div>
      <div className="fw-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function CharacterSheetGrid({ sheet, fallbackName, backgroundText }) {
  const [showRaw, setShowRaw] = useState(false);

  const header = useMemo(() => {
    const name = getAny(sheet, ["name", "character_name"]) ?? fallbackName ?? "—";
    const classLevel = getAny(sheet, ["class_level", "classLevel", "class", "classAndLevel"]);
    const race = getAny(sheet, ["race"]);
    const alignment = getAny(sheet, ["alignment"]);
    const xp = getAny(sheet, ["xp", "experience_points"]);
    const player = getAny(sheet, ["player_name", "playerName"]);
    const bg = getAny(sheet, ["background"]) ?? backgroundText;
    return { name, classLevel, race, alignment, xp, player, bg };
  }, [sheet, fallbackName, backgroundText]);

  const abilities = useMemo(() => {
    const a = sheet?.abilities || sheet?.ability_scores || sheet?.stats || {};
    const STR = getAny({ a }, ["a.str", "a.STR", "a.strength"]);
    const DEX = getAny({ a }, ["a.dex", "a.DEX", "a.dexterity"]);
    const CON = getAny({ a }, ["a.con", "a.CON", "a.constitution"]);
    const INT = getAny({ a }, ["a.int", "a.INT", "a.intelligence"]);
    const WIS = getAny({ a }, ["a.wis", "a.WIS", "a.wisdom"]);
    const CHA = getAny({ a }, ["a.cha", "a.CHA", "a.charisma"]);
    return { STR, DEX, CON, INT, WIS, CHA };
  }, [sheet]);

  const core = useMemo(() => {
    return {
      ac: getAny(sheet, ["ac", "armor_class", "combat.ac"]),
      init: getAny(sheet, ["initiative", "combat.initiative"]),
      speed: getAny(sheet, ["speed", "combat.speed"]),
      hpMax: getAny(sheet, ["hp_max", "hpMax", "hit_points.max", "hp.max"]),
      hpCur: getAny(sheet, ["hp_current", "hpCurrent", "hit_points.current", "hp.current"]),
      prof: getAny(sheet, ["prof_bonus", "proficiency_bonus", "profBonus"]),
    };
  }, [sheet]);

  return (
    <>
      <div
        style={{
          background: "rgba(0,0,0,0.14)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 12,
        }}
      >
        {/* Header row (like the official sheet top strip) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.7fr 1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <SheetBox title="Character Name">{header.name}</SheetBox>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SheetBox title="Class & Level">{header.classLevel ?? "—"}</SheetBox>
            <SheetBox title="Race">{header.race ?? "—"}</SheetBox>
            <SheetBox title="Background">{header.bg ?? "—"}</SheetBox>
            <SheetBox title="Alignment">{header.alignment ?? "—"}</SheetBox>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <SheetBox title="Player Name">{header.player ?? "—"}</SheetBox>
            <SheetBox title="Experience">{header.xp ?? "—"}</SheetBox>
          </div>
        </div>

        {/* Body (left abilities / center combat / right personality & traits) */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 1fr", gap: 12 }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SheetBox title="Ability Scores">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  ["STR", abilities.STR],
                  ["DEX", abilities.DEX],
                  ["CON", abilities.CON],
                  ["INT", abilities.INT],
                  ["WIS", abilities.WIS],
                  ["CHA", abilities.CHA],
                ].map(([k, v]) => {
                  const mod = abilityMod(v);
                  return (
                    <div
                      key={k}
                      style={{
                        background: "rgba(0,0,0,0.18)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                        {k}
                      </div>
                      <div className="d-flex align-items-center">
                        <div className="fw-semibold" style={{ fontSize: 18 }}>
                          {v ?? "—"}
                        </div>
                        <div className="ms-auto small" style={{ color: "rgba(255,255,255,0.70)" }}>
                          Mod:{" "}
                          <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 700 }}>
                            {mod == null ? "—" : mod >= 0 ? `+${mod}` : `${mod}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SheetBox>

            <SheetBox title="Saving Throws (placeholder)">
              <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                We’ll wire these to your sheet JSON next (STR/DEX/CON/INT/WIS/CHA).
              </div>
            </SheetBox>

            <SheetBox title="Skills (layout reference)">
              <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                You already have interactive skill buttons in the Skills tab—this box is just to preserve the “sheet feel”.
              </div>
            </SheetBox>
          </div>

          {/* CENTER */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <TinyStat label="Armor Class" value={core.ac} />
              <TinyStat label="Initiative" value={core.init} />
              <TinyStat label="Speed" value={core.speed} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <SheetBox title="HP Max">{core.hpMax ?? "—"}</SheetBox>
              <SheetBox title="Current HP">{core.hpCur ?? "—"}</SheetBox>
            </div>

            <SheetBox title="Attacks & Spellcasting (placeholder)">
              <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                Keep your familiar box layout—later we’ll make entries + clickable rolls.
              </div>
            </SheetBox>

            <SheetBox title="Equipment (placeholder)">
              <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                Later: render equipment list from JSON.
              </div>
            </SheetBox>

            <SheetBox title="Proficiency Bonus">{core.prof ?? "—"}</SheetBox>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SheetBox title="Personality Traits">{getAny(sheet, ["personality_traits", "traits"]) ?? "—"}</SheetBox>
            <SheetBox title="Ideals">{getAny(sheet, ["ideals"]) ?? "—"}</SheetBox>
            <SheetBox title="Bonds">{getAny(sheet, ["bonds"]) ?? "—"}</SheetBox>
            <SheetBox title="Flaws">{getAny(sheet, ["flaws"]) ?? "—"}</SheetBox>
            <SheetBox title="Features & Traits">{getAny(sheet, ["features_traits", "features"]) ?? "—"}</SheetBox>
          </div>
        </div>

        <div className="mt-3">
          <button
            className="btn btn-sm btn-outline-light"
            type="button"
            onClick={() => setShowRaw((v) => !v)}
          >
            {showRaw ? "Hide raw sheet JSON" : "View raw sheet JSON"}
          </button>

          {showRaw && (
            <pre
              className="mt-2 mb-0"
              style={{
                background: "rgba(0,0,0,0.22)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                padding: 12,
                color: "rgba(255,255,255,0.92)",
                maxHeight: 260,
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(sheet || {}, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
