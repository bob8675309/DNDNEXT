// components/LocationSideBar.js
import MapNpcsQuests from "../components/MapNpcsQuests";

export default function LocationSideBar({ location, onClose }) {
  if (!location) return null;

  const x = Number(location.x);
  const y = Number(location.y);

  const npcsRaw = Array.isArray(location.npcs) ? location.npcs : [];
  const questsRaw = Array.isArray(location.quests) ? location.quests : [];

  const npcNames = npcsRaw
    .map((v) => (typeof v === "string" ? v : v?.name || v?.title || v?.id))
    .filter(Boolean);

  const questTitles = questsRaw
    .map((v) => (typeof v === "string" ? v : v?.name || v?.title || v?.id))
    .filter(Boolean);

  return (
    <>
      <div className="offcanvas-header">
        <div>
          <h5 className="offcanvas-title mb-0">{location.name}</h5>
          <div className="small text-muted">
            {Number.isFinite(x) && Number.isFinite(y) ? (
              <>
                X {x.toFixed(2)} · Y {y.toFixed(2)}
              </>
            ) : (
              "No coordinates set"
            )}
          </div>
        </div>

        <button
          className="btn-close btn-close-white"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
          onClick={onClose}
        />
      </div>

      <div className="offcanvas-body">
        {location.description ? (
          <div className="loc-sec">
            <div className="loc-sec-title">
              <span>Description</span>
              <span className="badge-soft">📍</span>
            </div>
            <div className="loc-desc">{location.description}</div>
          </div>
        ) : (
          <div className="loc-sec">
            <div className="loc-sec-title">
              <span>Description</span>
              <span className="badge-soft">📍</span>
            </div>
            <div className="small text-muted">No description yet.</div>
          </div>
        )}

        <MapNpcsQuests npcNames={npcNames} questTitles={questTitles} />
      </div>
    </>
  );
}
