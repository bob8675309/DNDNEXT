// pages/_app.js
import "../styles/globals.scss";
import "../styles/npc-forge.scss";
import "../styles/card-compact.css";
import "../styles/npc-profile-panel.css";
import "../styles/equipment-diagram.css";
import "../styles/equipment-diagram-three-column.css";
import AppNavbar from "../components/AppNavbar";
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
    </>
  );
}
