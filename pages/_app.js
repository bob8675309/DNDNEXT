import "../styles/globals.scss";
import AppNavbar from "../components/AppNavbar";
import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <AppNavbar />
      <Component {...pageProps} />
    </>
  );
}