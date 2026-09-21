import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

const ANON_VISITOR_KEY_STORAGE = "dndnext:site-visitor-key";
const ACCOUNT_VISITOR_KEY_PREFIX = "dndnext:site-visitor-key:user:";

function generatedVisitorKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return null;
}

function storageKeyForUser(userId) {
  const normalized = String(userId || "").trim();
  return normalized ? `${ACCOUNT_VISITOR_KEY_PREFIX}${normalized}` : ANON_VISITOR_KEY_STORAGE;
}

function visitorKey(storageKey) {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(storageKey);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || "")) {
      return existing;
    }

    const created = generatedVisitorKey();
    if (!created) return null;
    window.localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return generatedVisitorKey();
  }
}

function cleanPath(value) {
  const raw = String(value || "/").split(/[?#]/, 1)[0].trim();
  if (!raw.startsWith("/")) return "/";
  return raw.slice(0, 240) || "/";
}

export default function SiteVisitTracker() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let authResolved = false;
    let activeUserId = null;
    let deferredTimer = null;
    let pendingPath = router.asPath || window.location.pathname;

    function record(pathValue) {
      if (!active || !authResolved) return;
      const key = visitorKey(storageKeyForUser(activeUserId));
      if (!key) return;

      void supabase
        .rpc("record_site_visit_v1", {
          p_visitor_key: key,
          p_path: cleanPath(pathValue),
        })
        .then(() => {})
        .catch(() => {});
    }

    function scheduleRecord(pathValue) {
      if (!active) return;
      pendingPath = pathValue || "/";
      if (!authResolved) return;
      if (deferredTimer !== null) window.clearTimeout(deferredTimer);
      deferredTimer = window.setTimeout(() => {
        deferredTimer = null;
        record(pendingPath);
      }, 0);
    }

    async function initializeAuthContext() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      activeUserId = data?.session?.user?.id || null;
      authResolved = true;
      scheduleRecord(pendingPath);
    }

    void initializeAuthContext();

    const onRouteChange = (url) => scheduleRecord(url);
    router.events.on("routeChangeComplete", onRouteChange);

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      activeUserId = session?.user?.id || null;
      authResolved = true;
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        scheduleRecord(router.asPath || window.location.pathname);
      }
    });

    return () => {
      active = false;
      if (deferredTimer !== null) window.clearTimeout(deferredTimer);
      router.events.off("routeChangeComplete", onRouteChange);
      authSubscription.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
