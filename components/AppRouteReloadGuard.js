import { useRouter } from "next/router";
import { useEffect } from "react";

function shouldHardReload(error) {
  const text = String(error?.message || error?.name || error || "").toLowerCase();
  if (!text) return false;
  return (
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("failed to fetch") ||
    text.includes("page_load_error") ||
    text.includes("load page")
  );
}

export default function AppRouteReloadGuard() {
  const router = useRouter();

  useEffect(() => {
    function onRouteChangeError(error, url) {
      if (error?.cancelled) return;
      if (!shouldHardReload(error)) return;
      const target = typeof url === "string" && url ? url : window.location.pathname + window.location.search;
      window.location.assign(target);
    }

    router.events.on("routeChangeError", onRouteChangeError);
    return () => router.events.off("routeChangeError", onRouteChangeError);
  }, [router.events]);

  return null;
}
