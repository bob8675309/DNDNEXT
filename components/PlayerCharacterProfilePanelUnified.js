import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { shouldAutoOpenPlayerCharacterPanel } from "../utils/playerCharacterForgeGuard";

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
    "id", "name", "kind", "status", "race", "role", "description", "background",
    "motivation", "quirk", "mannerism", "voice", "affiliation", "location_id",
    "last_known_location_id", "storefront_enabled", "storefront_title", "storefront_tagline",
    "storefront_bg_url", "storefront_bg_video_url", "storefront_bg_image_url", "portrait_url",
    "portrait_thumb_url", "portrait_library_id", "visual_asset_id", "tags",
  ].join(",");
}

function isCurrentProfileLoadRequest({ activeUserId, requestedUserId, activeRequestId, requestId }) {
  return Boolean(requestedUserId)
    && String(activeUserId || "") === String(requestedUserId)
    && Number(activeRequestId) === Number(requestId);
}

function uniqueCharacters(rows = []) {
  const found = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.id) found.set(String(row.id), row);
  }
  return [...found.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function playerCharacterLabel(character) {
  const level = Number(character?.character_sheet?.level || character?.sheet?.level || 0);
  const className = character?.character_sheet?.className || character?.character_sheet?.class || character?.role || "Adventurer";
  const details = [level ? `Level ${level}` : "", className].filter(Boolean).join(" ");
  return `${character?.name || "Unnamed Character"}${details ? ` — ${details}` : ""}`;
}

export default function PlayerCharacterProfilePanelUnified() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [character, setCharacter] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [needsCharacter, setNeedsCharacter] = useState(false);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const activeProfileUserIdRef = useRef(null);
  const profileLoadRequestRef = useRef(0);
  const selectedCharacterIdRef = useRef(null);

  const isLoggedIn = !!sessionUser;

  useEffect(() => {
    selectedCharacterIdRef.current = character?.id ? String(character.id) : null;
  }, [character?.id]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setCreatingCharacter(false);
    if (!router?.isReady || router.query?.characterProfile !== "1") return;
    const nextQuery = { ...(router.query || {}) };
    delete nextQuery.characterProfile;
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

  const loadLinkedCharacters = useCallback(async (user, preferredCharacterId = null) => {
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
      const [listResult, playerResult, permissionResult, locationResult, adminResult] = await Promise.all([
        supabase.rpc("get_my_player_characters_v2"),
        supabase.from("players").select("id,user_id,name").eq("user_id", user.id).maybeSingle(),
        supabase.from("character_permissions").select("character_id,can_inventory,can_edit,can_convert,created_at").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("locations").select("id,name").order("name"),
        supabase.rpc("is_admin"),
      ]);

      if (!isCurrentRequest()) return null;

      setIsAdmin(Boolean(adminResult?.data));
      setLocations(locationResult?.data || []);
      const resolvedPlayerName = String(playerResult?.data?.name || user?.user_metadata?.character_name || "").trim();
      setPlayerName(resolvedPlayerName);

      let rows = Array.isArray(listResult?.data) ? listResult.data : [];
      if (!rows.length) {
        const permissions = (permissionResult?.data || [])
          .filter((row) => row?.character_id && (row.can_edit || row.can_inventory || row.can_convert));
        const permittedIds = permissions.map((row) => row.character_id);
        if (permittedIds.length) {
          const { data: characterRows, error: characterError } = await supabase
            .from("characters")
            .select(characterSelectColumns())
            .in("id", permittedIds)
            .contains("tags", ["player-character"]);
          if (!isCurrentRequest()) return null;
          if (characterError) throw characterError;
          const permissionOrder = new Map(permissions.map((row, index) => [String(row.character_id), index]));
          rows = (characterRows || []).sort((a, b) => (permissionOrder.get(String(a.id)) ?? 9999) - (permissionOrder.get(String(b.id)) ?? 9999));
        }
      }

      if (!rows.length && resolvedPlayerName) {
        const { data: matchedCharacter } = await supabase
          .from("characters")
          .select(characterSelectColumns())
          .eq("name", resolvedPlayerName)
          .contains("tags", ["player-character"])
          .maybeSingle();
        if (!isCurrentRequest()) return null;
        if (matchedCharacter) rows = [matchedCharacter];
      }

      const normalized = uniqueCharacters(rows);
      const preferredId = String(preferredCharacterId || selectedCharacterIdRef.current || "");
      const selected = normalized.find((row) => String(row.id) === preferredId) || normalized[0] || null;

      setCharacters(normalized);
      setCharacter(selected);
      setNeedsCharacter(!selected);
      setCreatingCharacter(false);
      setMessage(selected ? "" : "This account does not have a linked character yet. Create one now to continue into the campaign.");
      setLoading(false);
      return selected;
    } catch (error) {
      if (!isCurrentRequest()) return null;
      console.warn("Failed to load linked player characters", error);
      setCharacters([]);
      setCharacter(null);
      setNeedsCharacter(false);
      setMessage("Could not load your linked character profiles.");
      setLoading(false);
      return null;
    }
  }, []);

  const openPanel = useCallback(async () => {
    if (!sessionUser) return;
    if (!characters.length) await loadLinkedCharacters(sessionUser);
    setOpen(true);
  }, [characters.length, loadLinkedCharacters, sessionUser]);

  const handleCharacterCreated = useCallback(async (created) => {
    if (!sessionUser) return;
    const selected = await loadLinkedCharacters(sessionUser, created?.id || null);
    if (selected) {
      setNeedsCharacter(false);
      setCreatingCharacter(false);
      setMessage("");
      setOpen(true);
    }
  }, [loadLinkedCharacters, sessionUser]);

  const beginAdditionalCharacter = useCallback(() => {
    setCreatingCharacter(true);
    setMessage("");
    setOpen(true);
  }, []);

  const cancelCreator = useCallback(() => {
    if (characters.length) {
      setCreatingCharacter(false);
      setMessage("");
      return;
    }
    closePanel();
  }, [characters.length, closePanel]);

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
      selectedCharacterIdRef.current = null;
      setSessionUser(user);
      setCharacters([]);
      setCharacter(null);
      setIsAdmin(false);
      setLocations([]);
      setPlayerName("");
      setMessage("");
      setNeedsCharacter(false);
      setCreatingCharacter(false);
      setLoading(Boolean(user));
      setOpen(false);
      if (user) void loadLinkedCharacters(user);
    }

    function scheduleSessionWork(session) {
      if (!active) return;
      const requestId = ++sessionRequestId;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      deferredAuthTimer = setTimeout(() => {
        deferredAuthTimer = null;
        applySession(session, requestId);
      }, 0);
    }

    void supabase.auth.getSession()
      .then(({ data }) => scheduleSessionWork(data?.session))
      .catch(() => scheduleSessionWork(null));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => scheduleSessionWork(session));

    return () => {
      active = false;
      sessionRequestId += 1;
      activeProfileUserIdRef.current = null;
      profileLoadRequestRef.current += 1;
      selectedCharacterIdRef.current = null;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      subscription?.subscription?.unsubscribe?.();
    };
  }, [loadLinkedCharacters]);

  useEffect(() => {
    if (router.isReady && router.query?.characterProfile === "1" && isLoggedIn) openPanel();
  }, [isLoggedIn, openPanel, router.isReady, router.query?.characterProfile]);

  useEffect(() => {
    if (shouldAutoOpenPlayerCharacterPanel({
      routerReady: router.isReady,
      pathname: router.pathname,
      isLoggedIn,
      loading,
      hasCharacter: Boolean(character),
      needsCharacter,
    })) setOpen(true);
  }, [character, isLoggedIn, loading, needsCharacter, router.isReady, router.pathname]);

  useEffect(() => {
    function onKeyDown(event) {
      const isBackspace = event.key === "Backspace" || event.code === "Backspace" || event.keyCode === 8;
      if (!isBackspace || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target) || !isLoggedIn) return;
      event.preventDefault();
      event.stopPropagation();
      if (open) closePanel();
      else openPanel();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [closePanel, isLoggedIn, open, openPanel]);

  const panelContent = useMemo(() => {
    if (loading && !character && !creatingCharacter) {
      return <div className="npc-card m-3"><div className="text-muted">Loading linked character profiles…</div></div>;
    }
    if (creatingCharacter || !character) {
      return (
        <div className="p-3 player-character-forge-host">
          {message ? <div className="alert alert-secondary py-2">{message}</div> : null}
          <PlayerCharacterCreator defaultName={character ? "" : playerName} onCreated={handleCharacterCreated} onCancel={cancelCreator} />
        </div>
      );
    }
    return (
      <>
        <div className="player-character-forge-toolbar">
          <label>
            <span>Active character</span>
            <select value={String(character.id)} onChange={(event) => {
              const next = characters.find((row) => String(row.id) === event.target.value);
              if (next) setCharacter(next);
            }}>
              {characters.map((row) => <option key={row.id} value={String(row.id)}>{playerCharacterLabel(row)}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={beginAdditionalCharacter}>Create another character</button>
        </div>
        <CharacterInteractionPanel key={character.id} character={character} isAdmin={isAdmin} locations={locations} onClose={closePanel} initialView="profile" />
      </>
    );
  }, [beginAdditionalCharacter, cancelCreator, character, characters, closePanel, creatingCharacter, handleCharacterCreated, isAdmin, loading, locations, message, playerName]);

  if (!isLoggedIn || !open) return null;
  return (
    <div className="npc-page-profile-panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget ? closePanel() : null}>
      <div className={`npc-page-profile-panel-shell ${creatingCharacter || !character ? "is-player-character-forge" : ""}`}>{panelContent}</div>
    </div>
  );
}
