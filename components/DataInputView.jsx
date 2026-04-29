// components/DataInputView.jsx
// Manual traffic data entry → save to Supabase → run LSTM prediction
// ⚠️  ADMIN ONLY — access is gated by the `user_roles` table in Supabase.
import { useState, useEffect, useRef } from "react";
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

// 96 slots: every 15 minutes from 00:00 to 23:45
const SLOTS = Array.from({ length: 96 }, (_, i) => {
  const totalMins = i * 15;
  const hour24    = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const ampm      = hour24 < 12 ? "AM" : "PM";
  const h12       = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const value     = hour24 + mins / 60;
  const label     = `${String(h12).padStart(2,"0")}:${String(mins).padStart(2,"0")} ${ampm}`;
  return { value, label };
});

// Returns today as "YYYY-MM-DD" in local time
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" +
    String(d.getMonth()+1).padStart(2,"0") + "-" +
    String(d.getDate()).padStart(2,"0");
}

// Derive day-of-week from a "YYYY-MM-DD" string (avoids UTC shift)
function parseDateField(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dayIndex: dt.getDay(),
    dayName:  DAYS[dt.getDay()],
  };
}

const EMPTY_FORM = {
  road:          ROADS[0],
  date:          todayStr(),
  hour:          8,
  vehicle_count: "",
  is_anomaly:    false,
  event_note:    "",
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

// ── Access-denied screen ────────────────────────────────────────────────────
function AccessDenied() {
  const router = useRouter();
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: "#070d1a", flexDirection: "column", gap: 18,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid #ef444440",
        borderRadius: 12, padding: "36px 48px", textAlign: "center", maxWidth: 420,
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", letterSpacing: "0.12em", marginBottom: 10 }}>
          ADMIN ACCESS REQUIRED
        </div>
        <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.8, marginBottom: 24 }}>
          The Data Input module is restricted to administrators only.
          Contact your system administrator if you need access.
        </div>
        <button
          onClick={() => router.replace("/dashboard")}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "linear-gradient(90deg,#3b82f6,#06b6d4)",
            color: "#fff", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.12em", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← BACK TO DASHBOARD
        </button>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DataInputView() {
  const router = useRouter();
  const [user,        setUser]        = useState(null);
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [checking,    setChecking]    = useState(true);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [status,      setStatus]      = useState("idle"); // idle | saving | predicting | done | error
  const [errorMsg,    setErrorMsg]    = useState("");
  const [prediction,  setPrediction]  = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── Excel upload state ─────────────────────────────────────────────────
  const xlsxInputRef = useRef(null);
  const [xlsxStatus,   setXlsxStatus]   = useState("idle"); // idle | parsing | uploading | done | error
  const [xlsxMsg,      setXlsxMsg]      = useState("");
  const [xlsxPreview,  setXlsxPreview]  = useState([]);
  const [xlsxRows,     setXlsxRows]     = useState([]);
  const [xlsxFileName, setXlsxFileName] = useState("");

  // ── Auth + admin-role check ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/auth");
        return;
      }

      const currentUser = data.session.user;
      setUser(currentUser);

      const metaRole = currentUser.user_metadata?.role;
      if (metaRole === "admin") {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .single();

      if (!roleErr && roleRow?.role === "admin") {
        setIsAdmin(true);
      }

      setChecking(false);
    })();
  }, []);

  // ── Load recent logs (admin only) ──────────────────────────────────────
  useEffect(() => {
    if (user && isAdmin) fetchLogs();
  }, [user, isAdmin]);

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

  // ── Load SheetJS via script tag ────────────────────────────────────────
  const [xlsxLib, setXlsxLib] = useState(null);
  useEffect(() => {
    if (window.XLSX) { setXlsxLib(window.XLSX); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => setXlsxLib(window.XLSX);
    document.head.appendChild(script);
  }, []);

  // ── Excel parse ────────────────────────────────────────────────────────
  async function parseXlsx(file) {
    if (!xlsxLib) { setXlsxStatus("error"); setXlsxMsg("SheetJS not loaded yet, please try again."); return; }
    setXlsxStatus("parsing");
    setXlsxMsg("");
    setXlsxPreview([]);
    setXlsxRows([]);
    setXlsxFileName(file.name);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = xlsxLib.read(buf, { type: "array", cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = xlsxLib.utils.sheet_to_json(ws, { defval: "" });

      const norm = (s) => String(s).toLowerCase().replace(/[\s_\-\/]+/g, "_");

      const parsed = [];
      const errors = [];

      for (let i = 0; i < raw.length; i++) {
        const row  = raw[i];
        const keys = Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k), v]));

        const location = keys["location"] || keys["road"] || keys["road_location"] || "";
        const dateRaw  = keys["date"] || keys["recorded_date"] || keys["log_date"] || "";
        const hourRaw  = keys["hour"] || keys["time_slot"] || keys["time"] || "";
        const countRaw = keys["vehicle_count"] || keys["vehicles"] || keys["count"] || keys["vehicle"] || "";
        const anomaly  = keys["is_anomaly"] || keys["anomaly"] || keys["event"] || "";
        const note     = keys["event_note"] || keys["note"] || keys["description"] || "";

        if (!location || !dateRaw || countRaw === "") {
          errors.push(`Row ${i + 2}: missing location, date, or vehicle_count`);
          continue;
        }

        let dateStr;
        if (dateRaw instanceof Date) {
          const d = dateRaw;
          dateStr = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
        } else {
          const d = new Date(dateRaw);
          if (isNaN(d)) { errors.push(`Row ${i + 2}: invalid date "${dateRaw}"`); continue; }
          dateStr = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
        }

        let hour;
        if (typeof hourRaw === "number") {
          hour = hourRaw;
        } else {
          const h = String(hourRaw).trim();
          const ampmMatch = h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (ampmMatch) {
            let hh = parseInt(ampmMatch[1]);
            const mm = parseInt(ampmMatch[2]);
            const ap = (ampmMatch[3] || "").toUpperCase();
            if (ap === "PM" && hh < 12) hh += 12;
            if (ap === "AM" && hh === 12) hh = 0;
            hour = hh + mm / 60;
          } else {
            hour = parseFloat(h);
          }
        }
        if (isNaN(hour) || hour < 0 || hour >= 24) {
          errors.push(`Row ${i + 2}: invalid hour "${hourRaw}"`);
          continue;
        }
        hour = Math.round(hour * 4) / 4;

        const count = parseInt(countRaw);
        if (isNaN(count) || count < 1 || count > 9999) {
          errors.push(`Row ${i + 2}: invalid vehicle_count "${countRaw}"`);
          continue;
        }

        const [y, m, d2] = dateStr.split("-").map(Number);
        const dt = new Date(y, m - 1, d2);
        const dayIndex = dt.getDay();
        const slotHour = Math.floor(hour);
        const slotMin  = Math.round((hour - slotHour) * 60);
        const recordedAt = new Date(y, m - 1, d2, slotHour, slotMin).toISOString();
        const isAnomalyBool = ["1","true","yes","y"].includes(String(anomaly).toLowerCase().trim());

        parsed.push({
          location:      String(location).trim(),
          date:          dateStr,
          day_of_week:   dayIndex,
          day_name:      DAYS[dayIndex],
          hour,
          vehicle_count: count,
          recorded_at:   recordedAt,
          is_anomaly:    isAnomalyBool,
          event_note:    isAnomalyBool ? String(note).trim() || null : null,
        });
      }

      if (parsed.length === 0) {
        setXlsxStatus("error");
        setXlsxMsg(`No valid rows found. ${errors.slice(0,3).join("; ")}`);
        return;
      }

      setXlsxRows(parsed);
      setXlsxPreview(parsed.slice(0, 5));
      setXlsxStatus("idle");
      const warn = errors.length > 0 ? ` (${errors.length} rows skipped)` : "";
      setXlsxMsg(`✅ Parsed ${parsed.length} valid rows${warn}. Review below then click Upload.`);
    } catch (err) {
      setXlsxStatus("error");
      setXlsxMsg("Failed to parse file: " + err.message);
    }
  }

  async function handleXlsxUpload() {
    if (xlsxRows.length === 0) return;
    setXlsxStatus("uploading");
    setXlsxMsg("");
    try {
      const CHUNK = 100;
      let inserted = 0;
      for (let i = 0; i < xlsxRows.length; i += CHUNK) {
        const chunk = xlsxRows.slice(i, i + CHUNK);
        const { error } = await supabase.from("traffic_logs").insert(chunk);
        if (error) throw new Error(error.message);
        inserted += chunk.length;
        setXlsxMsg(`Uploading... ${inserted}/${xlsxRows.length}`);
      }
      setXlsxStatus("done");
      setXlsxMsg(`✅ Successfully uploaded ${xlsxRows.length} rows to the database.`);
      setXlsxRows([]);
      setXlsxPreview([]);
      setXlsxFileName("");
      fetchLogs();
    } catch (err) {
      setXlsxStatus("error");
      setXlsxMsg("Upload failed: " + err.message);
    }
  }

  // ── Submit (manual entry) ──────────────────────────────────────────────
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
      const { dayIndex, dayName } = parseDateField(form.date);
      const [y, m, d] = form.date.split("-").map(Number);
      const slotHour  = Math.floor(form.hour);
      const slotMin   = Math.round((form.hour - slotHour) * 60);
      const recordedAt = new Date(y, m - 1, d, slotHour, slotMin).toISOString();

      const { error: insertErr } = await supabase
        .from("traffic_logs")
        .insert({
          location:      form.road,
          date:          form.date,       // ← now recorded
          day_of_week:   dayIndex,
          day_name:      dayName,
          hour:          form.hour,
          vehicle_count: count,
          recorded_at:   recordedAt,
          is_anomaly:    form.is_anomaly ? true : false,
          event_note:    form.is_anomaly ? form.event_note.trim() : null,
        });

      if (insertErr) throw new Error(insertErr.message);

      // 2. Run LSTM prediction
      setStatus("predicting");
      await loadModel();

      const { dayIndex: histDayIdx } = parseDateField(form.date);
      const { data: history } = await supabase
        .from("traffic_logs")
        .select("vehicle_count, hour")
        .eq("location", form.road)
        .eq("day_of_week", histDayIdx)
        .order("recorded_at", { ascending: false })
        .limit(20);

      const { dayIndex: predDayIdx, dayName: predDayName } = parseDateField(form.date);
      const pred = await predictCongestion(
        form.road,
        form.hour,
        predDayIdx,
        count,
        form.is_anomaly ? 1 : 0
      );

      setPrediction({ ...pred, road: form.road, day: predDayName, date: form.date, hour: form.hour, count, is_anomaly: form.is_anomaly, event_note: form.event_note });
      setStatus("done");

      fetchLogs();

    } catch (err) {
      console.error("[MANUAL INPUT] Error:", err);
      setErrorMsg(err.message || "Something went wrong.");
      setStatus("error");
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (checking) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
      background:"#070d1a", color:"#334155", fontSize:11, letterSpacing:"0.12em", fontFamily:"monospace" }}>
      VERIFYING ACCESS...
    </div>
  );

  if (!isAdmin) return <AccessDenied />;

  const busy = status === "saving" || status === "predicting";
  const canSubmit = form.vehicle_count !== "" && !busy;

  // ── Render (admin view) ────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── Admin badge ── */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
        marginBottom: -8, fontSize: 9, color: "#22c55e", letterSpacing: "0.15em" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
          boxShadow: "0 0 6px #22c55e", display: "inline-block" }} />
        ADMIN MODE — DATA INPUT ENABLED
      </div>

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

          {/* Date picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Date</label>
            <input
              type="date"
              value={form.date}
              max={todayStr()}
              onChange={e => setField("date", e.target.value)}
              style={{ ...S.input, colorScheme: "dark" }}
            />
            {form.date && (
              <div style={{ fontSize: 9, color: "#475569", marginTop: 5 }}>
                {parseDateField(form.date).dayName}
                {" · "}
                {new Date(...form.date.split("-").map((v,i)=>i===1?Number(v)-1:Number(v)))
                  .toLocaleDateString("en-PH", { month:"long", day:"numeric", year:"numeric" })}
              </div>
            )}
          </div>

          {/* Time Slot */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Time (15-min intervals)</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.hour}
                onChange={e => setField("hour", Number(e.target.value))}
                style={S.select}
              >
                {SLOTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#475569", pointerEvents:"none", fontSize:10 }}>▾</span>
            </div>
          </div>

          {/* Anomaly toggle */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Event / Anomaly</label>
            <button
              type="button"
              onClick={() => setField("is_anomaly", !form.is_anomaly)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 7,
                border: `1px solid ${form.is_anomaly ? "#f59e0b" : "#1e3a5f"}`,
                background: form.is_anomaly ? "rgba(245,158,11,0.10)" : "#0a1628",
                color: form.is_anomaly ? "#f59e0b" : "#475569",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: "0.1em",
                display: "flex", alignItems: "center", gap: 10,
                transition: "all 0.2s",
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: `2px solid ${form.is_anomaly ? "#f59e0b" : "#1e3a5f"}`,
                background: form.is_anomaly ? "#f59e0b" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#0a1628", transition: "all 0.2s",
                flexShrink: 0,
              }}>
                {form.is_anomaly ? "✓" : ""}
              </span>
              {form.is_anomaly ? "⚠️ ANOMALY FLAGGED" : "FLAG AS ANOMALY"}
            </button>
            <div style={{ fontSize: 9, color: "#334155", marginTop: 5 }}>
              Flag if an event (fiesta, election, road work, accident) is affecting traffic on this date.
            </div>
          </div>

          {/* Event note */}
          {form.is_anomaly && (
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Event Description</label>
              <input
                type="text"
                placeholder="e.g. Calbayog Fiesta, road closure, heavy rain..."
                value={form.event_note}
                maxLength={120}
                onChange={e => setField("event_note", e.target.value)}
                style={{ ...S.input, borderColor: "#f59e0b" }}
              />
              <div style={{ fontSize: 9, color: "#475569", marginTop: 5 }}>
                This is saved alongside the entry and passed to the LSTM as an anomaly signal.
              </div>
            </div>
          )}

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
            {status === "saving"     ? "SAVING..."      :
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

        {/* Excel Upload card */}
        <div style={S.card}>
          <div style={S.sectionTitle}>📊 BULK UPLOAD VIA EXCEL</div>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 16, lineHeight: 1.7 }}>
            Upload a <strong style={{ color: "#38bdf8" }}>.xlsx</strong> file with columns:{" "}
            <span style={{ color: "#64748b" }}>location, date, hour, vehicle_count</span>
            <br />Optional: <span style={{ color: "#64748b" }}>is_anomaly (true/false), event_note</span>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => xlsxInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#38bdf8"; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = "#1e3a5f"; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "#1e3a5f";
              const file = e.dataTransfer.files[0];
              if (file) parseXlsx(file);
            }}
            style={{
              border: "2px dashed #1e3a5f", borderRadius: 8,
              padding: "24px 16px", textAlign: "center",
              cursor: "pointer", transition: "border-color 0.2s",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              {xlsxFileName
                ? <span style={{ color: "#38bdf8" }}>📄 {xlsxFileName}</span>
                : "Click or drag & drop an .xlsx file here"}
            </div>
            <div style={{ fontSize: 9, color: "#334155", marginTop: 4 }}>Accepts .xlsx files only</div>
          </div>
          <input
            ref={xlsxInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files[0]; if (f) parseXlsx(f); e.target.value = ""; }}
          />

          {/* Status message */}
          {xlsxMsg && (
            <div style={{
              padding: "8px 12px", borderRadius: 6, fontSize: 10, lineHeight: 1.6, marginBottom: 12,
              background: xlsxStatus === "error" ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
              border: `1px solid ${xlsxStatus === "error" ? "#ef444430" : "#22c55e30"}`,
              color: xlsxStatus === "error" ? "#f87171" : "#86efac",
            }}>
              {xlsxMsg}
            </div>
          )}

          {/* Preview table */}
          {xlsxPreview.length > 0 && (
            <div style={{ marginBottom: 12, border: "1px solid #1e3a5f", borderRadius: 6, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "7px 10px", background: "#0a1628",
                fontSize: 8, color: "#334155", letterSpacing: "0.12em",
              }}>
                <span>LOCATION</span><span>DATE</span><span>HOUR</span><span>VEHICLES</span><span>ANOMALY</span>
              </div>
              {xlsxPreview.map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  padding: "6px 10px", borderTop: "1px solid #0a1628",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  fontSize: 10, alignItems: "center",
                }}>
                  <span style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.location}</span>
                  <span style={{ color: "#64748b" }}>{row.date}</span>
                  <span style={{ color: "#64748b" }}>{SLOTS.find(s => s.value === row.hour)?.label ?? row.hour}</span>
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>{row.vehicle_count}</span>
                  <span style={{ color: row.is_anomaly ? "#f59e0b" : "#334155" }}>
                    {row.is_anomaly ? "⚠️ yes" : "—"}
                  </span>
                </div>
              ))}
              {xlsxRows.length > 5 && (
                <div style={{ padding: "6px 10px", fontSize: 9, color: "#334155", borderTop: "1px solid #0a1628" }}>
                  + {xlsxRows.length - 5} more rows
                </div>
              )}
            </div>
          )}

          {/* Upload button */}
          {xlsxRows.length > 0 && (
            <button
              onClick={handleXlsxUpload}
              disabled={xlsxStatus === "uploading"}
              style={S.btn(xlsxStatus !== "uploading")}
            >
              {xlsxStatus === "uploading"
                ? xlsxMsg || "UPLOADING..."
                : `UPLOAD ${xlsxRows.length} ROWS →`}
            </button>
          )}

          {/* Column hint */}
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 6,
            background: "#0a1628", border: "1px solid #0f2d4a", fontSize: 9, color: "#334155", lineHeight: 1.9 }}>
            <div style={{ color: "#475569", marginBottom: 4, letterSpacing: "0.1em" }}>EXPECTED COLUMN HEADERS</div>
            <span style={{ color: "#38bdf8" }}>location</span> · <span style={{ color: "#38bdf8" }}>date</span> · <span style={{ color: "#38bdf8" }}>hour</span> · <span style={{ color: "#38bdf8" }}>vehicle_count</span>
            <br />
            <span style={{ color: "#1e3a5f" }}>is_anomaly (TRUE/FALSE) · event_note</span>
            <br /><br />
            <span style={{ color: "#1e3a5f" }}>Hour formats accepted: <strong style={{color:"#334155"}}>8, 8.25, 08:00, 8:15 AM</strong></span>
          </div>
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={S.dot(CONGESTION_COLORS[prediction.label])} />
              <span style={{ fontSize: 22, fontWeight: 800, color: CONGESTION_COLORS[prediction.label], letterSpacing: "0.08em" }}>
                {prediction.label}
              </span>
              <span style={{ fontSize: 12, color: "#475569", marginLeft: "auto" }}>
                {prediction.confidence}% confidence
              </span>
            </div>

            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 14, lineHeight: 1.8 }}>
              {prediction.road} · {prediction.date} · {prediction.day} · {SLOTS.find(s => s.value === prediction.hour)?.label} · {prediction.count} vehicles
              {prediction.is_anomaly && (
                <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 9,
                  background: "rgba(245,158,11,0.12)", border: "1px solid #f59e0b40", color: "#f59e0b" }}>
                  ⚠️ ANOMALY{prediction.event_note ? ` — ${prediction.event_note}` : ""}
                </span>
              )}
            </div>

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
            SUPABASE TABLES REQUIRED
          </div>
          <div style={{ fontSize: 9, color: "#1e3a5f", lineHeight: 2, fontFamily: "monospace", whiteSpace: "pre" }}>
{`-- Traffic data
create table traffic_logs (
  id            bigint generated always
                as identity primary key,
  location      text        not null,
  date          date,
  day_of_week   int         not null,
  day_name      text,
  hour          numeric     not null,
  vehicle_count int         not null,
  recorded_at   timestamptz default now(),
  is_anomaly    boolean     default false,
  event_note    text
);

-- Admin roles (Option B)
create table user_roles (
  user_id uuid references auth.users
         on delete cascade,
  role    text not null,
  primary key (user_id)
);
-- Grant admin:
-- insert into user_roles (user_id, role)
-- values ('<user-uuid>', 'admin');`}
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
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 2fr 1fr",
              padding: "10px 16px", borderBottom: "1px solid #1e3a5f",
              fontSize: 8, color: "#334155", letterSpacing: "0.14em",
            }}>
              <span>LOCATION</span>
              <span>DAY</span>
              <span>HOUR</span>
              <span>VEHICLES</span>
              <span>DATE</span>
              <span>EVENT</span>
              <span>LOGGED</span>
            </div>

            <div style={{ maxHeight: 560, overflowY: "auto" }}>
              {logs.map((row, i) => {
                const hourLabel = SLOTS.find(s => s.value === row.hour)?.label
                               ?? SLOTS.find(s => Math.abs(s.value - row.hour) < 0.01)?.label
                               ?? `${row.hour}:00`;
                const recorded  = new Date(row.recorded_at);
                const timeAgo   = formatTimeAgo(recorded);
                return (
                  <div key={row.id} style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 2fr 1fr",
                    padding: "9px 16px", borderBottom: "1px solid #0a1628",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    alignItems: "center",
                  }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{row.location}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{(row.day_name ?? DAYS[row.day_of_week])?.slice(0,3)}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{hourLabel}</span>
                    <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700 }}>{row.vehicle_count}</span>
                    <span style={{ fontSize: 9, color: "#475569" }}>
                      {row.date
                        ? new Date(row.date + "T00:00:00").toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })
                        : new Date(row.recorded_at).toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })}
                    </span>
                    <span style={{ fontSize: 9, color: row.is_anomaly ? "#f59e0b" : "#1e3a5f",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={row.event_note || ""}>
                      {row.is_anomaly ? (row.event_note || "⚠️ anomaly") : "—"}
                    </span>
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