import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const CharacterInteractionPanel = dynamic(() => import("./character/CharacterInteractionPanel"), { ssr: false });
const PlayerCharacterCreator = dynamic(() => import("./PlayerCharacterCreatorV2"), { ssr: false });

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

function isCurrentProfileLoadRequest({ activeUserId, requestedUserId, activeRequestId, requestId }) {
  return Boolean(requestedUserId)
    && String(activeUserId || "") === String(requestedUserId)
    && Number(activeRequestId) === Number(requestId);
}

export default function PlayerCharacterProfilePanel() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [character, setCharacter] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const activeProfileUserIdRef = useRef(null);
  const profileLoadRequestRef = useRef(0);

  const isLoggedIn = !!sessionUser;

  const closePanel = useCallback(() => {
    setOpen(false);
    if (!router?.isReady || router.query?.characterProfile !== "1") return;
    const nextQuery = { ...(router.query || {}) };
    delete nextQuery.characterProfile;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

  const loadLinkedCharacter = useCallback(async (user) => {
    const requestedUserId = String(user?.id || "");
    if (!requestedUserId || activeProfileUserIdRef.current !== requestedUserId) return null;
    const requestId = ++profileLoadRequestRef.current;
    const isCurrentRequest = () => isCurrentProfileLoadRequest({
      activeUserId: activeProfileUserIdRef.current,
      requestedUserId,
      activeRequestId: profileLoadRequestRef.current,
      requestId,
    });
    setLoading(true);
    setMessage("");

    try {
      const [canonicalResult, playerResult, permissionResult, locationResult, adminResult] = await Promise.all([
        supabase.rpc("get_my_player_character_v1"),
        supabase.from("players").select("id,user_id,name").eq("user_id", user.id).maybeSingle(),
        supabase.from("character_permissions").select("character_id,can_inventory,can_edit,can_convert").eq("user_id", user.id),
        supabase.from("locations").select("id,name").order("name"),
        supabase.rpc("is_admin"),
      ]);

      if (!isCurrentRequest()) return null;

      setIsAdmin(Boolean(adminResult?.data));
      setLocations(locationResult?.data || []);
      const resolvedPlayerName = String(playerResult?.data?.name || user?.user_metadata?.character_name || "").trim();
      setPlayerName(resolvedPlayerName);

      if (!canonicalResult.error && canonicalResult.data?.id) {
        setCharacter(canonicalResult.data);
        setLoading(false);
        return canonicalResult.data;
      }

      const permissions = permissionResult?.data || [];
      const permittedIds = permissions
        .filter((row) => row?.character_id && (row.can_edit || row.can_inventory || row.can_convert))
        .map((row) => row.character_id);

      if (permittedIds.length) {
        const { data: characterRows } = await supabase
          .from("characters")
          .select(characterSelectColumns())
          .in("id", permittedIds);
        if (!isCurrentRequest()) return null;
        const picked = orderCharactersByPermission(characterRows || [], permissions);
        if (picked) {
          setCharacter(picked);
          setLoading(false);
          return picked;
        }
      }

      if (resolvedPlayerName) {
        const { data: matchedCharacter } = await supabase
          .from("characters")
          .select(characterSelectColumns())
          .eq("name", resolvedPlayerName)
          .maybeSingle();
        if (!isCurrentRequest()) return null;
        if (matchedCharacter) {
          setCharacter(matchedCharacter);
          setLoading(false);
          return matchedCharacter;
        }
      }

      setCharacter(null);
      setMessage("Create your player character to link it to this account.");
      setLoading(false);
      return null;
    } catch (error) {
      if (!isCurrentRequest()) return null;
      console.warn("Failed to load linked player character profile", error);
      setCharacter(null);
      setMessage("Could not load your linked character profile.");
      setLoading(false);
      return null;
    }
  }, []);

  const openPanel = useCallback(async () => {
    if (!sessionUser) return;
    if (!character) await loadLinkedCharacter(sessionUser);
    setOpen(true);
  }, [character, loadLinkedCharacter, sessionUser]);

  const handleCharacterCreated = useCallback(async () => {
    if (!sessionUser) return;
    const created = await loadLinkedCharacter(sessionUser);
    if (created) {
      setMessage("");
      setOpen(true);
    }
  }, [loadLinkedCharacter, sessionUser]);

  useEffect(() => {
    let active = true;
    let deferredAuthTimer = null;
    let sessionRequestId = 0;

    function applySession(session, requestId) {
      if (!active || requestId !== sessionRequestId) return;
      const user = session?.user || null;
      const requestedUserId = user?.id ? String(user.id) : null;
      activeProfileUserIdRef.current = requestedUserId;
      profileLoadRequestRef.current += 1;
      setSessionUser(user);
      setCharacter(null);
      setIsAdmin(false);
      setLocations([]);
      setPlayerName("");
      setMessage("");
      setLoading(Boolean(user));
      setOpen(false);
      if (user) void loadLinkedCharacter(user);
    }

    function scheduleSessionWork(session) {
      if (!active) return;
      const requestId = ++sessionRequestId;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      // A macrotask begins only after Supabase releases its auth-state lock.
      deferredAuthTimer = setTimeout(() => {
        deferredAuthTimer = null;
        applySession(session, requestId);
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
      activeProfileUserIdRef.current = null;
      profileLoadRequestRef.current += 1;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      subscription?.subscription?.unsubscribe?.();
    };
  }, [loadLinkedCharacter]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.characterProfile === "1" && isLoggedIn) openPanel();
  }, [isLoggedIn, openPanel, router.isReady, router.query?.characterProfile]);

  useEffect(() => {
    function onKeyDown(event) {
      const isBackspace = event.key === "Backspace" || event.code === "Backspace" || event.keyCode === 8;
      if (!isBackspace || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      if (!isLoggedIn) return;

      event.preventDefault();
      event.stopPropagation();
      if (open) closePanel();
      else openPanel();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [closePanel, isLoggedIn, open, openPanel]);

  const panelContent = useMemo(() => {
    if (loading && !character) {
      return <div className="npc-card m-3"><div className="text-muted">Loading linked character profile…</div></div>;
    }
    if (!character) {
      return (
        <div className="p-3">
          {message ? <div className="alert alert-secondary py-2">{message}</div> : null}
          <PlayerCharacterCreator defaultName={playerName} onCreated={handleCharacterCreated} onCancel={closePanel} />
        </div>
      );
    }
    return <CharacterInteractionPanel character={character} isAdmin={isAdmin} locations={locations} onClose={closePanel} initialView="profile" />;
  }, [character, closePanel, handleCharacterCreated, isAdmin, loading, locations, message, playerName]);

  if (!isLoggedIn || !open) return null;

  return (
    <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? closePanel() : null}>
      <div className="npc-page-profile-panel-shell">
        {panelContent}
      </div>
    </div>
  );
}
