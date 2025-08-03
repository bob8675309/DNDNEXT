import '../styles/globals.scss';
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Bootstrap 5 via CDN */}
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-XxHyFMCJ5zJkO+GzF9z4Fkp2Ndzy83Ei6iXYlC2JK3x03hDZZf0KL1N62h5MtrX3"
          crossOrigin="anonymous"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
          integrity="sha384-ENjdO4Dr2bkBIFxQpeoA6DQD0Xg9F1zFnfknjdf1mJvK7G2kBqKPeJ2XKZ9Gcj+J"
          crossOrigin="anonymous"
          defer
        ></script>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
