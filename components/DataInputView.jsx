// components/DataInputView.jsx
// Upload Excel → preprocess → run LSTM inference → show results
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { predictCongestion, loadModel, ROAD_SEGMENTS } from "../lib/trafficData";

const CONGESTION_COLORS = { LIGHT: "#22c55e", MODERATE: "#f59e0b", TRAFFIC: "#ef4444" };
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_MAP = { Monday:0, Tuesday:1, Wednesday:2, Thursday:3, Friday:4, Saturday:5, Sunday:6 };
const JS_DAY  = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:0 };

const LOCATION_ENCODING = {
  "Cajurao Street": 0, "Magsaysay Boulevard": 1,
  "Rueda Street": 2,   "Senator Tomas Gomez Street": 3,
};

const VEHICLE_MIN = 10;
const VEHICLE_MAX = 200;

function minMaxScale(v) {
  return Math.max(0, Math.min(1, (v - VEHICLE_MIN) / (VEHICLE_MAX - VEHICLE_MIN)));
}

function parseHour(timeStr) {
  if (!timeStr) return 0;
  const s = String(timeStr).trim();
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const period = m[3]?.toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h + min / 60;
}

export default function DataInputView() {
  const router = useRouter();
  const fileRef = useRef();
  const [user,      setUser]      = useState(null);
  const [checking,  setChecking]  = useState(true);
  const [file,      setFile]      = useState(null);
  const [status,    setStatus]    = useState("idle"); // idle | reading | predicting | done | error
  const [progress,  setProgress]  = useState(0);
  const [results,   setResults]   = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [errorMsg,  setErrorMsg]  = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUser(data.session.user); setChecking(false); }
      else { setChecking(false); router.replace("/auth"); }
    });
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setResults([]); setSummary(null); setStatus("idle"); }
  };

  const handleProcess = async () => {
    if (!file) return;
    setStatus("reading"); setProgress(0); setErrorMsg(""); setResults([]);

    try {
      // ── Step 1: Read Excel with SheetJS ───────────────────────────────
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      let rows   = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Handle header=1 case (group row on top like our LSTM-ready Excel)
      if (rows[0] && Object.keys(rows[0]).some(k => k.toLowerCase().includes("identifier"))) {
        rows = XLSX.utils.sheet_to_json(ws, { defval: "", range: 1 });
      }

      console.log("[UPLOAD] Rows read:", rows.length, "| Sample:", rows[0]);

      if (rows.length === 0) throw new Error("No data rows found in Excel file.");

      // ── Step 2: Detect columns ─────────────────────────────────────────
      const sample = rows[0];
      const keys   = Object.keys(sample).map(k => k.trim());

      const findCol = (...candidates) => {
        for (const c of candidates) {
          const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()));
          if (found) return found;
        }
        return null;
      };

      const colLocation = findCol("Location", "location");
      const colVehicle  = findCol("Vehicle Count", "Vehicle", "Count", "vehicles");
      const colTime     = findCol("Time Interval", "Time", "time");
      const colDay      = findCol("Day", "day");

      console.log("[UPLOAD] Columns detected:", { colLocation, colVehicle, colTime, colDay });

      if (!colLocation || !colVehicle) {
        throw new Error(`Could not find required columns. Found: ${keys.join(", ")}`);
      }

      setStatus("predicting");

      // ── Step 3: Load model ─────────────────────────────────────────────
      await loadModel();

      // ── Step 4: Group by location, build sequences, predict ───────────
      const locations = [...new Set(rows.map(r => String(r[colLocation]).trim()))];
      const allResults = [];
      let processed = 0;

      for (const location of locations) {
        const locRows = rows.filter(r => String(r[colLocation]).trim() === location);
        const locEnc  = LOCATION_ENCODING[location] ?? 1;

        for (let i = 0; i < locRows.length; i++) {
          const row       = locRows[i];
          const count     = parseFloat(row[colVehicle]) || 0;
          const timeStr   = colTime ? String(row[colTime]) : "08:00";
          const dayStr    = colDay  ? String(row[colDay]).trim() : "Monday";
          const hour      = parseHour(timeStr);
          const jsDayOfWeek = JS_DAY[dayStr] ?? 1;

          // Build lookback sequence — use previous rows if available
          const LOOKBACK = 8;
          const sequence = [];
          for (let lag = LOOKBACK - 1; lag >= 0; lag--) {
            const pastIdx  = Math.max(0, i - lag);
            const pastRow  = locRows[pastIdx];
            const pastCount = parseFloat(pastRow[colVehicle]) || count;
            const pastTime  = colTime ? String(pastRow[colTime]) : timeStr;
            const pastHour  = parseHour(pastTime);
            const scaled    = minMaxScale(pastCount);
            const hSin = Math.sin(2 * Math.PI * pastHour / 24);
            const hCos = Math.cos(2 * Math.PI * pastHour / 24);
            const dEnc = DAY_MAP[dayStr] ?? 0;
            const dSin = Math.sin(2 * Math.PI * dEnc / 7);
            const dCos = Math.cos(2 * Math.PI * dEnc / 7);
            sequence.push([locEnc, scaled, scaled, scaled, scaled, scaled, scaled, 0, hSin, hCos, dSin, dCos]);
          }

          // Run inference
          const tf = await import("@tensorflow/tfjs");
          const { _model } = await import("../lib/trafficData");
          // Use the already-loaded model via window cache
          const model = window.__lstmModel;
          if (!model) {
            // Fallback: use predictCongestion
            const pred = await predictCongestion(location, Math.floor(hour), jsDayOfWeek, count);
            allResults.push({
              location, time: timeStr, day: dayStr,
              vehicleCount: count, hour,
              predicted: pred.label,
              confidence: pred.confidence,
              probabilities: pred.probabilities,
            });
          } else {
            const inputTensor = tf.tensor3d([sequence], [1, LOOKBACK, 12]);
            const probsTensor = model.predict(inputTensor);
            const probs       = Array.from(await probsTensor.data());
            inputTensor.dispose(); probsTensor.dispose();
            const CLASS_NAMES = ["LIGHT", "MODERATE", "TRAFFIC"];
            const classIdx    = probs.indexOf(Math.max(...probs));
            allResults.push({
              location, time: timeStr, day: dayStr,
              vehicleCount: count, hour,
              predicted: CLASS_NAMES[classIdx],
              confidence: Math.round(probs[classIdx] * 100),
              probabilities: {
                LIGHT: Math.round(probs[0]*100),
                MODERATE: Math.round(probs[1]*100),
                TRAFFIC: Math.round(probs[2]*100),
              },
            });
          }

          processed++;
          setProgress(Math.round((processed / rows.length) * 100));

          // Yield every 50 rows to keep UI responsive
          if (processed % 50 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }

      // ── Step 5: Summary stats ──────────────────────────────────────────
      const counts = { LIGHT: 0, MODERATE: 0, TRAFFIC: 0 };
      allResults.forEach(r => counts[r.predicted]++);
      setSummary({
        total: allResults.length,
        locations: locations.length,
        counts,
        dominantLevel: Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0],
      });

      setResults(allResults);
      setStatus("done");
      console.log("[UPLOAD] ✅ Done. Total predictions:", allResults.length);

    } catch (err) {
      console.error("[UPLOAD] Error:", err);
      setErrorMsg(err.message || "Something went wrong.");
      setStatus("error");
    }
  };

  const labelStyle = { fontSize:9, color:"#475569", letterSpacing:"0.12em", display:"block", marginBottom:5, fontFamily:"monospace" };

  if (checking) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#070d1a", color:"#334155", fontSize:11, letterSpacing:"0.12em" }}>
      VERIFYING ACCESS...
    </div>
  );
  if (!user) return null;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:28, background:"#070d1a", color:"#e2e8f0", display:"flex", gap:24, flexWrap:"wrap", alignItems:"flex-start" }}>

      {/* ── Left: Upload panel ── */}
      <div style={{ flex:"0 0 340px", display:"flex", flexDirection:"column", gap:16 }}>

        {/* Header */}
        <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#38bdf8", letterSpacing:"0.1em", marginBottom:4 }}>
            📂 UPLOAD TRAFFIC DATA
          </div>
          <div style={{ fontSize:10, color:"#475569", marginBottom:16 }}>
            Upload your Excel file → model runs inference on every row
          </div>

          {/* File drop area */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? "#3b82f6" : "#1e3a5f"}`,
              borderRadius:8, padding:"24px 16px", textAlign:"center",
              cursor:"pointer", transition:"all 0.2s", marginBottom:14,
              background: file ? "rgba(59,130,246,0.05)" : "transparent",
            }}>
            <div style={{ fontSize:24, marginBottom:8 }}>📊</div>
            <div style={{ fontSize:11, color: file ? "#38bdf8" : "#334155" }}>
              {file ? file.name : "Click to upload .xlsx file"}
            </div>
            {file && (
              <div style={{ fontSize:9, color:"#475569", marginTop:4 }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:"none" }} />
          </div>

          {/* Expected columns */}
          <div style={{ fontSize:9, color:"#334155", lineHeight:1.8, marginBottom:14 }}>
            <div style={{ color:"#475569", marginBottom:4 }}>EXPECTED COLUMNS:</div>
            Location · Vehicle Count · Time Interval · Day
          </div>

          {/* Process button */}
          <button
            onClick={handleProcess}
            disabled={!file || status === "predicting" || status === "reading"}
            style={{
              width:"100%", padding:"11px 0", borderRadius:7, border:"none",
              background: !file || status === "predicting" ? "#1e293b" : "linear-gradient(90deg,#3b82f6,#06b6d4)",
              color: !file || status === "predicting" ? "#475569" : "#fff",
              fontSize:11, fontWeight:700, letterSpacing:"0.1em",
              cursor: !file || status === "predicting" ? "not-allowed" : "pointer",
              fontFamily:"monospace",
            }}>
            {status === "reading"    ? "READING FILE..."    :
             status === "predicting" ? `PREDICTING... ${progress}%` :
             "RUN INFERENCE →"}
          </button>

          {/* Progress bar */}
          {(status === "predicting" || status === "reading") && (
            <div style={{ marginTop:10, height:4, background:"#1e293b", borderRadius:2, overflow:"hidden" }}>
              <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg,#3b82f6,#06b6d4)", transition:"width 0.3s" }} />
            </div>
          )}

          {status === "error" && (
            <div style={{ marginTop:10, padding:"8px 12px", borderRadius:6, background:"rgba(239,68,68,0.08)", border:"1px solid #ef444430", fontSize:10, color:"#f87171" }}>
              ❌ {errorMsg}
            </div>
          )}
        </div>

        {/* Summary card */}
        {summary && (
          <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:20 }}>
            <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.12em", marginBottom:14, fontFamily:"monospace" }}>INFERENCE SUMMARY</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"TOTAL ROWS",  value: summary.total },
                { label:"LOCATIONS",   value: summary.locations },
              ].map(s => (
                <div key={s.label} style={{ background:"#0a1628", borderRadius:6, padding:"10px 12px" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:"#38bdf8", fontFamily:"monospace" }}>{s.value}</div>
                  <div style={{ fontSize:8, color:"#334155", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {Object.entries(summary.counts).map(([label, count]) => (
              <div key={label} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:3 }}>
                  <span style={{ color:CONGESTION_COLORS[label] }}>{label}</span>
                  <span style={{ color:"#475569", fontFamily:"monospace" }}>{count} ({Math.round(count/summary.total*100)}%)</span>
                </div>
                <div style={{ height:5, background:"#0a1628", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${count/summary.total*100}%`, height:"100%", background:CONGESTION_COLORS[label], borderRadius:2 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Results table ── */}
      <div style={{ flex:1, minWidth:320 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#38bdf8", letterSpacing:"0.1em", marginBottom:14 }}>
          🔮 PREDICTION RESULTS
          {results.length > 0 && <span style={{ fontSize:10, color:"#334155", fontWeight:400, marginLeft:10 }}>— {results.length} rows</span>}
        </div>

        {results.length === 0 ? (
          <div style={{ padding:32, background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, color:"#334155", fontSize:11, textAlign:"center", letterSpacing:"0.08em" }}>
            {status === "idle" ? "Upload an Excel file and click RUN INFERENCE" : status === "done" ? "No results" : "Processing..."}
          </div>
        ) : (
          <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, overflow:"hidden" }}>
            {/* Table header */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1.2fr", padding:"10px 16px", borderBottom:"1px solid #1e3a5f", fontSize:8, color:"#334155", letterSpacing:"0.12em", fontFamily:"monospace" }}>
              <span>LOCATION</span><span>TIME</span><span>DAY</span><span>VEHICLES</span><span>PREDICTION</span>
            </div>
            {/* Rows — show first 200 */}
            <div style={{ maxHeight:520, overflowY:"auto" }}>
              {results.slice(0, 200).map((r, i) => (
                <div key={i} style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1.2fr",
                  padding:"9px 16px", borderBottom:"1px solid #0a1628",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  alignItems:"center",
                }}>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{r.location}</span>
                  <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{r.time}</span>
                  <span style={{ fontSize:10, color:"#475569" }}>{r.day?.slice(0,3)}</span>
                  <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>{r.vehicleCount}</span>
                  <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:CONGESTION_COLORS[r.predicted], boxShadow:`0 0 5px ${CONGESTION_COLORS[r.predicted]}`, flexShrink:0 }} />
                    <span style={{ fontSize:10, color:CONGESTION_COLORS[r.predicted], fontWeight:700 }}>{r.predicted}</span>
                    <span style={{ fontSize:8, color:"#334155", marginLeft:2 }}>{r.confidence}%</span>
                  </span>
                </div>
              ))}
              {results.length > 200 && (
                <div style={{ padding:"10px 16px", fontSize:9, color:"#334155", textAlign:"center" }}>
                  Showing 200 of {results.length} rows
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
