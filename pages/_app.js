// pages/_app.js
import "../styles/globals.scss";
import "../styles/card-compact.css";
import AppNavbar from "../components/AppNavbar";
import Head from "next/head";

import { useEffect } from "react";

export default function App({ Component, pageProps }) {
  // Load Bootstrap JS only in the browser to avoid "document is not defined" on server
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js").catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppNavbar />
      <Component {...pageProps} />
    </>
  );
}
