// components/Header.jsx
import { useState, useEffect } from "react";
import { DAYS_OF_WEEK } from "../lib/trafficData";

export default function Header({ activeView, onViewChange }) {
  const [time, setTime] = useState(null);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      style={{
        background: "linear-gradient(90deg, #0a0e1a 0%, #0f172a 60%, #0a1628 100%)",
        borderBottom: "1px solid #1e3a5f",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        flexShrink: 0,
        zIndex: 100,
        position: "relative",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 16px #3b82f640",
          }}
        >
          🚦
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#38bdf8",
              lineHeight: 1.2,
            }}
          >
            CALBAYOG CITY
          </div>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.15em" }}>
            LSTM TRAFFIC FLOW PREDICTION SYSTEM
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", gap: 4 }}>
        {[
          { id: "map", icon: "🗺️", label: "MAP" },
          { id: "analytics", icon: "📊", label: "ANALYTICS" },
          { id: "input", icon: "📥", label: "INPUT DATA" },
          { id: "about", icon: "ℹ️", label: "ABOUT" },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: "1px solid",
              fontSize: 10,
              letterSpacing: "0.1em",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: activeView === v.id ? "#3b82f6" : "transparent",
              color: activeView === v.id ? "#fff" : "#64748b",
              borderColor: activeView === v.id ? "#3b82f6" : "#1e3a5f",
            }}
          >
            <span>{v.icon}</span>
            {v.label}
          </button>
        ))}
      </nav>

      {/* Clock */}
      <div style={{ textAlign: "right" }}>
        {time && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.05em" }}>
              {time.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em" }}>
              {DAYS_OF_WEEK[time.getDay()].toUpperCase()},{" "}
              {time.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
