// components/AppNavbar.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

const OPEN_PLAYER_PROFILE_EVENT = "dndnext:open-player-profile";

function NavAnchor({ href, className, children }) {
  return <a className={className} href={href}>{children}</a>;
}

export default function AppNavbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    let deferredAuthTimer = null;
    let sessionRequestId = 0;

    async function applySession(session, requestId) {
      const nextUser = session?.user || null;
      if (!active || requestId !== sessionRequestId) return;
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin", { uid: nextUser.id });
        if (error) throw error;
        if (active && requestId === sessionRequestId) setIsAdmin(Boolean(data));
      } catch {
        if (active && requestId === sessionRequestId) setIsAdmin(false);
      }
    }

    function scheduleSessionWork(session) {
      if (!active) return;
      const requestId = ++sessionRequestId;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      deferredAuthTimer = setTimeout(() => {
        deferredAuthTimer = null;
        void applySession(session, requestId);
      }, 0);
    }

    void supabase.auth.getSession()
      .then(({ data }) => scheduleSessionWork(data?.session))
      .catch(() => scheduleSessionWork(null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      scheduleSessionWork(session);
    });

    return () => {
      active = false;
      sessionRequestId += 1;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function openProfilePanel() {
    if (typeof window !== "undefined") {
      const openEvent = new CustomEvent(OPEN_PLAYER_PROFILE_EVENT, { cancelable: true });
      if (!window.dispatchEvent(openEvent)) return;
    }

    if (!router?.isReady) {
      window.location.href = "/profile?characterProfile=1";
      return;
    }
    const nextQuery = { ...(router.query || {}), characterProfile: "1" };
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false })
      .catch(() => { window.location.href = "/profile?characterProfile=1"; });
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
            {user && <li className="nav-item dropdown">
              <button className="nav-link dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                Encounters
              </button>
              <ul className="dropdown-menu">
                <li><NavAnchor className="dropdown-item" href="/encounters/combat">Battle Board</NavAnchor></li>
                <li><NavAnchor className="dropdown-item" href="/encounters/play">Turn Movement</NavAnchor></li>
                {isAdmin ? <>
                  <li><hr className="dropdown-divider" /></li>
                  <li><NavAnchor className="dropdown-item" href="/encounters/live">GM Staging</NavAnchor></li>
                  <li><NavAnchor className="dropdown-item" href="/encounters">Map Workshop</NavAnchor></li>
                  <li><NavAnchor className="dropdown-item" href="/encounters/multiplayer-smoke">Multi-User Smoke Setup</NavAnchor></li>
                </> : null}
              </ul>
            </li>}
            {user && <li className="nav-item"><button type="button" className="nav-link" onClick={openProfilePanel}>Profile</button></li>}
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
