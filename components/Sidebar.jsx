// components/Sidebar.jsx
import { getTrafficLevel } from "../lib/trafficData";

const DAYS_LABEL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const CONGESTION_COLORS = { LIGHT:"#22c55e", MODERATE:"#f59e0b", TRAFFIC:"#ef4444" };

export default function Sidebar({
  segments,
  selectedSegment,
  onSelectSegment,
  selectedHour,
  onHourChange,
  isPlaying,
  onTogglePlay,
  selectedDay,
  onDayChange,
  selectedDate,
  onDateChange,
  onSimulate,
  simResults,
  simLoading,
}) {
  const currentStats = segments.map((s) => ({
    ...s,
    flow: s.series[selectedHour]?.flow ?? s.baseFlow,
    traffic: getTrafficLevel(s.series[selectedHour]?.flow ?? s.baseFlow),
  }));

  const avgFlow = Math.round(
    currentStats.reduce((a, b) => a + b.flow, 0) / currentStats.length
  );
  const congested = currentStats.filter((s) => s.flow >= 500).length;
  const light = currentStats.filter((s) => s.flow < 200).length;

  const hasResults = simResults && Object.keys(simResults).length > 0;

  return (
    <aside style={{ width: 270, background: "#0f172a", borderRight: "1px solid #1e3a5f", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      <Section title="NETWORK STATUS">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "AVG FLOW",  value: avgFlow,          unit: "veh/hr", color: "#38bdf8" },
            { label: "MONITORED", value: segments.length,  unit: "roads",  color: "#a78bfa" },
            { label: "CONGESTED", value: congested,        unit: "roads",  color: "#ef4444" },
            { label: "LIGHT FLOW",value: light,            unit: "roads",  color: "#22c55e" },
          ].map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      </Section>

      <Section title="TIME SIMULATION & LSTM PREDICT">
        <div style={{ fontSize: 36, fontWeight: 700, color: "#38bdf8", textAlign: "center", letterSpacing: "0.05em", marginBottom: 10, textShadow: "0 0 20px #38bdf860" }}>
          {String(selectedHour).padStart(2, "0")}:00
        </div>

        <div style={{ marginBottom: 10 }}>
          <input type="range" min={0} max={23} value={selectedHour}
            onChange={(e) => onHourChange(+e.target.value)}
            style={{ width: "100%", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#334155", marginTop: 2 }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
          </div>
        </div>

        {/* Play is locked until Simulate has been run */}
        {(() => {
          const canPlay = hasResults;
          return (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={canPlay ? onTogglePlay : undefined}
                disabled={!canPlay}
                title={!canPlay ? "Run Simulate & Predict first" : ""}
                style={{
                  width: "100%", padding: "8px", borderRadius: 6, border: "1px solid",
                  background: !canPlay ? "#0f172a" : isPlaying ? "#3b82f6" : "transparent",
                  color: !canPlay ? "#334155" : isPlaying ? "#fff" : "#3b82f6",
                  borderColor: !canPlay ? "#1e293b" : "#3b82f6",
                  fontSize: 11,
                  cursor: !canPlay ? "not-allowed" : "pointer",
                  fontFamily: "inherit", letterSpacing: "0.1em",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.2s",
                  opacity: !canPlay ? 0.45 : 1,
                }}
              >
                <span>{isPlaying ? "⏸" : "▶"}</span>
                {isPlaying ? "PAUSE" : "PLAY SIMULATION"}
              </button>
              {!canPlay && (
                <div style={{ marginTop: 5, fontSize: 9, color: "#334155", textAlign: "center", letterSpacing: "0.08em" }}>
                  ↓ run simulate & predict first
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ borderTop: "1px solid #1e3a5f", marginBottom: 12 }} />

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>PREDICT DATE</div>
          <input
            type="date"
            value={selectedDate ?? ""}
            onChange={(e) => onDateChange(e.target.value)}
            style={{
              width: "100%", background: "#1e293b", border: "1px solid #1e3a5f",
              borderRadius: 5, padding: "6px 8px", fontSize: 11, color: "#94a3b8",
              fontFamily: "inherit", cursor: "pointer",
              colorScheme: "dark", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>PREDICT DAY</div>
          <select value={selectedDay} onChange={(e) => onDayChange(Number(e.target.value))}
            style={{ width: "100%", background: "#1e293b", border: "1px solid #1e3a5f", borderRadius: 5, padding: "6px 8px", fontSize: 11, color: "#94a3b8", fontFamily: "inherit", cursor: "pointer" }}>
            {DAYS_LABEL.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>

        <button onClick={onSimulate} disabled={simLoading} style={{
          width: "100%", padding: "9px 0", borderRadius: 6, border: "none",
          background: simLoading ? "#1e293b" : "linear-gradient(90deg,#3b82f6,#06b6d4)",
          color: simLoading ? "#475569" : "#fff",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: simLoading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s",
        }}>
          {simLoading ? "🔮 PREDICTING ALL ROADS..." : "🔮 SIMULATE & PREDICT"}
        </button>

        {simLoading && (
          <div style={{ marginTop: 6, textAlign: "center", fontSize: 9, color: "#3b82f6", letterSpacing: "0.1em" }} className="animate-pulse">
            ● RUNNING LSTM ON ALL ROADS
          </div>
        )}

        {hasResults && !simLoading && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em", marginBottom: 6 }}>
              PREDICTIONS — {DAYS_LABEL[selectedDay]?.toUpperCase()} {String(selectedHour).padStart(2,"0")}:00
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 8, color: "#38bdf8", background: "#38bdf810", border: "1px solid #38bdf830", padding: "2px 6px", borderRadius: 3 }}>
                🔮 LSTM: {Object.values(simResults).filter(r => !r.simulated).length} roads
              </span>
              <span style={{ fontSize: 8, color: "#475569", background: "#1e293b", border: "1px solid #334155", padding: "2px 6px", borderRadius: 3 }}>
                SIM: {Object.values(simResults).filter(r => r.simulated).length} roads
              </span>
            </div>
            {Object.entries(simResults).map(([name, result]) => {
              const color = CONGESTION_COLORS[result.label] ?? "#94a3b8";
              const shortName = name.length > 22 ? name.slice(0, 22) + "…" : name;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, padding: "5px 8px", borderRadius: 5, background: color + "10", border: `1px solid ${color}25` }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />
                  <span style={{ fontSize: 9, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{shortName}</span>
                  <span style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0 }}>{result.label}</span>
                  <span style={{ fontSize: 8, color: "#475569", flexShrink: 0 }}>{result.confidence}%</span>
                  <span style={{ fontSize: 7, color: result.simulated ? "#475569" : "#38bdf8", background: result.simulated ? "#1e293b" : "#38bdf810", padding: "1px 4px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.04em", border: result.simulated ? "1px solid #334155" : "1px solid #38bdf830" }}>{result.simulated ? "SIM" : "LSTM"}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="TRAFFIC LEGEND">
        {[
          { label: "Light",     color: "#22c55e", range: "< 200 veh/hr" },
          { label: "Moderate",  color: "#f59e0b", range: "200 – 349" },
          { label: "Heavy",     color: "#f97316", range: "350 – 499" },
          { label: "Congested", color: "#ef4444", range: "≥ 500" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <div style={{ width: 28, height: 5, background: l.color, borderRadius: 3, flexShrink: 0, boxShadow: `0 0 6px ${l.color}80` }} />
            <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>{l.label}</span>
            <span style={{ fontSize: 10, color: "#334155" }}>{l.range}</span>
          </div>
        ))}
      </Section>

      <Section title="ROAD SEGMENTS" flex>
        {currentStats.map((s) => {
          const pred = simResults?.[s.name];
          const predColor = pred ? (CONGESTION_COLORS[pred.label] ?? null) : null;
          return (
            <div key={s.id} onClick={() => onSelectSegment(s.id === selectedSegment?.id ? null : s)}
              style={{ padding: "9px 10px", borderRadius: 6, marginBottom: 5, cursor: "pointer", border: "1px solid", transition: "all 0.15s",
                background: selectedSegment?.id === s.id ? "#1e293b" : "transparent",
                borderColor: selectedSegment?.id === s.id ? "#3b82f6" : "#1e3a5f" }}>
              <div style={{ fontSize: 11, color: "#e2e8f0", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.name}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{s.flow.toLocaleString()} veh/hr</span>
                <span style={{ fontSize: 9, color: s.traffic.color, background: s.traffic.bg, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.06em" }}>
                  {s.traffic.label.toUpperCase()}
                </span>
                {pred && (
                  <span style={{ fontSize: 8, color: predColor, background: predColor + "18", padding: "2px 5px", borderRadius: 4, letterSpacing: "0.05em", border: `1px solid ${predColor}40`, flexShrink: 0 }}>
                    🔮 {pred.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Section>
    </aside>
  );
}

function Section({ title, children, flex }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e3a5f", ...(flex ? { flex: 1 } : {}) }}>
      <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.15em", marginBottom: 10, fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 10px 8px", border: "1px solid #1e3a5f" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginTop: 3 }}>{label}</div>
      <div style={{ fontSize: 8, color: "#334155" }}>{unit}</div>
    </div>
  );
}