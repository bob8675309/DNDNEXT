import { useEffect } from "react";
import Head from "next/head";

/* 1) CSS order: Bootstrap first, then your globals, then merchant grid tweaks */
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/globals.scss";
import "../styles/card-compact.css";

/* If you have a top nav, keep this import exactly as you had it. */
import AppNavbar from "../components/AppNavbar";

export default function App({ Component, pageProps }) {
  /* 2) Load Bootstrap JS only on the client to avoid 'document is not defined' during SSR */
  useEffect(() => {
    import("bootstrap/dist/js/bootstrap.bundle.min.js");
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
