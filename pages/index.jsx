// pages/landing.jsx
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const ROADS = ["Magsaysay Boulevard", "Rueda Street", "Senator Tomas Gomez Street", "Cajurao Street"];
const STATUSES = ["LIGHT", "MODERATE", "TRAFFIC", "LIGHT", "LIGHT", "MODERATE", "TRAFFIC", "LIGHT"];
const STATUS_COLORS = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" };

function FloatingRoad({ name, status, style }) {
  return (
    <div style={{
      position: "absolute", display: "flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 20,
      background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)",
      border: `1px solid ${STATUS_COLORS[status]}30`,
      fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap",
      animation: "floatRoad 6s ease-in-out infinite",
      ...style,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: STATUS_COLORS[status],
        boxShadow: `0 0 8px ${STATUS_COLORS[status]}`,
        display: "inline-block", flexShrink: 0,
      }} />
      {name}
      <span style={{ color: STATUS_COLORS[status], fontWeight: 700, fontSize: 10 }}>{status}</span>
    </div>
  );
}

export default function Landing() {
  const router  = useRouter();
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #030712; overflow: hidden; }
      @keyframes floatRoad { 0%,100%{transform:translateY(0px);opacity:0.7} 50%{transform:translateY(-8px);opacity:1} }
      @keyframes pulse-ring { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(2.4);opacity:0} }
      @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes gridScroll { 0%{transform:translateY(0)} 100%{transform:translateY(60px)} }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      .fade-up-1{animation:fadeUp 0.8s ease forwards;animation-delay:0.2s;opacity:0}
      .fade-up-2{animation:fadeUp 0.8s ease forwards;animation-delay:0.5s;opacity:0}
      .fade-up-3{animation:fadeUp 0.8s ease forwards;animation-delay:0.8s;opacity:0}
      .fade-up-4{animation:fadeUp 0.8s ease forwards;animation-delay:1.1s;opacity:0}
      .btn-primary{padding:14px 40px;border-radius:4px;border:none;cursor:pointer;background:linear-gradient(90deg,#3b82f6,#06b6d4);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.18em;font-family:'Space Mono',monospace;transition:all 0.3s}
      .btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 30px #3b82f660}
      .btn-secondary{padding:14px 40px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid #1e3a5f;color:#475569;font-size:12px;font-weight:700;letter-spacing:0.18em;font-family:'Space Mono',monospace;transition:all 0.3s}
      .btn-secondary:hover{border-color:#3b82f6;color:#38bdf8;transform:translateY(-2px)}
      .stat-card{padding:20px 24px;border:1px solid #1e3a5f;border-radius:8px;background:rgba(15,23,42,0.6);backdrop-filter:blur(8px);transition:all 0.3s}
      .stat-card:hover{border-color:#3b82f640;transform:translateY(-3px)}
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const [tick,  setTick]  = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const t = setInterval(() => setTick(n => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const floatingRoads = [
    { name: "Magsaysay Blvd", status: "TRAFFIC",  style: { top: "18%",  left: "5%",  animationDelay: "0s"   } },
    { name: "Rueda St",       status: "MODERATE", style: { top: "35%",  right: "4%", animationDelay: "1.5s" } },
    { name: "Cajurao St",     status: "LIGHT",    style: { top: "62%",  left: "3%",  animationDelay: "3s"   } },
    { name: "T. Gomez St",    status: "MODERATE", style: { top: "78%",  right: "5%", animationDelay: "0.8s" } },
    { name: "Magsaysay Blvd", status: "LIGHT",    style: { top: "50%",  left: "6%",  animationDelay: "2.2s" } },
    { name: "Rueda St",       status: "TRAFFIC",  style: { top: "25%",  right: "6%", animationDelay: "4s"   } },
  ];

  return (
    <>
      <Head>
        <title>Calbayog City — LSTM Traffic Flow Prediction</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>



      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#030712", fontFamily: "'Syne', sans-serif" }}>

        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          animation: "gridScroll 4s linear infinite",
        }} />

        {/* Radial glow center */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          zIndex: 0,
        }} />

        {/* Top glow */}
        <div style={{
          position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 300, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 70%)",
          zIndex: 0,
        }} />

        {/* Scanline effect */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: "100%", height: 2,
            background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.06), transparent)",
            animation: "scanline 8s linear infinite",
          }} />
        </div>

        {/* Floating road tags */}
        {ready && floatingRoads.map((r, i) => (
          <FloatingRoad key={i} name={r.name} status={r.status} style={r.style} />
        ))}

        {/* Pulse rings */}
        <div style={{ position: "absolute", top: "30%", left: "20%", zIndex: 0 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              position: "absolute", width: 60, height: 60,
              border: "1px solid rgba(59,130,246,0.2)", borderRadius: "50%",
              top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              animation: `pulse-ring 3s ease-out infinite`,
              animationDelay: `${i * 1}s`,
            }} />
          ))}
        </div>
        <div style={{ position: "absolute", bottom: "25%", right: "18%", zIndex: 0 }}>
          {[0,1].map(i => (
            <div key={i} style={{
              position: "absolute", width: 40, height: 40,
              border: "1px solid rgba(6,182,212,0.15)", borderRadius: "50%",
              top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              animation: `pulse-ring 4s ease-out infinite`,
              animationDelay: `${i * 1.5}s`,
            }} />
          ))}
        </div>

        {/* Main content */}
        <div style={{
          position: "relative", zIndex: 10,
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 20px", textAlign: "center",
        }}>

          {/* Badge */}
          <div className="fade-up-1" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 20,
            border: "1px solid #1e3a5f",
            background: "rgba(59,130,246,0.06)",
            marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block", animation: "blink 2s infinite" }} />
            <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.18em", fontFamily: "'Space Mono', monospace" }}>
              SYSTEM ONLINE — CALBAYOG CITY, SAMAR
            </span>
          </div>

          {/* Title */}
          <div className="fade-up-2">
            <div style={{ fontSize: 11, color: "#334155", letterSpacing: "0.25em", marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>
              DATA-DRIVEN TRAFFIC FLOW PREDICTION SYSTEM
            </div>
            <h1 style={{
              fontSize: "clamp(38px, 6vw, 72px)", fontWeight: 800,
              lineHeight: 1.05, marginBottom: 10,
              background: "linear-gradient(135deg, #e2e8f0 0%, #38bdf8 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}>
              LSTM TRAFFIC
            </h1>
            <h1 style={{
              fontSize: "clamp(38px, 6vw, 72px)", fontWeight: 800,
              lineHeight: 1.05, marginBottom: 24,
              background: "linear-gradient(135deg, #818cf8 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}>
              PREDICTOR
            </h1>
            <p style={{
              fontSize: 14, color: "#475569", maxWidth: 480, margin: "0 auto 40px",
              lineHeight: 1.8, letterSpacing: "0.02em",
            }}>
              Real-time congestion prediction for Calbayog City road network
              using Long Short-Term Memory neural networks trained on local traffic data.
            </p>
          </div>

          {/* Buttons */}
          <div className="fade-up-3" style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 56 }}>
            <button className="btn-primary" onClick={() => router.push("/auth")}>
              SIGN IN →
            </button>
            <button className="btn-secondary" onClick={() => { router.push("/auth?mode=signup"); }}>
              CREATE ACCOUNT
            </button>
          </div>

          {/* Stats row */}
          <div className="fade-up-4" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "ROAD SEGMENTS", value: "4",      sub: "monitored" },
              { label: "MODEL ACCURACY", value: "95.4%", sub: "ALL_LOCATIONS" },
              { label: "TIME RESOLUTION", value: "15min", sub: "intervals" },
              { label: "CONGESTION LEVELS", value: "3",  sub: "LIGHT · MOD · HEAVY" },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ minWidth: 130, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8", letterSpacing: "-0.02em", fontFamily: "'Space Mono', monospace" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.15em", marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.1em", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
          borderTop: "1px solid #0f172a",
          padding: "10px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(3,7,18,0.8)", backdropFilter: "blur(8px)",
        }}>
          <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.15em", fontFamily: "'Space Mono', monospace" }}>
            GROUP 5 · THESIS PROJECT · 2025
          </span>
          <span style={{ fontSize: 9, color: "#1e3a5f", letterSpacing: "0.15em", fontFamily: "'Space Mono', monospace" }}>
            POWERED BY TENSORFLOW.JS + LSTM
          </span>
        </div>
      </div>
    </>
  );
}
