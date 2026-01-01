export default function NpcEditPanel({
  editType,
  editNpc,
  setEditNpc,
  editMerchant,
  setEditMerchant,
  editSheet,
  setEditSheet,
  locations,
  onCancel,
  onSave,
  MUTED,
  DIM,
  BORDER,
}) {
  return (
    <>
      <hr className="my-3" style={{ borderColor: BORDER }} />
      <div className="d-flex align-items-center mb-2">
        <div className="fw-semibold">Edit {editType === "merchant" ? "Merchant" : "NPC"}</div>
        <div className="ms-auto d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-sm btn-primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>

      {editType === "npc" && editNpc && (
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Name
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.name || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Race
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.race || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, race: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Role
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.role || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, role: e.target.value }))}
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Affiliation
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.affiliation || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, affiliation: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Status
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.status || "alive"}
              onChange={(e) => setEditNpc((p) => ({ ...p, status: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Location
            </label>
            <select
              className="form-select form-select-sm"
              value={editNpc.location_id || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, location_id: e.target.value || null }))}
            >
              <option value="">—</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Background
            </label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={editNpc.background || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, background: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Description
            </label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={editNpc.description || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Motivation
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.motivation || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, motivation: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Quirk
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.quirk || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, quirk: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Mannerism
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.mannerism || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, mannerism: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Voice
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.voice || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, voice: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Secret
            </label>
            <input
              className="form-control form-control-sm"
              value={editNpc.secret || ""}
              onChange={(e) => setEditNpc((p) => ({ ...p, secret: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Sheet overlay (JSON)
            </label>
            <div className="small mb-1" style={{ color: DIM }}>
              Quick start example: <code>{"{ abilities: { str: 16 }, skills: { perception: 3 } }"}</code>
            </div>
            <textarea
              className="form-control"
              rows={8}
              value={JSON.stringify(editSheet || {}, null, 2)}
              onChange={(e) => {
                try {
                  const next = JSON.parse(e.target.value);
                  setEditSheet(next);
                } catch {
                  // ignore invalid while typing
                }
              }}
            />
          </div>
        </div>
      )}

      {editType === "merchant" && editMerchant && (
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Name (read-only)
            </label>
            <input className="form-control form-control-sm" value={editMerchant.name || ""} disabled />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Status
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.status || "alive"}
              onChange={(e) => setEditMerchant((p) => ({ ...p, status: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Location
            </label>
            <select
              className="form-select form-select-sm"
              value={editMerchant.location_id || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, location_id: e.target.value || null }))}
            >
              <option value="">—</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Race
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.race || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, race: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Role
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.role || "Merchant"}
              onChange={(e) => setEditMerchant((p) => ({ ...p, role: e.target.value }))}
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Affiliation
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.affiliation || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, affiliation: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Background
            </label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={editMerchant.background || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, background: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Description
            </label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={editMerchant.description || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Motivation
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.motivation || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, motivation: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Quirk
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.quirk || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, quirk: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Mannerism
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.mannerism || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, mannerism: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Voice
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.voice || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, voice: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Secret
            </label>
            <input
              className="form-control form-control-sm"
              value={editMerchant.secret || ""}
              onChange={(e) => setEditMerchant((p) => ({ ...p, secret: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <label className="form-label form-label-sm" style={{ color: MUTED }}>
              Sheet overlay (JSON)
            </label>
            <div className="small mb-1" style={{ color: DIM }}>
              Quick start example: <code>{"{ abilities: { dex: 14 }, skills: { stealth: 5 } }"}</code>
            </div>
            <textarea
              className="form-control"
              rows={8}
              value={JSON.stringify(editSheet || {}, null, 2)}
              onChange={(e) => {
                try {
                  const next = JSON.parse(e.target.value);
                  setEditSheet(next);
                } catch {}
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
