import { useEffect } from "react";
import { FaMapMarkerAlt, FaUsers, FaBook, FaStar, FaTimes, FaShoppingBag } from "react-icons/fa";
import Link from "next/link";

export default function LocationSideBar({ open, location, onClose, isAdmin, merchants = [] }) {
  if (!open || !location) return null;

  const locId = location?.id ?? null;
  const locX = location?.x ?? null;
  const locY = location?.y ?? null;

  const npcs = location.npcs || [];
  const quests = location.quests || [];

  const localMerchants = merchants.filter(
    (m) => m?.x != null && m?.y != null && String(m.x) === String(locX) && String(m.y) === String(locY)
  );

  const roamingMerchants = merchants.filter(
    (m) =>
      m?.location_id == null &&
      (String(m.last_known_location_id) === String(locId) ||
        String(m.projected_destination_id) === String(locId))
  );

  const questStatusIcon = {
    Active: <FaStar className="text-warning me-2" />,
    Complete: <FaStar className="text-success me-2" />,
    Failed: <FaStar className="text-danger me-2" />,
  };

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
  }, [open]);

  return (
    <aside
      className={`position-fixed top-0 end-0 h-100 bg-light shadow p-4 overflow-auto sidebar transition-all ${open ? "d-block" : "d-none"}`}
      style={{ width: "100%", maxWidth: "400px", zIndex: 1050 }}
    >
      <button className="btn-close position-absolute end-0 me-3 mt-2" onClick={onClose}></button>

      <div className="d-flex align-items-center mb-3">
        <FaMapMarkerAlt className="text-danger me-2" size={24} />
        <h2 className="h4 mb-0 fw-bold text-dark">{location.name}</h2>
      </div>

      <p className="fst-italic text-muted mb-4">{location.description}</p>

      {localMerchants.length > 0 && (
        <div className="mb-4">
          <div className="d-flex align-items-center mb-2">
            <FaShoppingBag className="me-2 text-warning" />
            <h5 className="mb-0">Merchants Present</h5>
          </div>
          <ul className="list-unstyled ms-3">
            {localMerchants.map((m) => (
              <li key={m.id} className="text-dark">
                <span className="me-2">{m.icon || "🧺"}</span>
                {m.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {roamingMerchants.length > 0 && (
        <div className="mb-4">
          <div className="d-flex align-items-center mb-2">
            <FaShoppingBag className="me-2 text-info" />
            <h5 className="mb-0">Passing Through</h5>
          </div>
          <ul className="list-unstyled ms-3">
            {roamingMerchants.map((m) => (
              <li key={m.id} className="fst-italic text-muted">
                {m.name} was last seen heading toward this location.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <div className="d-flex align-items-center mb-2">
          <FaUsers className="me-2 text-primary" />
          <h5 className="mb-0">Notable NPCs</h5>
        </div>
        <ul className="list-unstyled ms-3">
          {npcs.map((npc) => (
            <li key={npc.id} className="mb-2">
              <Link href={`/npc/${npc.id}`} className="text-decoration-none">
                <strong className="text-dark d-block">{npc.name}</strong>
                <small className="text-muted">{npc.race} {npc.role && `— ${npc.role}`}</small>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="d-flex align-items-center mb-2">
          <FaBook className="me-2 text-secondary" />
          <h5 className="mb-0">Quests</h5>
        </div>
        <ul className="list-unstyled ms-3">
          {quests.map((quest) => (
            <li key={quest.id} className="mb-2">
              <div className="d-flex align-items-center">
                {questStatusIcon[quest.status] || <FaStar className="text-muted me-2" />}
                <strong className="me-2 text-dark">{quest.name}</strong>
                <span className={`badge rounded-pill bg-${
                  quest.status === "Active"
                    ? "warning"
                    : quest.status === "Complete"
                    ? "success"
                    : quest.status === "Failed"
                    ? "danger"
                    : "secondary"
                }`}>{quest.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
