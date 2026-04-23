// components/AboutView.jsx
export default function AboutView() {

  const members = [
    { name: "Solitarios, Jelou",    role: "Leader",  icon: "👑" },
    { name: "Goyala, Kevin",        role: "Member",  icon: "💻" },
    { name: "Cortaga, Mark Dan",    role: "Member",  icon: "💻" },
    { name: "Dealagdon, Davenz",    role: "Member",  icon: "💻" },
  ];

  const techStack = [
    { label: "Frontend",     value: "Next.js · React · Leaflet.js" },
    { label: "ML Model",     value: "LSTM · TensorFlow / Keras" },
    { label: "Inference",    value: "TensorFlow.js (in-browser)" },
    { label: "Database",     value: "Supabase (PostgreSQL)" },
    { label: "Auth",         value: "Supabase Auth" },
    { label: "Deployment",   value: "Vercel" },
    { label: "Map Data",     value: "OpenStreetMap · Leaflet" },
    { label: "Training Data","value": "28 days · 4 roads · 15-min intervals" },
  ];

  const card = (children, style = {}) => (
    <div style={{
      background: "#0f172a", border: "1px solid #1e3a5f",
      borderRadius: 10, padding: 24, ...style,
    }}>
      {children}
    </div>
  );

  const sectionTitle = (text) => (
    <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.18em", marginBottom: 16, fontFamily: "monospace" }}>
      {text}
    </div>
  );

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: 32,
      background: "#070d1a", color: "#e2e8f0",
      display: "flex", flexDirection: "column", gap: 20,
      alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 780 }}>

        {/* Hero */}
        {card(
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚦</div>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.22em", marginBottom: 10, fontFamily: "monospace" }}>
              UNDERGRADUATE THESIS PROJECT · 2025
            </div>
            <h1 style={{
              fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800,
              lineHeight: 1.3, marginBottom: 12,
              background: "linear-gradient(135deg, #e2e8f0 0%, #38bdf8 60%, #818cf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              An Data-Driven Traffic Flow Prediction System<br />
              in Calbayog City Using LSTM
            </h1>
            <div style={{ fontSize: 12, color: "#334155", letterSpacing: "0.06em" }}>
              Northwest Samar State University
            </div>
          </div>
        )}

        {/* Team + Adviser side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Team */}
          {card(<>
            {sectionTitle("RESEARCH TEAM")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {members.map((m, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 14px", borderRadius: 8,
                  background: m.role === "Leader" ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${m.role === "Leader" ? "#3b82f630" : "#1e3a5f"}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: m.role === "Leader"
                      ? "linear-gradient(135deg,#3b82f6,#06b6d4)"
                      : "#1e293b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                    boxShadow: m.role === "Leader" ? "0 0 12px #3b82f640" : "none",
                  }}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                      {m.name}
                    </div>
                    <div style={{
                      fontSize: 9, letterSpacing: "0.12em", marginTop: 2,
                      color: m.role === "Leader" ? "#38bdf8" : "#475569",
                    }}>
                      {m.role.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>)}

          {/* Adviser + abstract */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {card(<>
              {sectionTitle("THESIS ADVISER")}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "linear-gradient(135deg,#a78bfa,#6366f1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0,
                  boxShadow: "0 0 14px #6366f140",
                }}>
                  🎓
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                    Gregor P. Diongon
                  </div>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em", marginTop: 2 }}>
                    THESIS ADVISER
                  </div>
                </div>
              </div>
            </>)}

            {card(<>
              {sectionTitle("ABSTRACT")}
              <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.8 }}>
                This study presents a data-driven traffic flow prediction system for
                Calbayog City using Long Short-Term Memory (LSTM) neural networks.
                The system predicts congestion levels — Light, Moderate, and Heavy —
                across four key road segments using historical 15-minute interval
                vehicle count data, achieving <span style={{ color: "#38bdf8", fontWeight: 700 }}>94.61% accuracy</span> on
                the combined model.
              </p>
            </>)}
          </div>
        </div>

        {/* Tech stack */}
        {card(<>
          {sectionTitle("TECHNOLOGY STACK")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {techStack.map((t, i) => (
              <div key={i} style={{ background: "#0a1628", borderRadius: 7, padding: "12px 14px" }}>
                <div style={{ fontSize: 8, color: "#334155", letterSpacing: "0.12em", marginBottom: 5, fontFamily: "monospace" }}>
                  {t.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: "#38bdf8" }}>{t.value}</div>
              </div>
            ))}
          </div>
        </>)}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#1e3a5f", letterSpacing: "0.15em", fontFamily: "monospace", paddingBottom: 8 }}>
          © 2025 GROUP 5 · NORTHWEST SAMAR STATE UNIVERSITY · ALL RIGHTS RESERVED
        </div>

      </div>
    </div>
  );
}
