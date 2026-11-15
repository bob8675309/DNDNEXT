// Private authored backstory is separate from GM Secrets and public lore.
// This editor uses the server's creator+GM authority, not can_edit alone.
// All server-side permissions must be installed atomically with the UI.
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function CreatorBackstoryPanel({ characterId }) {
  const [authorized, setAuthorized] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setAuthorized(false);
    setDraft("");
    setSaved(false);
    setError("");
    if (!characterId) return undefined;

    async function load() {
      const { data: permitted, error: checkError } = await supabase.rpc(
        "can_edit_creator_backstory_v1",
        { p_character_id: characterId }
      );
      if (!active || checkError || permitted !== true) return;
      const { data, error: fetchError } = await supabase
        .from("character_backstory_secrets")
        .select("secret_text")
        .eq("character_id", characterId)
        .maybeSingle();
      if (!active) return;
      if (fetchError) {
        setError("Private backstory could not be loaded.");
        return;
      }
      setDraft(String(data?.secret_text || ""));
      setAuthorized(true);
    }
    load();
    return () => { active = false; };
  }, [characterId]);

  async function save() {
    if (!characterId || !authorized || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const { error: saveError } = await supabase
      .from("character_backstory_secrets")
      .upsert({
        character_id: characterId,
        secret_text: draft,
        updated_at: new Date().toISOString()
      }, { onConflict: "character_id" });
    setSaving(false);
    if (saveError) {
      setError("Unable to save. Your creator or GM access may have changed.");
      return;
    }
    setSaved(true);
  }

  if (!authorized) return null;

  return (
    <section className="npc-card" style={{ gridColumn: "1 / -1" }}
      aria-label="Private character backstory">
      <div className="npc-card-title mb-1">Private Backstory</div>
      <div className="small text-muted mb-2">
        Only the original creator (while permitted to edit) and the GM can read or change this.
        This is not a GM Secret, and it is not a published discovery.
      </div>
      <label htmlFor={`creator-backstory-${characterId}`} className="form-label small">
        Personal history or private motivations
      </label>
      <textarea
        id={`creator-backstory-${characterId}`}
        className="form-control bg-dark text-light"
        rows={4}
        maxLength={16000}
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setSaved(false); }}
      />
      <div className="d-flex align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={save}
          disabled={saving}>{saving ? "Saving…" : "Save private backstory"}</button>
        <span className="small" role="status" aria-live="polite">
          {error ? <span className="text-warning">{error}</span> : saved ? "Saved" : null}
        </span>
      </div>
    </section>
  );
}
