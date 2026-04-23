// pages/_app.jsx
import "../styles/globals.css";
import { useEffect, useState } from "react";

export default function App({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent SSR for all pages — auth and TF.js need browser APIs
  if (!mounted) {
    return (
      <div style={{
        width: "100vw", height: "100vh",
        background: "#030712",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#1e3a5f", fontSize: 11, letterSpacing: "0.15em",
        fontFamily: "monospace",
      }}>
        LOADING...
      </div>
    );
  }

  return <Component {...pageProps} />;
}
