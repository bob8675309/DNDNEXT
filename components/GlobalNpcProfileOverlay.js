import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";
import { OPEN_NPC_PROFILE_EVENT } from "../utils/npcProfileOverlay";

const CharacterInteractionPanel = dynamic(
  () => import("./character/CharacterInteractionPanel"), { ssr: false }
);

// Explicitly exclude GM-only notes, secrets, inventory and source sheet.
// The nested character panel retains its existing separate RLS-backed reads.
// This UI does NOT replace the P1.3 server-safe NPC projection.
const PROFILE_COLUMNS = [
  "id", "name", "kind", "race", "role", "affiliation", "status",
  // Names/portraits/location only. GM lore and notes are not loaded here.
  "location_id", "storefront_enabled", "portrait_url",
  "portrait_storage_path", "portrait_thumb_url", "portrait_shop_url",
  "portrait_source", "image_url", "tags"
].join(",");

export default function GlobalNpcProfileOverlay() {
  const router = useRouter();
  const [requested, setRequested] = useState(false);
  const [character, setCharacter] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const surfaceRef = useRef(null);
  const focusBeforeRef = useRef(null);

  const close = useCallback(() => {
    requestRef.current += 1; // invalidate pending profile/role reads
    setRequested(false);
    setCharacter(null);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    function onOpen(event) {
      // The NPC page is the independent GM manager; never take over its UI.
      if (router.pathname === "/npcs") return;
      const id = String(event?.detail?.characterId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;

      const currentRequest = ++requestRef.current;
      setRequested(true);
      setCharacter(null);
      setIsAdmin(false);
      setError("");
      setLoading(true);

      (async () => {
        const [rowResult, userResult] = await Promise.all([
          supabase.from("characters").select(PROFILE_COLUMNS).eq("id", id).maybeSingle(),
          supabase.auth.getUser(),
        ]);
        if (currentRequest !== requestRef.current) return;
        if (rowResult.error || !rowResult.data) {
          setError(rowResult.error?.message || "This character profile is unavailable to your account.");
          setLoading(false);
          return;
        }

        // Read actual signed-in Admin authority, never trust an event payload.
        let admin = false;
        const uid = userResult.data?.user?.id;
        if (uid) {
          const result = await supabase.rpc("is_admin", { uid });
          admin = !result.error && result.data === true;
        }
        if (currentRequest !== requestRef.current) return;
        setCharacter(rowResult.data);
        setIsAdmin(admin);
        setLoading(false);
      })().catch((cause) => {
        if (currentRequest !== requestRef.current) return;
        setError(cause?.message || "Unable to load this character profile.");
        setLoading(false);
      });
    }
    window.addEventListener(OPEN_NPC_PROFILE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NPC_PROFILE_EVENT, onOpen);
  }, [router.pathname]);

  useEffect(() => {
    if (!requested) return;
    const previousFocus = document.activeElement;
    focusBeforeRef.current = previousFocus;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    surfaceRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !surfaceRef.current) return;
      const elements = Array.from(surfaceRef.current.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter((node) => node.getClientRects().length > 0);
      if (!elements.length) { event.preventDefault(); surfaceRef.current.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surfaceRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (focusBeforeRef.current?.isConnected) focusBeforeRef.current.focus();
      focusBeforeRef.current = null;
    };
  }, [requested, close]);

  useEffect(() => {
    const onNavigate = () => close();
    router.events.on("routeChangeStart", onNavigate);
    return () => router.events.off("routeChangeStart", onNavigate);
  }, [router.events, close]);

  if (!requested) return null;

  return (
    <div className="app-npc-profile-backdrop" onMouseDown={(event) => {
      if (event.currentTarget === event.target) close();
    }}>
      <section
        className="town-profile-sidepanel app-npc-profile-shell"
        role="dialog"
        aria-modal="true"
        aria-label={character?.name ? `${character.name} character profile` : "Character profile"}
        ref={surfaceRef}
        tabIndex={-1}
      >
        {loading ? (
          <div className="app-npc-profile-status" role="status">
            Loading character profile…
            <button type="button" className="btn btn-sm btn-outline-light ms-3" onClick={close}>Close</button>
          </div>
        ) : error || !character ? (
          <div className="app-npc-profile-status" role="alert">
            <p>{error || "Profile unavailable."}</p>
            <button type="button" className="btn btn-sm btn-outline-light" onClick={close}>Close</button>
          </div>
        ) : (
          <CharacterInteractionPanel
            key={character.id}
            character={character}
            isAdmin={isAdmin}
            initialView="profile"
            onClose={close}
          />
        )}
      </section>
    </div>
  );
}
