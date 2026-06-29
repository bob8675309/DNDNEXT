// pages/_app.js
import "../styles/globals.scss";
import "../styles/npc-forge.scss";
import "../styles/card-compact.css";
import "../styles/npc-profile-panel.css";
import "../styles/npc-page-controls.css";
import "../styles/npc-shop-embedded.css";
import "../styles/npc-shop-embedded-fill.css";
import "../styles/equipment-diagram.css";
import "../styles/equipment-diagram-three-column.css";
import "../styles/equipment-clean-overrides.css";
import "../styles/equipment-send-controls.css";
import "../styles/admin-build-badge.css";
import "../styles/town-profile-sidepanel-polish.css";
import "../styles/profile-craft-workspace-polish.css";
import AppNavbar from "../components/AppNavbar";
import AdminBuildBadge from "../components/AdminBuildBadge";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
          defer
        ></script>
      </Head>
      <AppNavbar />
      <Component {...pageProps} />
      <AdminBuildBadge />
    </>
  );
}
