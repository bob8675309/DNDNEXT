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
			integrity="sha384-..."
			crossOrigin="anonymous"
	/>
        <script
		src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
			integrity="sha384-..."
			crossOrigin="anonymous"
			defer
	></script>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
