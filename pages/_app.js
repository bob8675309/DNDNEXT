// /pages/_app.js
import '/styles/globals.css'; // Critical to load Tailwind


export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
