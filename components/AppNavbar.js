// components/AppNavbar.js
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function NavAnchor({ href, className, children }) {
  return <a className={className} href={href}>{children}</a>;
}

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
        <NavAnchor className="navbar-brand fw-semibold" href="/">DnDNext</NavAnchor>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon" />
        </button>
        <div id="mainNav" className="collapse navbar-collapse">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><NavAnchor className="nav-link" href="/map">Map</NavAnchor></li>
            <li className="nav-item"><NavAnchor className="nav-link" href="/npcs">NPCs</NavAnchor></li>
            <li className="nav-item"><NavAnchor className="nav-link" href="/items">Crafting</NavAnchor></li>
            <li className="nav-item"><NavAnchor className="nav-link" href="/inventory">Inventory</NavAnchor></li>
            {user && <li className="nav-item"><NavAnchor className="nav-link" href="/profile?characterProfile=1">Profile</NavAnchor></li>}
            {isAdmin && <li className="nav-item"><NavAnchor className="nav-link" href="/admin/spells">Magic</NavAnchor></li>}
            {isAdmin && <li className="nav-item"><NavAnchor className="nav-link" href="/admin">Admin</NavAnchor></li>}
          </ul>
          <div className="d-flex gap-2">
            {user ? (
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={signOut}>Logout</button>
            ) : (
              <>
                <NavAnchor className="btn btn-outline-primary btn-sm" href="/signup">Create account</NavAnchor>
                <NavAnchor className="btn btn-primary btn-sm" href="/login">Login</NavAnchor>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
