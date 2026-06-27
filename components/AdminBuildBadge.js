import { useEffect, useMemo, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "local";

export default function AdminBuildBadge() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        if (!uid) return;
        const { data, error } = await supabase.rpc("is_admin", { uid });
        if (!cancelled && !error) setIsAdmin(Boolean(data));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }
    checkAdmin();
    const { data: sub } = supabase.auth.onAuthStateChange(() => checkAdmin());
    return () => {
      cancelled = true;
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
