import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const CharacterInteractionPanel = dynamic(() => import("./character/CharacterInteractionPanel"), { ssr: false });

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return true;
  if (target.isContentEditable) return true;
  return !!target.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']");
}

function characterSelectColumns() {
  return [
    "id",
    "name",
    "kind",
    "status",
    "race",
    "role",
    "description",
    "background",
    "motivation",
    "quirk",
    "mannerism",
    "voice",
    "secret",
    "affiliation",
    "location_id",
    "last_known_location_id",
    "storefront_enabled",
    "storefront_title",
    "storefront_tagline",
    "storefront_bg_url",
    "storefront_bg_video_url",
    "storefront_bg_image_url",
  ].join(",");
}

function orderCharactersByPermission(chars, permissions) {
  const byId = new Map((chars || []).map((row) => [String(row.id), row]));
  const orderedIds = (permissions || [])
    .filter((row) => row?.character_id && (row.can_edit || row.can_inventory || row.can_convert))
    .sort((a, b) => Number(Boolean(b.can_edit)) - Number(Boolean(a.can_edit)) || Number(Boolean(b.can_inventory)) - Number(Boolean(a.can_inventory)))
    .map((row) => String(row.character_id));

  for (const id of orderedIds) {
    if (byId.has(id)) return byId.get(id);
  }
  return chars?.[0] || null;
}

export default function PlayerCharacterProfilePanel() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [character, setCharacter] = useState(null);
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isLoggedIn = !!sessionUser;

  const closePanel = useCallback(() => {
    setOpen(false);
    if (!router?.isReady || router.query?.characterProfile !== "1") return;
    const nextQuery = { ...(router.query || {}) };
    delete nextQuery.characterProfile;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

  const loadLinkedCharacter = useCallback(async (user) => {
    if (!user?.id) return null;
    setLoading(true);
    setMessage("");

    try {
      const [playerResult, permissionResult, locationResult, adminResult] = await Promise.all([
        supabase.from("players").select("id,user_id,name").eq("user_id", user.id).maybeSingle(),
        supabase.from("character_permissions").select("character_id,can_inventory,can_edit,can_convert").eq("user_id", user.id),
        supabase.from("locations").select("id,name").order("name"),
        supabase.rpc("is_admin"),
      ]);

      setIsAdmin(Boolean(adminResult?.data));
      setLocations(locationResult?.data || []);

      const permissions = permissionResult?.data || [];
      const permittedIds = permissions
        .filter((row) => row?.character_id && (row.can_edit || row.can_inventory || row.can_convert))
        .map((row) => row.character_id);

      if (permittedIds.length) {
        const { data: characterRows } = await supabase
          .from("characters")
          .select(characterSelectColumns())
          .in("id", permittedIds);
        const picked = orderCharactersByPermission(characterRows || [], permissions);
        if (picked) {
          setCharacter(picked);
          setLoading(false);
          return picked;
        }
      }

      const playerName = String(playerResult?.data?.name || user?.user_metadata?.character_name || "").trim();
      if (playerName) {
        const { data: matchedCharacter } = await supabase
          .from("characters")
          .select(characterSelectColumns())
          .eq("name", playerName)
          .maybeSingle();
        if (matchedCharacter) {
          setCharacter(matchedCharacter);
          setLoading(false);
          return matchedCharacter;
        }
      }

      setCharacter(null);
      setMessage("No linked character profile was found for this account yet.");
      setLoading(false);
      return null;
    } catch (error) {
      console.warn("Failed to load linked player character profile", error);
      setCharacter(null);
      setMessage("Could not load your linked character profile.");
      setLoading(false);
      return null;
    }
  }, []);

  const openPanel = useCallback(async () => {
    if (!sessionUser) return;
    const currentCharacter = character || await loadLinkedCharacter(sessionUser);
    if (currentCharacter) setOpen(true);
    else setOpen(true);
  }, [character, loadLinkedCharacter, sessionUser]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data?.session?.user || null;
      setSessionUser(user);
      if (user) loadLinkedCharacter(user);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const user = session?.user || null;
      setSessionUser(user);
      setCharacter(null);
      setOpen(false);
      if (user) loadLinkedCharacter(user);
    });

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, [loadLinkedCharacter]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.characterProfile === "1" && isLoggedIn) openPanel();
  }, [isLoggedIn, openPanel, router.isReady, router.query?.characterProfile]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key !== "Backspace") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      if (!isLoggedIn) return;

      event.preventDefault();
      if (open) closePanel();
      else openPanel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePanel, isLoggedIn, open, openPanel]);

  const panelContent = useMemo(() => {
    if (loading && !character) {
      return <div className="npc-card m-3"><div className="text-muted">Loading linked character profile…</div></div>;
    }
    if (!character) {
      return (
        <div className="npc-card m-3">
          <div className="npc-card-title">Character Profile</div>
          <div className="text-muted">{message || "No linked character profile was found for this account yet."}</div>
        </div>
      );
    }
    return <CharacterInteractionPanel character={character} isAdmin={isAdmin} locations={locations} onClose={closePanel} initialView="profile" />;
  }, [character, closePanel, isAdmin, loading, locations, message]);

  if (!isLoggedIn || !open) return null;

  return (
    <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? closePanel() : null}>
      <div className="npc-page-profile-panel-shell">
        {panelContent}
      </div>
    </div>
  );
}
