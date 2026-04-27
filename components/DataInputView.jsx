// components/DataInputView.jsx
// Manual traffic data entry → save to Supabase → run LSTM prediction
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { predictCongestion, loadModel, ROAD_SEGMENTS } from "../lib/trafficData";

const CONGESTION_COLORS = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" };
const CONGESTION_BG     = { LIGHT: "rgba(34,197,94,0.08)", MODERATE: "rgba(245,158,11,0.08)", TRAFFIC: "rgba(239,68,68,0.08)" };

const ROADS = [
  "Cajurao Street",
  "Magsaysay Boulevard",
  "Rueda Street",
  "Senator Tomas Gomez Street",
];

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const JS_DAY = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i < 12 ? "AM" : "PM";
  const h    = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: i, label: `${String(h).padStart(2,"0")}:00 ${ampm}` };
});

const EMPTY_FORM = {
  road: ROADS[0],
  day: "Monday",
  hour: 8,
  vehicle_count: "",
};

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  root: {
    flex: 1, overflowY: "auto", padding: 28,
    background: "#070d1a", color: "#e2e8f0",
    display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  card: {
    background: "#0f172a", border: "1px solid #1e3a5f",
    borderRadius: 12, padding: 22,
  },
  label: {
    fontSize: 9, color: "#475569", letterSpacing: "0.14em",
    display: "block", marginBottom: 6, textTransform: "uppercase",
  },
  select: {
    width: "100%", padding: "10px 12px", borderRadius: 7,
    background: "#0a1628", border: "1px solid #1e3a5f",
    color: "#e2e8f0", fontSize: 12, outline: "none",
    fontFamily: "inherit", cursor: "pointer",
    appearance: "none",
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: 7,
    background: "#0a1628", border: "1px solid #1e3a5f",
    color: "#e2e8f0", fontSize: 12, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  },
  btn: (active) => ({
    width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
    background: active
      ? "linear-gradient(90deg,#3b82f6,#06b6d4)"
      : "#1e293b",
    color: active ? "#fff" : "#475569",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
    cursor: active ? "pointer" : "not-allowed",
    fontFamily: "inherit", transition: "all 0.2s",
  }),
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: "#38bdf8",
    letterSpacing: "0.1em", marginBottom: 16,
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: "50%",
    background: color, boxShadow: `0 0 6px ${color}`,
    flexShrink: 0,
  }),
};

// ── Component ──────────────────────────────────────────────────────────────
export default function DataInputView() {
  const router = useRouter();
  const [user,       setUser]       = useState(null);
  const [checking,   setChecking]   = useState(true);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [status,     setStatus]     = useState("idle"); // idle | saving | predicting | done | error
  const [errorMsg,   setErrorMsg]   = useState("");
  const [prediction, setPrediction] = useState(null);
  const [logs,       setLogs]       = useState([]);      // recent entries from Supabase
  const [loadingLogs,setLoadingLogs]= useState(false);

  // ── Auth check ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUser(data.session.user); setChecking(false); }
      else              { setChecking(false); router.replace("/auth"); }
    });
  }, []);

  // ── Load recent logs on mount ──────────────────────────────────────────
  useEffect(() => {
    if (user) fetchLogs();
  }, [user]);

  async function fetchLogs() {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("traffic_logs")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(50);
    if (!error && data) setLogs(data);
    setLoadingLogs(false);
  }

  // ── Form field change ──────────────────────────────────────────────────
  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setPrediction(null);
    setStatus("idle");
    setErrorMsg("");
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const count = parseInt(form.vehicle_count);
    if (!count || count < 1 || count > 9999) {
      setErrorMsg("Please enter a valid vehicle count (1–9999).");
      return;
    }

    setStatus("saving");
    setErrorMsg("");
    setPrediction(null);

    try {
      // 1. Save to Supabase
      const { error: insertErr } = await supabase
        .from("traffic_logs")
        .insert({
          location:      form.road,
          day_of_week:   JS_DAY[form.day],
          day_name:      form.day,
          hour:          form.hour,
          vehicle_count: count,
        });

      if (insertErr) throw new Error(insertErr.message);

      // 2. Run LSTM prediction
      setStatus("predicting");
      await loadModel();

      // Query historical averages for this road+day+hour as context
      const { data: history } = await supabase
        .from("traffic_logs")
        .select("vehicle_count, hour")
        .eq("location", form.road)
        .eq("day_of_week", JS_DAY[form.day])
        .order("recorded_at", { ascending: false })
        .limit(20);

      // Use real vehicle count for this entry; fall back to history avg or input
      const pred = await predictCongestion(
        form.road,
        form.hour,
        JS_DAY[form.day],
        count
      );

      setPrediction({ ...pred, road: form.road, day: form.day, hour: form.hour, count });
      setStatus("done");

      // Refresh log table
      fetchLogs();

    } catch (err) {
      console.error("[MANUAL INPUT] Error:", err);
      setErrorMsg(err.message || "Something went wrong.");
      setStatus("error");
    }
  }

  // ── Loading / unauthed states ──────────────────────────────────────────
  if (checking) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
      background:"#070d1a", color:"#334155", fontSize:11, letterSpacing:"0.12em", fontFamily:"monospace" }}>
      VERIFYING ACCESS...
    </div>
  );
  if (!user) return null;

  const busy = status === "saving" || status === "predicting";
  const canSubmit = form.vehicle_count !== "" && !busy;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── Left: Entry form ── */}
      <div style={{ flex: "0 0 340px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Form card */}
        <div style={S.card}>
          <div style={S.sectionTitle}>✏️ LOG TRAFFIC DATA</div>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 20, lineHeight: 1.7 }}>
            Enter a vehicle count for a specific road, day, and hour.
            Each entry is saved and used to improve predictions over time.
          </div>

          {/* Road */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Road / Location</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.road}
                onChange={e => setField("road", e.target.value)}
                style={S.select}
              >
                {ROADS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#475569", pointerEvents:"none", fontSize:10 }}>▾</span>
            </div>
          </div>

          {/* Day */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Day of Week</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setField("day", d)}
                  style={{
                    padding: "8px 2px", borderRadius: 6, border: "none",
                    background: form.day === d ? "rgba(59,130,246,0.25)" : "#0a1628",
                    color: form.day === d ? "#38bdf8" : "#475569",
                    fontSize: 9, fontWeight: 700, cursor: "pointer",
                    letterSpacing: "0.05em", fontFamily: "inherit",
                    outline: form.day === d ? "1px solid #3b82f6" : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {d.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Hour */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Hour of Day</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.hour}
                onChange={e => setField("hour", Number(e.target.value))}
                style={S.select}
              >
                {HOURS.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
              <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#475569", pointerEvents:"none", fontSize:10 }}>▾</span>
            </div>
          </div>

          {/* Vehicle count */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Vehicle Count</label>
            <input
              type="number"
              min={1}
              max={9999}
              placeholder="e.g. 15"
              value={form.vehicle_count}
              onChange={e => setField("vehicle_count", e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
              style={S.input}
            />
            <div style={{ fontSize: 9, color: "#334155", marginTop: 5 }}>
              Number of vehicles counted at this road + hour
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!canSubmit} style={S.btn(canSubmit)}>
            {status === "saving"     ? "SAVING..."     :
             status === "predicting" ? "PREDICTING..."  :
             "SAVE & PREDICT →"}
          </button>

          {/* Error */}
          {status === "error" && (
            <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 7,
              background: "rgba(239,68,68,0.08)", border: "1px solid #ef444430",
              fontSize: 10, color: "#f87171", lineHeight: 1.6 }}>
              ❌ {errorMsg}
            </div>
          )}
        </div>

        {/* Prediction result card */}
        {prediction && (
          <div style={{
            ...S.card,
            background: CONGESTION_BG[prediction.label],
            border: `1px solid ${CONGESTION_COLORS[prediction.label]}40`,
          }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.14em", marginBottom: 12 }}>
              PREDICTION RESULT
            </div>

            {/* Big label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={S.dot(CONGESTION_COLORS[prediction.label])} />
              <span style={{ fontSize: 22, fontWeight: 800, color: CONGESTION_COLORS[prediction.label], letterSpacing: "0.08em" }}>
                {prediction.label}
              </span>
              <span style={{ fontSize: 12, color: "#475569", marginLeft: "auto" }}>
                {prediction.confidence}% confidence
              </span>
            </div>

            {/* Context */}
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 14, lineHeight: 1.8 }}>
              {prediction.road} · {prediction.day} · {HOURS.find(h => h.value === prediction.hour)?.label} · {prediction.count} vehicles
            </div>

            {/* Probability bars */}
            {Object.entries(prediction.probabilities).map(([cls, pct]) => (
              <div key={cls} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 4 }}>
                  <span style={{ color: CONGESTION_COLORS[cls] }}>{cls}</span>
                  <span style={{ color: "#475569" }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "#0a1628", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: CONGESTION_COLORS[cls], borderRadius: 2,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14, fontSize: 9, color: "#334155", lineHeight: 1.7 }}>
              ✅ Entry saved to database. The more data you log for this road + day + hour, the more accurate future predictions become.
            </div>
          </div>
        )}

        {/* SQL hint */}
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 8 }}>
            SUPABASE TABLE REQUIRED
          </div>
          <div style={{ fontSize: 9, color: "#1e3a5f", lineHeight: 2, fontFamily: "monospace", whiteSpace: "pre" }}>
{`create table traffic_logs (
  id            bigint generated always
                as identity primary key,
  location      text    not null,
  day_of_week   int     not null,
  day_name      text,
  hour          int     not null,
  vehicle_count int     not null,
  recorded_at   timestamptz default now()
);`}
          </div>
        </div>

      </div>

      {/* ── Right: Recent logs ── */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={S.sectionTitle}>📋 RECENT ENTRIES</div>
          <button
            onClick={fetchLogs}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #1e3a5f",
              background: "transparent", color: "#475569", fontSize: 9,
              cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em" }}>
            ↺ REFRESH
          </button>
        </div>

        {loadingLogs ? (
          <div style={{ ...S.card, textAlign: "center", color: "#334155", fontSize: 10, padding: 32 }}>
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#334155", fontSize: 11, padding: 40 }}>
            No entries yet. Log your first traffic count above!
          </div>
        ) : (
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>

            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "10px 16px", borderBottom: "1px solid #1e3a5f",
              fontSize: 8, color: "#334155", letterSpacing: "0.14em",
            }}>
              <span>LOCATION</span>
              <span>DAY</span>
              <span>HOUR</span>
              <span>VEHICLES</span>
              <span>LOGGED</span>
            </div>

            {/* Rows */}
            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {logs.map((row, i) => {
                const hourLabel = HOURS.find(h => h.value === row.hour)?.label ?? `${row.hour}:00`;
                const recorded  = new Date(row.recorded_at);
                const timeAgo   = formatTimeAgo(recorded);
                return (
                  <div key={row.id} style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                    padding: "9px 16px", borderBottom: "1px solid #0a1628",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    alignItems: "center",
                  }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{row.location}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{(row.day_name ?? DAYS[row.day_of_week])?.slice(0,3)}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{hourLabel}</span>
                    <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>{row.vehicle_count}</span>
                    <span style={{ fontSize: 9, color: "#334155" }}>{timeAgo}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "10px 16px", borderTop: "1px solid #0a1628",
              fontSize: 9, color: "#334155", textAlign: "right" }}>
              Showing latest {logs.length} entries
            </div>
          </div>
        )}

        {/* Stats by road */}
        {logs.length > 0 && (
          <div style={{ ...S.card, marginTop: 16 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", marginBottom: 14 }}>
              ENTRIES PER ROAD
            </div>
            {ROADS.map(road => {
              const count = logs.filter(l => l.location === road).length;
              const pct   = Math.round((count / logs.length) * 100);
              return (
                <div key={road} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: "#64748b" }}>{road}</span>
                    <span style={{ color: "#475569" }}>{count} entries</span>
                  </div>
                  <div style={{ height: 4, background: "#0a1628", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%",
                      background: "linear-gradient(90deg,#3b82f6,#06b6d4)", borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTimeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}