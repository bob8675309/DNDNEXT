// pages/_app.js
import "../styles/globals.scss";
import "../styles/npc-forge.scss";
import "../styles/npc-forge-v2.css";
import "../styles/npc-forge-background-info.css";
import "../styles/card-compact.css";
import "../styles/npc-profile-panel.css";
import "../styles/npc-page-controls.css";
import "../styles/npc-shop-embedded.css";
import "../styles/npc-shop-embedded-fill.css";
import "../styles/npc-redundant-sheet-actions.css";
import "../styles/equipment-diagram.css";
import "../styles/equipment-diagram-three-column.css";
import "../styles/equipment-clean-overrides.css";
import "../styles/equipment-send-controls.css";
import "../styles/admin-build-badge.css";
import "../styles/town-profile-sidepanel-polish.css";
import "../styles/profile-craft-workspace-polish.css";
import "../styles/profile-craft-crafter-frame.css";
import "../styles/profile-portrait-bleed-overrides.css";
import "../styles/npc-crafter-panel-recipe-ui.css";
import "../styles/crafter-counter-shop.css";
import "../styles/spell-card.css";
import "../styles/spell-admin.css";
import "../styles/character-sheet-enhancements.css";
import "../styles/character-class-workspace.css";
import "../styles/profile-catalogue-workspace.css";
import AppNavbar from "../components/AppNavbar";
import AppRouteReloadGuard from "../components/AppRouteReloadGuard";
import AdminBuildBadge from "../components/AdminBuildBadge";
import PlayerCharacterProfilePanel from "../components/PlayerCharacterProfilePanel";
import Head from "next/head";
import Script from "next/script";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <AppRouteReloadGuard />
      <AppNavbar />
      <Component {...pageProps} />
      <PlayerCharacterProfilePanel />
      <AdminBuildBadge />
    </>
  );
}
