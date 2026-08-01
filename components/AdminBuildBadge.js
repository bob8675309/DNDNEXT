import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "local";

export default function AdminBuildBadge() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let deferredAuthTimer = null;
    let adminRequestId = 0;

    async function checkAdmin(uid, requestId) {
      try {
        const { data, error } = await supabase.rpc("is_admin", { uid });
        if (!cancelled && requestId === adminRequestId) {
          setIsAdmin(error ? false : Boolean(data));
        }
      } catch {
        if (!cancelled && requestId === adminRequestId) setIsAdmin(false);
      }
    }

    function scheduleAdminCheck(session) {
      if (cancelled) return;
      const requestId = ++adminRequestId;
      const uid = session?.user?.id || null;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      if (!uid) {
        setIsAdmin(false);
        return;
      }
      // Leave the Supabase auth callback before starting another client request.
      deferredAuthTimer = setTimeout(() => {
        deferredAuthTimer = null;
        void checkAdmin(uid, requestId);
      }, 0);
    }

    void supabase.auth.getSession()
      .then(({ data }) => scheduleAdminCheck(data?.session))
      .catch(() => scheduleAdminCheck(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      scheduleAdminCheck(session);
    });
    return () => {
      cancelled = true;
      adminRequestId += 1;
      if (deferredAuthTimer !== null) clearTimeout(deferredAuthTimer);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const label = useMemo(() => {
    const value = String(BUILD_VERSION || "local");
    return value.length > 12 ? value.slice(0, 12) : value;
  }, []);

  if (!isAdmin) return null;
  return <div className="admin-build-badge" title={`DNDNext build ${BUILD_VERSION}`}>Build {label}</div>;
}
