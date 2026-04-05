// components/SegmentPanel.jsx
import { getTrafficLevel, generateFullDaySeries } from "../lib/trafficData";

export default function SegmentPanel({ segment, currentHour, onClose }) {
  if (!segment) return null;

  // OSM roads fetched live won't have a series — generate one on the fly
  const series = segment.series?.length === 24
    ? segment.series
    : generateFullDaySeries(segment.baseFlow ?? 200, new Date().getDay());

  const flow    = series[currentHour]?.flow ?? segment.baseFlow ?? 200;
  const traffic = getTrafficLevel(flow);
  const peakHour = series.reduce((a, b) => (a.flow > b.flow ? a : b));
  const dailyAvg = Math.round(series.reduce((a, b) => a + b.flow, 0) / 24);

  return (
    <div
      className="animate-slideIn"
      style={{ background: "#0f172a", borderTop: "1px solid #1e3a5f", padding: "14px 20px 16px", flexShrink: 0 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 2 }}>
            {segment.name}
          </div>
          <div style={{ fontSize: 10, color: "#475569" }}>LSTM 24-HOUR FLOW PREDICTION</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: traffic.color }}>{flow.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#475569" }}>veh/hr current</div>
          </div>
          <div style={{ padding: "3px 10px", borderRadius: 5, background: traffic.bg, border: `1px solid ${traffic.color}`, color: traffic.color, fontSize: 10, letterSpacing: "0.08em" }}>
            {traffic.label.toUpperCase()}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <FlowChart series={series} currentHour={currentHour} />
        </div>
        <div style={{ width: 140, flexShrink: 0 }}>
          <MiniStat label="PEAK HOUR" value={`${String(peakHour.hour).padStart(2, "0")}:00`} color="#f59e0b" />
          <MiniStat label="PEAK FLOW" value={peakHour.flow.toLocaleString()} color="#ef4444" />
          <MiniStat label="DAILY AVG"  value={dailyAvg.toLocaleString()} color="#38bdf8" />
          {segment.avgSpeed && (
            <MiniStat label="AVG SPEED" value={`${segment.avgSpeed} km/h`} color="#22c55e" />
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 8, color: "#334155", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function FlowChart({ series, currentHour }) {
  const W = 560, H = 72;
  const pad = { l: 10, r: 10, t: 8, b: 20 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const max = Math.max(...series.map((s) => s.flow)) * 1.1 || 1;

  const getX = (i)    => pad.l + (i / 23) * w;
  const getY = (flow) => pad.t + h - (flow / max) * h;

  const pts      = series.map((s, i) => `${getX(i)},${getY(s.flow)}`).join(" ");
  const areaPath = `M ${getX(0)},${getY(series[0].flow)} `
    + series.slice(1).map((s, i) => `L ${getX(i + 1)},${getY(s.flow)}`).join(" ")
    + ` L ${getX(23)},${pad.t + h} L ${getX(0)},${pad.t + h} Z`;

  const safeHour = Math.min(currentHour, series.length - 1);
  const cx = getX(safeHour);
  const cy = getY(series[safeHour].flow);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * (1 - f)} y2={pad.t + h * (1 - f)}
          stroke="#1e3a5f" strokeWidth="0.5" />
      ))}
      <path d={areaPath} fill="url(#chartGrad)" />
      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1={cx} y1={pad.t} x2={cx} y2={pad.t + h} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,2" />
      <circle cx={cx} cy={cy} r="4" fill="#38bdf8" />
      <circle cx={cx} cy={cy} r="7" fill="#38bdf8" fillOpacity="0.2" />
      {[0, 4, 8, 12, 16, 20, 23].map((hr) => (
        <text key={hr} x={getX(hr)} y={H - 5} textAnchor="middle" fill="#334155" fontSize="8" fontFamily="monospace">
          {String(hr).padStart(2, "0")}h
        </text>
      ))}
    </svg>
  );
}
