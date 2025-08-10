import "@/styles/globals.scss";
import AppNavbar from "@/components/AppNavbar";
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Bootstrap 5 via CDN (no integrity or crossorigin) */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
          defer
        ></script>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
