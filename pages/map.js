import dynamic from "next/dynamic";
import React from "react";

// Map is a heavy, browser-only interactive surface (uses Bootstrap JS, pointer events,
// requestAnimationFrame, etc). Rendering it on the server has caused intermittent 500s
// in deployment. We explicitly disable SSR for this page.

const MapPageClient = dynamic(() => import("../components/MapPageClient"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 16, color: "#ddd" }}>
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return <MapPageClient />;
}
