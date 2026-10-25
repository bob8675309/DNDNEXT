import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Deliberately outside the printed/persisted 5e sheet. This panel only controls
// a character-to-inventory-item bond, never equipment placement or base stats.
export default function CharacterAttunementPanel({ characterId, canManage = false }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (!characterId) { setSnapshot(null); return; }
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase.rpc("get_character_attunement_items_v1", {
        p_character_id: characterId,
      });
      if (fetchError) throw fetchError;
      setSnapshot(data || null);
    } catch (err) {
      // Staged migration absent: don't break the existing character sheet.
      setSnapshot(null);
      if (!/function .*does not exist|could not find the function|schema cache/i.test(String(err?.message || ""))) {
        setError(err?.message || "Could not load attunements.");
      }
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => { reload(); }, [reload]);
  const items = useMemo(
    () => (Array.isArray(snapshot?.items) ? snapshot.items : []).filter((item) => item?.requiresAttunement || item?.isAttuned),
    [snapshot]
  );

  async function setAttuned(item, next) {
    if (!canManage || busyId) return;
    setBusyId(String(item.itemId));
    setNotice("");
    setError("");
    try {
      const { data, error: commandError } = await supabase.rpc("set_character_item_attunement_v1", {
        p_character_id: characterId,
        p_item_id: item.itemId,
        p_attuned: Boolean(next),
      });
      if (commandError) throw commandError;
      setSnapshot(data);
      setNotice(next ? "Attunement recorded. Use the normal rest rules before activating item powers." : "Attunement ended.");
    } catch (err) {
      setError(err?.message || "Could not change attunement.");
    } finally {
      setBusyId("");
    }
  }

  if (!characterId || (!snapshot && !error)) return null;
  const count = Number(snapshot?.attunedCount || 0);
  const limit = snapshot?.unlimited ? null : 3;
  return (
    <section className="card bg-dark text-light border-secondary mx-2 mb-3" aria-label="Character magic item attunement">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <div>
            <div className="fw-semibold">Magic Item Attunement</div>
            <div className="small text-muted">A magical bond is separate from wearing or equipping an item.</div>
          </div>
          <span className="badge text-bg-secondary">{count} / {limit == null ? "Unlimited" : limit} attuned</span>
        </div>
        {loading ? <div className="small text-muted">Checking attunement…</div> : null}
        {!items.length && !loading ? <div className="small text-muted">No attunement-required items are currently assigned to this character.</div> : null}
        {items.map((item) => (
          <div key={item.itemId} className="d-flex justify-content-between align-items-center border-top border-secondary py-2 gap-2">
            <div className="small">
              <div className="fw-semibold">{item.itemName || "Magic item"}</div>
              <div className="text-muted">{item.isEquipped ? "Equipped" : "Carried"} · {item.isAttuned ? "Attuned" : "Not attuned"}</div>
            </div>
            {canManage ? (
              <button
                type="button"
                className={`btn btn-sm ${item.isAttuned ? "btn-outline-warning" : "btn-outline-info"}`}
                disabled={!!busyId || (!item.isAttuned && limit != null && count >= limit)}
                onClick={() => setAttuned(item, !item.isAttuned)}
              >
                {busyId === String(item.itemId) ? "Updating…" : item.isAttuned ? "End attunement" : "Attune"}
              </button>
            ) : null}
          </div>
        ))}
        <div className="small text-muted mt-2">Attunement follows D&amp;D rest and item-prerequisite rules. Capacity does not change helmet, boots, armor, weapon or other equip-slot restrictions.</div>
        {notice ? <div className="small text-success mt-2">{notice}</div> : null}
        {error ? <div className="small text-danger mt-2">{error}</div> : null}
        {snapshot ? <button type="button" className="btn btn-link btn-sm px-0" onClick={reload} disabled={loading}>Refresh attunement</button> : null}
      </div>
    </section>
  );
}
