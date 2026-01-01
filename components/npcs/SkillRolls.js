import { useMemo, useState } from "react";

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

const SKILLS = [
  { key: "acrobatics", label: "Acrobatics", abbr: "Dex" },
  { key: "animal_handling", label: "Animal Handling", abbr: "Wis" },
  { key: "arcana", label: "Arcana", abbr: "Int" },
  { key: "athletics", label: "Athletics", abbr: "Str" },
  { key: "deception", label: "Deception", abbr: "Cha" },
  { key: "history", label: "History", abbr: "Int" },
  { key: "insight", label: "Insight", abbr: "Wis" },
  { key: "intimidation", label: "Intimidation", abbr: "Cha" },
  { key: "investigation", label: "Investigation", abbr: "Int" },
  { key: "medicine", label: "Medicine", abbr: "Wis" },
  { key: "nature", label: "Nature", abbr: "Int" },
  { key: "perception", label: "Perception", abbr: "Wis" },
  { key: "performance", label: "Performance", abbr: "Cha" },
  { key: "persuasion", label: "Persuasion", abbr: "Cha" },
  { key: "religion", label: "Religion", abbr: "Int" },
  { key: "sleight_of_hand", label: "Sleight of Hand", abbr: "Dex" },
  { key: "stealth", label: "Stealth", abbr: "Dex" },
  { key: "survival", label: "Survival", abbr: "Wis" },
];

// tolerant getter (you said you’ll help define “real” math later)
function getSkillMod(sheet, key) {
  if (!sheet) return 0;

  // common shapes you might use
  const candidates = [
    sheet?.skills?.[key],
    sheet?.skill_mods?.[key],
    sheet?.mods?.skills?.[key],
    sheet?.[key],
  ];

  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export default function SkillRolls({ sheet }) {
  const [lastRoll, setLastRoll] = useState(null);

  const mods = useMemo(() => {
    const m = new Map();
    for (const s of SKILLS) m.set(s.key, getSkillMod(sheet, s.key));
    return m;
  }, [sheet]);

  return (
    <>
      <div className="fw-semibold mb-1">Sheet & quick rolls</div>
      <div className="small mb-2" style={{ color: "rgba(255,255,255,0.60)" }}>
        Stored as JSON overlay (<code>npc_sheets.sheet</code> or <code>merchant_profiles.sheet</code>).
      </div>

      <div className="fw-semibold mt-3 mb-1">Skills</div>
      <div className="small mb-2" style={{ color: "rgba(255,255,255,0.60)" }}>
        Click a skill to roll d20 + skill mod (from your sheet JSON).
      </div>

      <div className="row g-2">
        {SKILLS.map((s) => {
          const mod = mods.get(s.key) ?? 0;
          const modLabel = mod >= 0 ? `+${mod}` : `${mod}`;

          return (
            <div className="col-12 col-md-6" key={s.key}>
              <button
                type="button"
                className="btn btn-sm w-100 text-start"
                onClick={() => {
                  const roll = d20();
                  const total = roll + (mod || 0);
                  setLastRoll({
                    type: `${s.label} (${s.abbr})`,
                    roll,
                    mod: mod || 0,
                    total,
                  });
                }}
                style={{
                  background: "rgba(0,0,0,0.18)",
                  border: "1px solid rgba(255,195,0,0.65)",
                  color: "rgba(255,255,255,0.92)",
                  borderRadius: 10,
                  padding: "7px 10px",
                }}
              >
                <div className="d-flex align-items-center">
                  <div className="fw-semibold" style={{ fontSize: 13 }}>
                    {s.label} <span style={{ color: "rgba(255,255,255,0.70)" }}>({s.abbr})</span>
                  </div>
                  <div className="ms-auto" style={{ color: "rgba(255,195,0,0.95)", fontWeight: 700 }}>
                    {modLabel}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {lastRoll && (
        <div className="alert alert-dark py-2 mt-2 mb-0" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="small" style={{ color: "rgba(255,255,255,0.92)" }}>
            <span className="fw-semibold">{lastRoll.type}</span>: d20 <span>{lastRoll.roll}</span>{" "}
            {lastRoll.mod >= 0 ? "+" : "-"} <span>{Math.abs(lastRoll.mod)}</span> ={" "}
            <span className="fw-semibold">{lastRoll.total}</span>
          </div>
        </div>
      )}
    </>
  );
}