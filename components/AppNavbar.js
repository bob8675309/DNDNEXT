// components/AppNavbar.js
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AppNavbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user || null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary border-bottom sticky-top">
      <div className="container">
        <Link className="navbar-brand fw-semibold" href="/">DnDNext</Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div id="mainNav" className="collapse navbar-collapse">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" href="/map">Map</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/npcs">NPCs</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/items">Items</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/inventory">Inventory</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/admin">Admin</Link></li>
          </ul>

          <div className="d-flex">
            {user ? (
              <button className="btn btn-outline-secondary btn-sm" onClick={signOut}>
                Logout
              </button>
            ) : (
              <Link className="btn btn-primary btn-sm" href="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
