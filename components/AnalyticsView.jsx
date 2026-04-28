// components/AnalyticsView.jsx
// Connected to simResults + selectedDay + isPlaying from dashboard
import { useMemo } from "react";
import { getTrafficLevel, getTrafficLevelFromLabel } from "../lib/trafficData";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Map LSTM label → representative vehicle/hr number for display
const LABEL_TO_FLOW = { LIGHT: 120, MODERATE: 275, TRAFFIC: 520 };

export default function AnalyticsView({ segments, selectedHour, selectedDay, simResults, isPlaying }) {
  const hasSimResults = simResults && Object.keys(simResults).length > 0;

  // Merge simResults into per-segment stats.
  // When an LSTM result exists, use its label directly for traffic level
  // so it always matches the sidebar — never re-derive it from a flow number.
  const currentStats = useMemo(() => {
    return segments.map((s) => {
      const sim = simResults?.[s.name];
      if (sim) {
        const flow    = sim.vehicleCount ?? LABEL_TO_FLOW[sim.label] ?? s.series[selectedHour]?.flow ?? s.baseFlow;
        const traffic = getTrafficLevelFromLabel(sim.label);
        return { ...s, flow, traffic, sim };
      }
      const flow = s.series[selectedHour]?.flow ?? s.baseFlow;
      return { ...s, flow, traffic: getTrafficLevel(flow), sim: null };
    });
  }, [segments, selectedHour, simResults]);

  const sorted    = [...currentStats].sort((a, b) => b.flow - a.flow);
  const totalFlow = currentStats.reduce((a, b) => a + b.flow, 0);
  const congested = currentStats.filter((s) =>
    s.sim ? s.sim.label === "TRAFFIC" : s.flow >= 500
  ).length;

  const DAYS_LABEL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  return (
    <div style={{
      flex: 1, overflowY: "auto", padding: 24,
      display: "flex", flexDirection: "column", gap: 20,
      background: "#070d1a",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.15em", marginBottom: 4 }}>
            TRAFFIC ANALYTICS
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>
            Snapshot: {String(selectedHour).padStart(2, "0")}:00
            {" — "}
            {DAYS_LABEL[selectedDay ?? new Date().getDay()]}
          </div>
        </div>

        {/* Live / static badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 20,
          border: `1px solid ${hasSimResults ? "#22c55e40" : "#1e3a5f"}`,
          background: hasSimResults ? "rgba(34,197,94,0.06)" : "transparent",
          fontSize: 9, color: hasSimResults ? "#22c55e" : "#334155",
          letterSpacing: "0.14em",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: hasSimResults ? "#22c55e" : "#334155",
            boxShadow: hasSimResults ? "0 0 6px #22c55e" : "none",
            display: "inline-block",
            animation: isPlaying && hasSimResults ? "pulse 1s ease-in-out infinite" : "none",
          }} />
          {hasSimResults
            ? (isPlaying ? "LIVE LSTM PREDICTION" : "LSTM PREDICTION LOADED")
            : "STATIC BASELINE — RUN SIMULATE TO SEE LIVE DATA"}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "TOTAL FLOW",  value: totalFlow.toLocaleString(),                      unit: "veh/hr",        color: "#38bdf8" },
          { label: "PEAK ROAD",   value: sorted[0]?.shortName ?? "—",                     unit: `${sorted[0]?.flow.toLocaleString()} v/h`,                     color: "#f97316" },
          { label: "LIGHTEST",    value: sorted[sorted.length - 1]?.shortName ?? "—",     unit: `${sorted[sorted.length-1]?.flow.toLocaleString()} v/h`,        color: "#22c55e" },
          { label: "CONGESTED",   value: congested,                                        unit: "roads",         color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#0f172a", border: "1px solid #1e3a5f",
            borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, transition: "color 0.4s" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#475569" }}>{s.unit}</div>
          </div>
        ))}
      </div>

      {/* Bar chart — live flow by road */}
      <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20 }}>
        <SectionTitle>
          TRAFFIC FLOW BY ROAD — {String(selectedHour).padStart(2, "0")}:00
          {hasSimResults && <span style={{ color: "#22c55e", marginLeft: 10, fontSize: 9 }}>● LSTM</span>}
        </SectionTitle>

        {sorted.map((s) => {
          const pct = (s.flow / Math.max(sorted[0].flow * 1.1, 1)) * 100;
          return (
            <div key={s.id} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.name}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: s.traffic.color, transition: "color 0.4s" }}>
                    {s.flow.toLocaleString()} veh/hr
                  </span>
                  <span style={{
                    fontSize: 9, color: s.traffic.color, background: s.traffic.bg,
                    padding: "1px 6px", borderRadius: 4, letterSpacing: "0.06em",
                  }}>
                    {s.traffic.label.toUpperCase()}
                  </span>
                  {/* Confidence pill — only when sim result available */}
                  {s.sim && (
                    <span style={{ fontSize: 9, color: "#475569" }}>
                      {s.sim.confidence}% conf
                    </span>
                  )}
                </div>
              </div>
              <div style={{ height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${s.traffic.color}cc, ${s.traffic.color})`,
                  borderRadius: 4,
                  transition: "width 0.5s ease, background 0.5s ease",
                  boxShadow: `0 0 8px ${s.traffic.color}60`,
                }} />
              </div>

              {/* Probability bars — only when sim result available */}
              {s.sim?.probabilities && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {Object.entries(s.sim.probabilities).map(([cls, pct]) => {
                    const clsColor = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" }[cls];
                    return (
                      <div key={cls} style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#334155", marginBottom: 2 }}>
                          <span style={{ color: clsColor }}>{cls.slice(0,3)}</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ height: 3, background: "#0a1628", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%",
                            background: clsColor, borderRadius: 2,
                            transition: "width 0.5s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!hasSimResults && (
          <div style={{
            marginTop: 8, padding: "10px 14px", borderRadius: 8,
            border: "1px dashed #1e3a5f", fontSize: 10, color: "#334155",
            textAlign: "center", lineHeight: 1.8,
          }}>
            These are baseline estimates. Run <span style={{ color: "#38bdf8" }}>Simulate &amp; Predict</span> in the sidebar to load live LSTM predictions.
          </div>
        )}
      </div>

      {/* 24h heatmap — uses static series (full day overview) */}
      <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20 }}>
        <SectionTitle>24-HOUR FLOW HEATMAP (EVERY 2 HOURS)</SectionTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 9, width: "100%", minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ color: "#475569", textAlign: "left", padding: "4px 8px", width: 130, fontWeight: 400 }}>
                  Road
                </th>
                {HOURS.filter((h) => h % 2 === 0).map((h) => (
                  <th key={h} style={{
                    color: h === selectedHour || (selectedHour % 2 !== 0 && h === selectedHour - 1) ? "#38bdf8" : "#334155",
                    padding: "4px 4px", fontWeight: (h === selectedHour) ? 700 : 400,
                    borderBottom: h === selectedHour ? "1px solid #3b82f6" : "none",
                    textAlign: "center",
                  }}>
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.id}>
                  <td style={{
                    color: "#64748b", padding: "3px 8px", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130,
                    borderRight: "1px solid #1e293b",
                  }}>
                    {seg.shortName}
                  </td>
                  {HOURS.filter((h) => h % 2 === 0).map((h) => {
                    // For the current hour column, prefer simResult flow if available
                    const isCurrentHour = h === selectedHour || (selectedHour % 2 !== 0 && h === selectedHour - 1);
                    const sim = isCurrentHour ? simResults?.[seg.name] : null;
                    const f   = sim
                      ? (sim.vehicleCount ?? LABEL_TO_FLOW[sim.label] ?? seg.series[h]?.flow ?? 0)
                      : (seg.series[h]?.flow ?? 0);
                    const t = getTrafficLevel(f);
                    return (
                      <td key={h} style={{
                        background: t.color + "33",
                        padding: "4px 2px", textAlign: "center",
                        color: t.color, fontSize: 8,
                        border: isCurrentHour ? `1px solid ${t.color}` : "1px solid transparent",
                        fontWeight: isCurrentHour ? 700 : 400,
                        transition: "background 0.4s, color 0.4s",
                      }}>
                        {f}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model info */}
      <div style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 10, padding: 20 }}>
        <SectionTitle>LSTM MODEL INFORMATION</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "MODEL TYPE",       value: "LSTM" },
            { label: "INPUT FEATURES",   value: "Time Series" },
            { label: "OUTPUT",           value: "Vehicles/Hour" },
            { label: "STUDY AREA",       value: "Calbayog City" },
            { label: "ROAD SEGMENTS",    value: `${segments.length} monitored` },
            { label: "FORECAST HORIZON", value: "24 hours" },
            { label: "PEAK MORNING",     value: "07:00 – 09:00" },
            { label: "PEAK EVENING",     value: "17:00 – 19:00" },
            { label: "DATA SOURCE",      value: "Historical Traffic" },
          ].map((m) => (
            <div key={m.label} style={{
              background: "#1e293b", borderRadius: 6, padding: "10px 12px",
              border: "1px solid #1e3a5f",
            }}>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, color: "#334155", letterSpacing: "0.12em",
      marginBottom: 16, fontWeight: 700,
      display: "flex", alignItems: "center", gap: 0,
    }}>
      {children}
    </div>
  );
}
