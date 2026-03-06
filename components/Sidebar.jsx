// components/Sidebar.jsx
import { getTrafficLevel } from "../lib/trafficData";

export default function Sidebar({
  segments,
  selectedSegment,
  onSelectSegment,
  selectedHour,
  onHourChange,
  isPlaying,
  onTogglePlay,
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
  const heavy = currentStats.filter((s) => s.flow >= 350 && s.flow < 500).length;
  const light = currentStats.filter((s) => s.flow < 200).length;

  return (
    <aside
      style={{
        width: 270,
        background: "#0f172a",
        borderRight: "1px solid #1e3a5f",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Live stats */}
      <Section title="NETWORK STATUS">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "AVG FLOW", value: avgFlow, unit: "veh/hr", color: "#38bdf8" },
            { label: "MONITORED", value: segments.length, unit: "roads", color: "#a78bfa" },
            { label: "CONGESTED", value: congested, unit: "roads", color: "#ef4444" },
            { label: "LIGHT FLOW", value: light, unit: "roads", color: "#22c55e" },
          ].map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </Section>

      {/* Time control */}
      <Section title="TIME SIMULATION">
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "#38bdf8",
            textAlign: "center",
            letterSpacing: "0.05em",
            marginBottom: 10,
            textShadow: "0 0 20px #38bdf860",
          }}
        >
          {String(selectedHour).padStart(2, "0")}:00
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            type="range"
            min={0}
            max={23}
            value={selectedHour}
            onChange={(e) => onHourChange(+e.target.value)}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              color: "#334155",
              marginTop: 2,
            }}
          >
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>

        <button
          onClick={onTogglePlay}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 6,
            border: "1px solid",
            background: isPlaying ? "#3b82f6" : "transparent",
            color: isPlaying ? "#fff" : "#3b82f6",
            borderColor: "#3b82f6",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.2s",
          }}
        >
          <span>{isPlaying ? "⏸" : "▶"}</span>
          {isPlaying ? "PAUSE" : "PLAY SIMULATION"}
        </button>

        {isPlaying && (
          <div
            style={{
              marginTop: 6,
              textAlign: "center",
              fontSize: 9,
              color: "#3b82f6",
              letterSpacing: "0.1em",
            }}
            className="animate-pulse"
          >
            ● SIMULATING LSTM PREDICTIONS
          </div>
        )}
      </Section>

      {/* Legend */}
      <Section title="TRAFFIC LEGEND">
        {[
          { label: "Light", color: "#22c55e", range: "< 200 veh/hr" },
          { label: "Moderate", color: "#f59e0b", range: "200 – 349" },
          { label: "Heavy", color: "#f97316", range: "350 – 499" },
          { label: "Congested", color: "#ef4444", range: "≥ 500" },
        ].map((l) => (
          <div
            key={l.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 7,
            }}
          >
            <div
              style={{
                width: 28,
                height: 5,
                background: l.color,
                borderRadius: 3,
                flexShrink: 0,
                boxShadow: `0 0 6px ${l.color}80`,
              }}
            />
            <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>{l.label}</span>
            <span style={{ fontSize: 10, color: "#334155" }}>{l.range}</span>
          </div>
        ))}
      </Section>

      {/* Road list */}
      <Section title="ROAD SEGMENTS" flex>
        {currentStats.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelectSegment(s.id === selectedSegment?.id ? null : s)}
            style={{
              padding: "9px 10px",
              borderRadius: 6,
              marginBottom: 5,
              cursor: "pointer",
              border: "1px solid",
              transition: "all 0.15s",
              background:
                selectedSegment?.id === s.id
                  ? "#1e293b"
                  : "transparent",
              borderColor:
                selectedSegment?.id === s.id ? "#3b82f6" : "#1e3a5f",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#e2e8f0",
                marginBottom: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.name}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                {s.flow.toLocaleString()} veh/hr
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: s.traffic.color,
                  background: s.traffic.bg,
                  padding: "2px 7px",
                  borderRadius: 4,
                  letterSpacing: "0.06em",
                }}
              >
                {s.traffic.label.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </Section>
    </aside>
  );
}

function Section({ title, children, flex }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid #1e3a5f",
        ...(flex ? { flex: 1 } : {}),
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "#334155",
          letterSpacing: "0.15em",
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 8,
        padding: "10px 10px 8px",
        border: "1px solid #1e3a5f",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginTop: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 8, color: "#334155" }}>{unit}</div>
    </div>
  );
}
