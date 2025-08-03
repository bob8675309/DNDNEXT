// /pages/_app.js
import '/styles/global.css'; // Critical to load Tailwind


export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
