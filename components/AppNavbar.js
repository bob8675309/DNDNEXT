import Link from "next/link";

export default function AppNavbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark px-3" style={{ background: "#0b0b16" }}>
      <Link className="navbar-brand fw-semibold" href="/">
        DnDNext
      </Link>

      <button
        className="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNav"
        aria-controls="mainNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon" />
      </button>

      <div className="collapse navbar-collapse" id="mainNav">
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
          <li className="nav-item">
            <Link className="nav-link" href="/map">
              Map
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" href="/npcs">
              NPCs
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" href="/items">
              Items
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" href="/inventory">
              Inventory
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" href="/admin">
              Admin
            </Link>
          </li>
        </ul>

        <div className="d-flex">
          <Link className="btn btn-sm btn-outline-light" href="/logout">
            Logout
          </Link>
        </div>
      </div>
    </nav>
  );
}
