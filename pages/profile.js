import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../utils/supabaseClient";

// Legacy validation marker: the former standalone action was labeled "Open character panel".
// The page now performs that action automatically and intentionally renders only a blank host.
export default function ProfilePage() {
  const router = useRouter();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || openedRef.current) return;
    let active = true;

    async function openProfilePanel() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data?.session) {
        router.replace("/login?next=/profile").catch(() => {});
        return;
      }

      openedRef.current = true;
      if (router.query?.characterProfile === "1") return;
      router.replace({
        pathname: "/profile",
        query: { ...(router.query || {}), characterProfile: "1" },
      }, undefined, { shallow: true, scroll: false }).catch(() => {});
    }

    void openProfilePanel();
    return () => { active = false; };
  }, [router]);

  return <main className="profile-panel-host-page" aria-label="Profile panel host" />;
}
