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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function applySession(session) {
      const nextUser = session?.user || null;
      if (!active) return;
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin");
        if (error) throw error;
        if (active) setIsAdmin(Boolean(data));
      } catch {
        if (active) setIsAdmin(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => applySession(data?.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
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
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div id="mainNav" className="collapse navbar-collapse">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" href="/map">Map</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/npcs">NPCs</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/items">Crafting</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/inventory">Inventory</Link></li>
            {user && (
              <li className="nav-item"><Link className="nav-link" href="/profile">Profile</Link></li>
            )}
            {isAdmin && (
              <li className="nav-item"><Link className="nav-link" href="/admin">Admin</Link></li>
            )}
          </ul>

          <div className="d-flex gap-2">
            {user ? (
              <button className="btn btn-outline-secondary btn-sm" onClick={signOut}>
                Logout
              </button>
            ) : (
              <>
                <Link className="btn btn-outline-primary btn-sm" href="/signup">
                  Create account
                </Link>
                <Link className="btn btn-primary btn-sm" href="/login">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
