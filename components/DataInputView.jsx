// components/DataInputView.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import { ROAD_SEGMENTS } from "../lib/trafficData";

const THRESHOLDS = {
  "Cajurao Street":             { MODERATE: 19, TRAFFIC: null },
  "Magsaysay Boulevard":        { MODERATE: 61, TRAFFIC: 81  },
  "Rueda Street":               { MODERATE: 48, TRAFFIC: 82  },
  "Senator Tomas Gomez Street": { MODERATE: 61, TRAFFIC: 109 },
};

function getCongestionLevel(road, count) {
  const t = THRESHOLDS[road];
  if (!t) return "LIGHT";
  if (t.TRAFFIC && count >= t.TRAFFIC) return "TRAFFIC";
  if (t.MODERATE && count >= t.MODERATE) return "MODERATE";
  return "LIGHT";
}

function snapTo15Min(date) {
  const s = new Date(date);
  s.setMinutes(Math.floor(s.getMinutes() / 15) * 15, 0, 0);
  return s;
}

function formatTimeInterval(date) {
  return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-PH", { month:"long", day:"numeric", year:"numeric" });
}

const CONGESTION_COLORS = { LIGHT:"#22c55e", MODERATE:"#f59e0b", TRAFFIC:"#ef4444" };
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function DataInputView() {
  const router = useRouter();
  const [user,     setUser]     = useState(null);
  const [checking, setChecking] = useState(true);
  const [road,     setRoad]     = useState(ROAD_SEGMENTS[0].name);
  const [count,    setCount]    = useState("");
  const [time,     setTime]     = useState(formatTimeInterval(snapTo15Min(new Date())));
  const [status,   setStatus]   = useState(null);
  const [log,      setLog]      = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setUser(data.session.user); setChecking(false); }
      else { setChecking(false); router.replace("/auth"); }
    });
  }, []);

  const vehicleCount    = parseInt(count) || 0;
  const congestionLevel = count !== "" ? getCongestionLevel(road, vehicleCount) : null;

  const getSnappedTime = () => {
    const [h, m] = time.split(":").map(Number);
    const b = new Date(); b.setHours(h, m, 0, 0);
    return snapTo15Min(b);
  };

  const handleSubmit = async () => {
    if (!count || isNaN(vehicleCount) || vehicleCount < 0) { setStatus("error"); setTimeout(() => setStatus(null), 3000); return; }
    setStatus("saving");
    const snapped = getSnappedTime();
    const entry = {
      date:             formatDateLabel(snapped),
      day:              DAYS[snapped.getDay()],
      time_interval:    formatTimeInterval(snapped),
      location:         road,
      vehicle_count:    vehicleCount,
      congestion_level: getCongestionLevel(road, vehicleCount),
      created_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from("traffic_readings").insert([entry]);
    if (error) { console.error(error); setStatus("error"); setTimeout(() => setStatus(null), 3000); return; }
    setStatus("success");
    setLog(prev => [{ ...entry, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    setCount("");
    setTimeout(() => setStatus(null), 3000);
  };

  const inputStyle = { width:"100%", padding:"10px 14px", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:8, color:"#e2e8f0", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:10, letterSpacing:"0.1em", color:"#475569", marginBottom:6, display:"block" };

  if (checking) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#070d1a", color:"#334155", fontSize:11, letterSpacing:"0.12em" }}>
      VERIFYING ACCESS...
    </div>
  );
  if (!user) return null;

  return (
    <div style={{ flex:1, overflowY:"auto", padding:28, background:"#070d1a", color:"#e2e8f0", display:"flex", gap:28, flexWrap:"wrap", alignItems:"flex-start" }}>

      {/* Form */}
      <div style={{ flex:"0 0 360px", background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#38bdf8", letterSpacing:"0.1em", marginBottom:4 }}>📥 INPUT TRAFFIC DATA</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.08em" }}>
            Logged in as <span style={{ color:"#38bdf8" }}>{user.email}</span>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.replace("/auth"))}
            style={{ background:"none", border:"1px solid #1e3a5f", borderRadius:4, padding:"4px 10px", color:"#475569", fontSize:9, cursor:"pointer", letterSpacing:"0.1em", fontFamily:"inherit" }}>
            LOGOUT
          </button>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>ROAD SEGMENT</label>
          <select value={road} onChange={e => setRoad(e.target.value)} style={inputStyle}>
            {ROAD_SEGMENTS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>TIME (snaps to nearest 15 min)</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
          <div style={{ fontSize:10, color:"#334155", marginTop:4 }}>
            → Interval: <span style={{ color:"#38bdf8" }}>{formatTimeInterval(getSnappedTime())}</span>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={labelStyle}>VEHICLE COUNT</label>
          <input type="number" min="0" max="999" placeholder="e.g. 45" value={count} onChange={e => setCount(e.target.value)} style={inputStyle} />
        </div>

        {congestionLevel && (
          <div style={{ padding:"10px 14px", borderRadius:8, marginBottom:20, background:CONGESTION_COLORS[congestionLevel]+"18", border:`1px solid ${CONGESTION_COLORS[congestionLevel]}40`, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:CONGESTION_COLORS[congestionLevel], boxShadow:`0 0 8px ${CONGESTION_COLORS[congestionLevel]}` }} />
            <div>
              <div style={{ fontSize:11, color:CONGESTION_COLORS[congestionLevel], fontWeight:700 }}>{congestionLevel}</div>
              <div style={{ fontSize:10, color:"#475569" }}>Auto-derived from vehicle count</div>
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={status==="saving"}
          style={{ width:"100%", padding:"11px 0", background:status==="saving"?"#1e3a5f":"linear-gradient(90deg,#3b82f6,#06b6d4)", border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.1em", cursor:status==="saving"?"not-allowed":"pointer", fontFamily:"inherit" }}>
          {status==="saving" ? "SAVING..." : "SAVE TO SUPABASE"}
        </button>

        {status==="success" && <div style={{ marginTop:12, fontSize:11, color:"#22c55e", textAlign:"center" }}>✅ Saved successfully</div>}
        {status==="error"   && <div style={{ marginTop:12, fontSize:11, color:"#ef4444", textAlign:"center" }}>❌ Error — check vehicle count and Supabase config</div>}
      </div>

      {/* Log */}
      <div style={{ flex:1, minWidth:300 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#38bdf8", letterSpacing:"0.1em", marginBottom:16 }}>🕐 RECENT SUBMISSIONS</div>
        {log.length === 0 ? (
          <div style={{ padding:24, background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:12, color:"#334155", fontSize:11, textAlign:"center", letterSpacing:"0.08em" }}>
            No submissions yet this session
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {log.map((entry, i) => (
              <div key={i} style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:16 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:CONGESTION_COLORS[entry.congestion_level], boxShadow:`0 0 6px ${CONGESTION_COLORS[entry.congestion_level]}` }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:"#e2e8f0", fontWeight:600 }}>{entry.location}</div>
                  <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{entry.time_interval} · {entry.vehicle_count} vehicles · {entry.day}</div>
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:CONGESTION_COLORS[entry.congestion_level], letterSpacing:"0.08em" }}>{entry.congestion_level}</div>
                <div style={{ fontSize:9, color:"#334155" }}>{entry.time}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop:20, padding:"12px 16px", background:"#0a1628", border:"1px solid #1e3a5f", borderRadius:10, fontSize:10, color:"#334155", lineHeight:1.8 }}>
          <div style={{ color:"#475569", marginBottom:6, letterSpacing:"0.08em" }}>SUPABASE TABLE: traffic_readings</div>
          date · day · time_interval · location · vehicle_count · congestion_level · created_at
        </div>
      </div>
    </div>
  );
}
