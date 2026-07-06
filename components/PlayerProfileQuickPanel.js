import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

function fallbackPlayerName(user) {
  const metadataName = String(user?.user_metadata?.character_name || "").trim();
  if (metadataName) return metadataName.slice(0, 80);
  const emailName = String(user?.email || "").split("@")[0].trim();
  return (emailName || "Player").slice(0, 80);
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return true;
  if (target.isContentEditable) return true;
  return !!target.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']");
}

export default function PlayerProfileQuickPanel() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [role, setRole] = useState("player");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const displayName = useMemo(() => player?.name || fallbackPlayerName(user), [player?.name, user]);
  const isLoggedIn = !!user;

  const closePanel = useCallback(() => {
    setOpen(false);

    if (!router?.isReady || !router?.query?.playerProfile) return;
    const nextQuery = { ...(router.query || {}) };
    delete nextQuery.playerProfile;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

  const loadForSession = useCallback(async (session) => {
    const nextUser = session?.user || null;
    setUser(nextUser);
    setLoading(false);

    if (!nextUser) {
      setPlayer(null);
      setRole("player");
      setOpen(false);
      return;
    }

    const [{ data: playerRow }, { data: profileRow }] = await Promise.all([
      supabase.from("players").select("id,user_id,name").eq("user_id", nextUser.id).maybeSingle(),
      supabase.from("user_profiles").select("role").eq("id", nextUser.id).maybeSingle(),
    ]);

    setPlayer(playerRow || null);
    setRole(profileRow?.role || "player");
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      loadForSession(data?.session || null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      loadForSession(session || null);
    });

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, [loadForSession]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.playerProfile === "1") setOpen(true);
  }, [router.isReady, router.query?.playerProfile]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key !== "Backspace") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      if (!isLoggedIn) return;

      event.preventDefault();
      setOpen((current) => !current);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  return (
    <>
      {open ? (
        <div className="player-profile-quick-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? closePanel() : null}>
          <aside className="player-profile-quick-panel" role="dialog" aria-modal="true" aria-label="Player character profile">
            <div className="player-profile-quick-header">
              <div>
                <div className="player-profile-quick-kicker">Player character profile</div>
                <h2>{displayName}</h2>
              </div>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={closePanel} aria-label="Close player profile">×</button>
            </div>

            <div className="player-profile-quick-body">
              <div className="player-profile-quick-row">
                <span>Account</span>
                <strong>{user?.email || "Signed in"}</strong>
              </div>
              <div className="player-profile-quick-row">
                <span>Role</span>
                <strong className="text-capitalize">{role || "player"}</strong>
              </div>
              {player?.id ? (
                <div className="player-profile-quick-row">
                  <span>Player ID</span>
                  <strong>{String(player.id).slice(0, 8)}…</strong>
                </div>
              ) : null}

              <p className="player-profile-quick-help">
                Press Backspace outside of text fields to open or close this profile from the main pages.
              </p>
            </div>

            <div className="player-profile-quick-actions">
              <Link className="btn btn-primary btn-sm" href="/profile" onClick={closePanel}>Account profile</Link>
              <Link className="btn btn-outline-light btn-sm" href="/inventory" onClick={closePanel}>Inventory</Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
