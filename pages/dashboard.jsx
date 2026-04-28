// pages/index.jsx
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import SegmentPanel from "../components/SegmentPanel";
import AnalyticsView from "../components/AnalyticsView";
import AboutView from "../components/AboutView";
import DataInputView from "../components/DataInputView";
import EvalDashboard from "../components/EvalDashboard";
import { ROAD_SEGMENTS, generateFullDaySeries, loadModel, predictCongestion, simulateLSTMFlow } from "../lib/trafficData";

const TrafficMap = dynamic(() => import("../components/TrafficMap"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#334155", fontSize: 12, letterSpacing: "0.12em", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 32 }}>🗺️</div>
      <div>LOADING MAP...</div>
    </div>
  ),
});

export default function Home() {
  const [activeView,      setActiveView]      = useState("map");
  const [selectedHour,    setSelectedHour]    = useState(0);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const playRef = useRef(null);
  const osmRoadsForSim = useRef([]); // filled by TrafficMap callback
  const [segments, setSegments] = useState([]);
  const [selectedDay,  setSelectedDay]  = useState(new Date().getDay());
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [simResults,   setSimResults]   = useState({});
  const [simLoading,   setSimLoading]   = useState(false);
  const [isAdmin,      setIsAdmin]      = useState(false);

  // ── Check admin role on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { supabase } = await import("../lib/supabase");
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const u = data.session.user;
      // Option A: user_metadata role
      if (u.user_metadata?.role === "admin") { setIsAdmin(true); return; }
      // Option B: user_roles table
      const { data: row } = await supabase
        .from("user_roles").select("role").eq("user_id", u.id).single();
      if (row?.role === "admin") setIsAdmin(true);
    })();
  }, []);

  useEffect(() => {
    // start at 00:00
    const day = new Date().getDay();
    setSegments(
      ROAD_SEGMENTS.map((s) => ({
        ...s,
        series: generateFullDaySeries(s.baseFlow, day),
      }))
    );
  }, []);

  // Called by TrafficMap when user applies insert-data form
  const handleSegmentUpdate = (updatedRoad) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === updatedRoad.id
          ? { ...s, baseFlow: updatedRoad.baseFlow, avgSpeed: updatedRoad.avgSpeed }
          : s
      )
    );
    if (selectedSegment?.id === updatedRoad.id) {
      setSelectedSegment((prev) => ({ ...prev, baseFlow: updatedRoad.baseFlow }));
    }
  };

  // ── Roads the LSTM was trained on ────────────────────────────────────────
  const LSTM_KNOWN_ROADS = ["Cajurao Street", "Magsaysay Boulevard", "Rueda Street", "Senator Tomas Gomez Street"];

  // Convert simulated vehicle count → congestion result object
  const flowToSimResult = (flow) => {
    let label, conf, probs;
    if (flow < 60) {
      label = "LIGHT";    conf = 75 + Math.round(Math.random() * 20);
      probs = { LIGHT: conf, MODERATE: Math.round((100-conf)*0.7), TRAFFIC: Math.round((100-conf)*0.3) };
    } else if (flow < 100) {
      label = "MODERATE"; conf = 65 + Math.round(Math.random() * 20);
      probs = { LIGHT: Math.round((100-conf)*0.5), MODERATE: conf, TRAFFIC: Math.round((100-conf)*0.5) };
    } else {
      label = "TRAFFIC";  conf = 70 + Math.round(Math.random() * 20);
      probs = { LIGHT: Math.round((100-conf)*0.2), MODERATE: Math.round((100-conf)*0.8), TRAFFIC: conf };
    }
    return { label, confidence: conf, probabilities: probs, simulated: true };
  };

  // ── Core prediction runner — accepts explicit hour+day so it's never stale ──
  const runPredictions = useRef(null);
  runPredictions.current = async (hour, day) => {
    const allRoads = osmRoadsForSim.current.length > 0
      ? osmRoadsForSim.current
      : ROAD_SEGMENTS;
    const results = {};

    // Real LSTM on 4 trained roads
    for (const knownName of LSTM_KNOWN_ROADS) {
      try {
        // Check if the most recent log for this road+hour+day was flagged as anomaly
        const { supabase } = await import("../lib/supabase");
        const { data: anomalyRows } = await supabase
          .from("traffic_logs")
          .select("is_anomaly, vehicle_count")
          .eq("location", knownName)
          .eq("day_of_week", day)
          .gte("hour", hour - 0.125)
          .lte("hour", hour + 0.124)
          .order("recorded_at", { ascending: false })
          .limit(1);
        const latestLog  = anomalyRows?.[0];
        const anomalyFlag = latestLog?.is_anomaly ? 1 : 0;
        const latestCount = latestLog?.vehicle_count ?? null;

        const r = await predictCongestion(knownName, hour, day, latestCount, anomalyFlag);
        results[knownName] = { ...r, simulated: false };
      } catch(e) {
        console.warn("LSTM failed for", knownName, e);
      }
    }

    // simulateLSTMFlow for all other OSM roads
    for (const road of allRoads) {
      if (results[road.name]) continue;
      const vehicleCount = simulateLSTMFlow(road.baseFlow ?? 200, hour, day);
      results[road.name] = flowToSimResult(vehicleCount);
    }

    return results;
  };

  // ── Simulate button handler ───────────────────────────────────────────────
  const handleSimulate = async () => {
    setSimLoading(true);
    setSimResults({});
    try {
      await loadModel();
      const results = await runPredictions.current(selectedHour, selectedDay);
      setSimResults(results);
    } catch(err) {
      console.error("Simulate error:", err);
    } finally {
      setSimLoading(false);
    }
  };

  // ── Play interval — ticks hour AND re-runs predictions each step ──────────
  useEffect(() => {
    if (isPlaying) {
      // Pre-load model so ticks don't stall
      loadModel().catch(console.error);
      let currentHour = selectedHour;
      playRef.current = setInterval(async () => {
        currentHour = (currentHour + 1) % 24;
        setSelectedHour(currentHour);
        try {
          const results = await runPredictions.current(currentHour, selectedDay);
          setSimResults(results);
        } catch(e) {
          console.warn("Play tick prediction failed:", e);
        }
      }, 900); // slightly slower than before to allow predictions to complete
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHourChange = (h) => {
    setSelectedHour(h);
    setIsPlaying(false);
    setSimResults({});  // changing hour invalidates predictions
  };

  const handleDayChange = (d) => {
    setSelectedDay(d);
    // Parse the currently selected date (or today as fallback)
    let base;
    if (selectedDate) {
      const [y, m, day] = selectedDate.split("-").map(Number);
      base = new Date(y, m - 1, day);
    } else {
      base = new Date();
    }
    // Find nearest date (today or future) matching the target weekday
    const diff = (d - base.getDay() + 7) % 7;
    const target = new Date(base);
    target.setDate(base.getDate() + diff);
    const newDate =
      target.getFullYear() + "-" +
      String(target.getMonth() + 1).padStart(2, "0") + "-" +
      String(target.getDate()).padStart(2, "0");
    setSelectedDate(newDate);
    setIsPlaying(false);
    setSimResults({});
  };

  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
    if (dateStr) {
      // parse as local date to avoid UTC offset shifting the day
      const [y, m, day] = dateStr.split("-").map(Number);
      const d = new Date(y, m - 1, day).getDay();
      setSelectedDay(d);
    }
    setIsPlaying(false);
    setSimResults({});
  };
  const isLoaded = segments.length > 0;

  const handleLogout = async () => {
    const { supabase } = await import("../lib/supabase");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <>
      <Head>
        <title>Calbayog City — Traffic Flow Prediction System</title>
      </Head>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Header activeView={activeView} onViewChange={setActiveView} isAdmin={isAdmin} onLogout={handleLogout} />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {isLoaded ? (
            <Sidebar
              segments={segments}
              selectedSegment={selectedSegment}
              onSelectSegment={setSelectedSegment}
              selectedHour={selectedHour}
              onHourChange={handleHourChange}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              selectedDay={selectedDay}
              onDayChange={handleDayChange}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              onSimulate={handleSimulate}
              simResults={simResults}
              simLoading={simLoading}
            />
          ) : (
            <aside style={{ width: 270, background: "#0f172a", borderRight: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ color: "#334155", fontSize: 10, letterSpacing: "0.12em" }}>INITIALIZING...</div>
            </aside>
          )}

          <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeView === "map" && (
              <>
                <div style={{ flex: 1, position: "relative" }}>
                  <TrafficMap
                    segments={segments}
                    selectedHour={selectedHour}
                    onSelectSegment={setSelectedSegment}
                    onSegmentUpdate={handleSegmentUpdate}
                    simResults={simResults}
                    onOsmRoadsLoaded={(roads) => { osmRoadsForSim.current = roads; }}
                  />
                  <div style={{ position: "absolute", top: 12, left: 12, background: "#0f172acc", border: "1px solid #1e3a5f", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#38bdf8", fontWeight: 700, backdropFilter: "blur(4px)", zIndex: 500, letterSpacing: "0.05em", pointerEvents: "none" }}>
                    {String(selectedHour).padStart(2, "0")}:00{" "}
                    {isPlaying && <span style={{ color: "#3b82f6", marginLeft: 6 }} className="animate-pulse">●</span>}
                  </div>
                </div>
                {selectedSegment && (
                  <SegmentPanel segment={selectedSegment} currentHour={selectedHour} onClose={() => setSelectedSegment(null)} />
                )}
              </>
            )}
            {activeView === "analytics" && isLoaded && (
              <AnalyticsView
                segments={segments}
                selectedHour={selectedHour}
                selectedDay={selectedDay}
                simResults={simResults}
                isPlaying={isPlaying}
              />
            )}
            {activeView === "analytics" && !isLoaded && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 11, letterSpacing: "0.12em" }}>LOADING DATA...</div>
            )}
            {activeView === "about" && <AboutView />}
            {activeView === "input" && <DataInputView />}
            {activeView === "eval" && <EvalDashboard />}
          </main>
        </div>
      </div>
    </>
  );
}