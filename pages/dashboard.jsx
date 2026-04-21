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
import { ROAD_SEGMENTS, generateFullDaySeries } from "../lib/trafficData";

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
  const [segments, setSegments] = useState([]);

  useEffect(() => {
    setSelectedHour(new Date().getHours());
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

  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => setSelectedHour((h) => (h + 1) % 24), 700);
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  const handleHourChange = (h) => { setSelectedHour(h); setIsPlaying(false); };
  const isLoaded = segments.length > 0;

  return (
    <>
      <Head>
        <title>Calbayog City — Traffic Flow Prediction System</title>
      </Head>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <Header activeView={activeView} onViewChange={setActiveView} />
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
            {activeView === "analytics" && isLoaded && <AnalyticsView segments={segments} selectedHour={selectedHour} />}
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
