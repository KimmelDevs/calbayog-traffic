// components/AnalyticsView.jsx
import { getTrafficLevel } from "../lib/trafficData";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function AnalyticsView({ segments, selectedHour }) {
  const currentStats = segments.map((s) => ({
    ...s,
    flow: s.series[selectedHour]?.flow ?? s.baseFlow,
    traffic: getTrafficLevel(s.series[selectedHour]?.flow ?? s.baseFlow),
  }));

  const sorted = [...currentStats].sort((a, b) => b.flow - a.flow);
  const totalFlow = currentStats.reduce((a, b) => a + b.flow, 0);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.15em", marginBottom: 4 }}>
          TRAFFIC ANALYTICS
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8" }}>
          Snapshot: {String(selectedHour).padStart(2, "0")}:00
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "TOTAL FLOW", value: totalFlow.toLocaleString(), unit: "veh/hr", color: "#38bdf8" },
          { label: "PEAK ROAD", value: sorted[0]?.shortName ?? "—", unit: `${sorted[0]?.flow.toLocaleString()} v/h`, color: "#f97316" },
          { label: "LIGHTEST", value: sorted[sorted.length - 1]?.shortName ?? "—", unit: `${sorted[sorted.length - 1]?.flow.toLocaleString()} v/h`, color: "#22c55e" },
          { label: "CONGESTED", value: currentStats.filter((s) => s.flow >= 500).length, unit: "roads", color: "#ef4444" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#0f172a",
              border: "1px solid #1e3a5f",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: "#475569" }}>{s.unit}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <SectionTitle>TRAFFIC FLOW BY ROAD SEGMENT — {String(selectedHour).padStart(2, "0")}:00</SectionTitle>
        {sorted.map((s) => {
          const pct = (s.flow / (sorted[0].flow * 1.1)) * 100;
          return (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.name}</span>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: s.traffic.color }}>
                    {s.flow.toLocaleString()} veh/hr
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: s.traffic.color,
                      background: s.traffic.bg,
                      padding: "1px 6px",
                      borderRadius: 4,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {s.traffic.label.toUpperCase()}
                  </span>
                </div>
              </div>
              <div
                style={{ height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${s.traffic.color}cc, ${s.traffic.color})`,
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                    boxShadow: `0 0 8px ${s.traffic.color}60`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Heatmap */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <SectionTitle>24-HOUR FLOW HEATMAP (EVERY 2 HOURS)</SectionTitle>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 9,
              width: "100%",
              minWidth: 700,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    color: "#475569",
                    textAlign: "left",
                    padding: "4px 8px",
                    width: 130,
                    fontWeight: 400,
                  }}
                >
                  Road
                </th>
                {HOURS.filter((h) => h % 2 === 0).map((h) => (
                  <th
                    key={h}
                    style={{
                      color: h === selectedHour ? "#38bdf8" : "#334155",
                      padding: "4px 4px",
                      fontWeight: h === selectedHour ? 700 : 400,
                      borderBottom: h === selectedHour ? "1px solid #3b82f6" : "none",
                      textAlign: "center",
                    }}
                  >
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.id}>
                  <td
                    style={{
                      color: "#64748b",
                      padding: "3px 8px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 130,
                      borderRight: "1px solid #1e293b",
                    }}
                  >
                    {seg.shortName}
                  </td>
                  {HOURS.filter((h) => h % 2 === 0).map((h) => {
                    const f = seg.series[h]?.flow ?? 0;
                    const t = getTrafficLevel(f);
                    const isActive = h === selectedHour;
                    return (
                      <td
                        key={h}
                        style={{
                          background: t.color + "33",
                          padding: "4px 2px",
                          textAlign: "center",
                          color: t.color,
                          fontSize: 8,
                          border: isActive
                            ? `1px solid ${t.color}`
                            : "1px solid transparent",
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
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
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e3a5f",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <SectionTitle>LSTM MODEL INFORMATION</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "MODEL TYPE", value: "LSTM" },
            { label: "INPUT FEATURES", value: "Time Series" },
            { label: "OUTPUT", value: "Vehicles/Hour" },
            { label: "STUDY AREA", value: "Calbayog City" },
            { label: "ROAD SEGMENTS", value: `${segments.length} monitored` },
            { label: "FORECAST HORIZON", value: "24 hours" },
            { label: "PEAK MORNING", value: "07:00 – 09:00" },
            { label: "PEAK EVENING", value: "17:00 – 19:00" },
            { label: "DATA SOURCE", value: "Historical Traffic" },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: "#1e293b",
                borderRadius: 6,
                padding: "10px 12px",
                border: "1px solid #1e3a5f",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#334155",
                  letterSpacing: "0.1em",
                  marginBottom: 4,
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700 }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "#334155",
        letterSpacing: "0.12em",
        marginBottom: 16,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}
