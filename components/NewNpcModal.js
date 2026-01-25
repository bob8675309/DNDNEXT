import { useState } from "react";
import { supabase } from "../utils/supabaseClient";

// A simple modal for creating a new NPC. This is intentionally minimal and easy to extend.
// It presents a three‑step wizard: Name → Species → Class → Confirmation.
// Species and class lists can be expanded later to include more options from other supplements.
const SPECIES_OPTIONS = [
  { id: "human", name: "Human" },
  { id: "dwarf", name: "Dwarf" },
  { id: "elf", name: "Elf" },
  { id: "halfling", name: "Halfling" },
  { id: "gnome", name: "Gnome" },
  { id: "dragonborn", name: "Dragonborn" },
  { id: "tiefling", name: "Tiefling" },
  { id: "halfOrc", name: "Half‑Orc" },
  { id: "halfElf", name: "Half‑Elf" },
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
];

export default function NewNpcModal({ show, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [cls, setCls] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
      ? !!species
      : step === 2
      ? !!cls
      : false;

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const now = new Date().toISOString();
      // Insert into characters. Default to is_hidden=true so the character starts off‑map.
      const { data: insertData, error: insertErr } = await supabase
        .from("characters")
        .insert({
          name: name.trim(),
          race: species || null,
          // Save the class name into role for now. You can move this into the sheet later.
          role: cls || null,
          kind: "npc",
          status: "alive",
          is_hidden: true,
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

      // Notify parent and close.
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
    setStep(step - 1);
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
          maxWidth: "520px",
          color: "white",
        }}
      >
        <h5 className="mb-3">Create New NPC</h5>
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
            <select
              className="form-select"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            >
              <option value="">Select species</option>
              {SPECIES_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {step === 2 && (
          <div>
            <label className="form-label">Class</label>
            <select className="form-select" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">Select class</option>
              {CLASS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {step === 3 && (
          <div>
            <p>
              Name: <strong>{name}</strong>
            </p>
            <p>
              Species: <strong>{species || "Unknown"}</strong>
            </p>
            <p>
              Class: <strong>{cls || "Unknown"}</strong>
            </p>
            <p>Ready to create this NPC?</p>
          </div>
        )}
        {error && (
          <div className="alert alert-danger mt-3 py-2" style={{ fontSize: 14 }}>
            {error}
          </div>
        )}
        <div className="d-flex justify-content-between mt-4">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <div>
            {step > 0 && (
              <button
                type="button"
                className="btn btn-outline-light btn-sm me-2"
                onClick={handleBack}
                disabled={creating}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleNext}
                disabled={!canNext || creating}
              >
                Next
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}