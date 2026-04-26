import { useState } from "react";
import { supabase } from "../utils/supabaseClient";

// NPC creator foundation pass:
// - Keeps the existing simple wizard intact.
// - Adds explicit workshop roles so town crafting does not rely on fuzzy class/name inference.
// - Stores crafter roles in characters.tags for TownSheet's Crafters' Quarter.
const SPECIES_OPTIONS = [
  { id: "human", name: "Human" },
  { id: "dwarf", name: "Dwarf" },
  { id: "elf", name: "Elf" },
  { id: "halfling", name: "Halfling" },
  { id: "gnome", name: "Gnome" },
  { id: "dragonborn", name: "Dragonborn" },
  { id: "tiefling", name: "Tiefling" },
  { id: "halfOrc", name: "Half-Orc" },
  { id: "halfElf", name: "Half-Elf" },
  { id: "goliath", name: "Goliath" },
];

const CLASS_OPTIONS = [
  { id: "barbarian", name: "Barbarian" },
  { id: "bard", name: "Bard" },
  { id: "cleric", name: "Cleric" },
  { id: "druid", name: "Druid" },
  { id: "fighter", name: "Fighter" },
  { id: "monk", name: "Monk" },
  { id: "paladin", name: "Paladin" },
  { id: "ranger", name: "Ranger" },
  { id: "rogue", name: "Rogue" },
  { id: "sorcerer", name: "Sorcerer" },
  { id: "warlock", name: "Warlock" },
  { id: "wizard", name: "Wizard" },
  { id: "commoner", name: "Commoner / Townsperson" },
  { id: "expert", name: "Expert / Professional" },
];

const CRAFT_ROLE_OPTIONS = [
  { id: "blacksmith", name: "Blacksmith", hint: "Forge mundane gear and reforge physical tier/+N upgrades." },
  { id: "enchanter", name: "Enchanter", hint: "Add magical A/B/C enchant slots to already tiered gear." },
  { id: "alchemist", name: "Alchemist", hint: "Future potion, poison, tonic, and reagent workflow." },
  { id: "scribe", name: "Scribe", hint: "Future scroll, book, ritual, and inscription workflow." },
  { id: "jeweler", name: "Jeweler", hint: "Future gem setting, focus stones, and socket work." },
];

const STEP_LABELS = ["Name", "Species", "Class", "Workshop", "Confirm"];

export default function NewNpcModal({ show, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [cls, setCls] = useState("");
  const [craftRoles, setCraftRoles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
      ? !!species
      : step === 2
      ? !!cls
      : step === 3
      ? true
      : false;

  function resetForm() {
    setStep(0);
    setName("");
    setSpecies("");
    setCls("");
    setCraftRoles([]);
    setError("");
  }

  function handleClose() {
    if (creating) return;
    resetForm();
    onClose?.();
  }

  function toggleCraftRole(id) {
    setCraftRoles((prev) => {
      const set = new Set(prev || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const now = new Date().toISOString();
      const tags = Array.from(new Set((craftRoles || []).filter(Boolean)));

      // Insert into characters. Default to is_hidden=true so the character starts off-map.
      // Crafter roles live in `tags` so TownSheet can surface only clear workshop providers.
      const { data: insertData, error: insertErr } = await supabase
        .from("characters")
        .insert({
          name: name.trim(),
          race: species || null,
          // Save the class/profession label into role for now. Richer NPC sheet fields come later.
          role: cls || null,
          kind: "npc",
          status: "alive",
          is_hidden: true,
          tags,
          // NOTE: Do not set `created_at` because the `characters` table doesn't have this column.
          updated_at: now,
        })
        .select("id")
        .single();
      if (insertErr || !insertData) throw insertErr || new Error("Insert failed");

      const newId = insertData.id;
      // Initialise an empty sheet for the new NPC.
      await supabase
        .from("character_sheets")
        .insert({ character_id: newId, sheet: {}, updated_at: now });

      resetForm();
      if (typeof onCreated === "function") onCreated();
    } catch (err) {
      const msg = String(err?.message || err) || "Unknown error";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  function handleNext() {
    if (!canNext) return;
    setStep(step + 1);
  }

  function handleBack() {
    setStep(Math.max(0, step - 1));
  }

  if (!show) return null;
  return (
    <div
      className="position-fixed top-0 start-0 vw-100 vh-100 d-flex align-items-center justify-content-center"
      style={{ background: "rgba(0,0,0,0.75)", zIndex: 1050 }}
    >
      <div
        className="p-4 rounded-3"
        style={{
          background: "rgba(8, 10, 16, 0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          width: "90%",
          maxWidth: "640px",
          color: "white",
        }}
      >
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div className="text-uppercase text-white-50" style={{ fontSize: 11, letterSpacing: "0.12em" }}>
              NPC creator
            </div>
            <h5 className="mb-1">Create New NPC</h5>
            <div className="text-white-50" style={{ fontSize: 13 }}>
              Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={handleClose} disabled={creating}>
            Close
          </button>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-4">
          {STEP_LABELS.map((label, idx) => (
            <span
              key={label}
              className={`badge ${idx === step ? "text-bg-primary" : idx < step ? "text-bg-success" : "text-bg-secondary"}`}
            >
              {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div>
            <label className="form-label">Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter NPC name"
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="form-label">Species</label>
            <select className="form-select" value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">Select species</option>
              {SPECIES_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="form-label">Class / profession</label>
            <select className="form-select" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">Select class or profession</option>
              {CLASS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.name}>{opt.name}</option>
              ))}
            </select>
            <div className="form-text text-white-50">
              This still saves to the existing <code>role</code> field. Workshop access is handled separately on the next step.
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
              <div>
                <label className="form-label mb-1">Workshop role</label>
                <div className="text-white-50" style={{ fontSize: 13 }}>
                  Optional. Pick one or more only if this NPC should appear in the Town Sheet Crafters' Quarter.
                </div>
              </div>
              {craftRoles.length ? (
                <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => setCraftRoles([])}>
                  Clear
                </button>
              ) : null}
            </div>

            <div className="row g-2">
              {CRAFT_ROLE_OPTIONS.map((role) => {
                const active = craftRoles.includes(role.id);
                return (
                  <div key={role.id} className="col-12 col-md-6">
                    <button
                      type="button"
                      className={`w-100 text-start p-3 rounded-3 ${active ? "border border-warning" : "border border-secondary"}`}
                      style={{ background: active ? "rgba(245, 158, 11, 0.16)" : "rgba(255,255,255,0.04)", color: "white" }}
                      onClick={() => toggleCraftRole(role.id)}
                    >
                      <div className="d-flex justify-content-between gap-2">
                        <strong>{role.name}</strong>
                        <span className={`badge ${active ? "text-bg-warning" : "text-bg-dark"}`}>{active ? "selected" : "off"}</span>
                      </div>
                      <div className="text-white-50 mt-1" style={{ fontSize: 12 }}>{role.hint}</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-3 p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <p className="mb-2">Name: <strong>{name}</strong></p>
            <p className="mb-2">Species: <strong>{species || "Unknown"}</strong></p>
            <p className="mb-2">Class / profession: <strong>{cls || "Unknown"}</strong></p>
            <p className="mb-0">
              Workshop roles: <strong>{craftRoles.length ? craftRoles.map((id) => CRAFT_ROLE_OPTIONS.find((r) => r.id === id)?.name || id).join(", ") : "None"}</strong>
            </p>
          </div>
        )}

        {error && <div className="alert alert-danger mt-3 py-2" style={{ fontSize: 14 }}>{error}</div>}

        <div className="d-flex justify-content-between mt-4">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleClose} disabled={creating}>Cancel</button>
          <div>
            {step > 0 && (
              <button type="button" className="btn btn-outline-light btn-sm me-2" onClick={handleBack} disabled={creating}>Back</button>
            )}
            {step < STEP_LABELS.length - 1 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleNext} disabled={!canNext || creating}>Next</button>
            )}
            {step === STEP_LABELS.length - 1 && (
              <button type="button" className="btn btn-success btn-sm" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
