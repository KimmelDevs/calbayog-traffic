// components/TrafficMap.jsx
import { useEffect, useRef, useState } from "react";
import { getTrafficLevel, generateFullDaySeries, MAP_CENTER, MAP_ZOOM } from "../lib/trafficData";

// Module-level ref so Leaflet closures always call the latest onSelectSegment
let _onSelect = null;

export default function TrafficMap({ segments, selectedHour, onSelectSegment, onSegmentUpdate, simResults, onOsmRoadsLoaded }) {
  const mapRef      = useRef(null);
  const mapObjRef   = useRef(null); // { map, L }
  const osmRoadsRef = useRef([]);  // full OSM roads with geometry

  const [status,   setStatus]   = useState("loading"); // loading | ready | error
  const [roadCount, setRoadCount] = useState(0);

  // Visibility toggle panel
  const [visOpen,     setVisOpen]     = useState(false);
  const [hiddenRoads, setHiddenRoads] = useState(new Set());

  const toggleRoadVisibility = (id) => {
    setHiddenRoads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      const ref = mapObjRef.current;
      if (ref) {
        const visible = osmRoadsRef.current.filter(r => !next.has(String(r.id)));
        drawRoadsGrey(ref.map, ref.L, visible, segments, selectedHour);
      }
      return next;
    });
  };

  const toggleAll = (show) => {
    const next = show ? new Set() : new Set(osmRoadsRef.current.map(r => String(r.id)));
    setHiddenRoads(next);
    const ref = mapObjRef.current;
    if (ref) drawRoadsGrey(ref.map, ref.L, show ? osmRoadsRef.current : [], segments, selectedHour);
  };

  _onSelect = onSelectSegment;

  // ── Init map + auto-fetch all 18 streets ──────────────────────
  useEffect(() => {
    let map = null;

    import("leaflet").then(async (mod) => {
      const L = mod.default ?? mod;
      if (mapRef.current._leaflet_id) mapRef.current._leaflet_id = null;

      map = L.map(mapRef.current, {
        center: MAP_CENTER,
        zoom:   MAP_ZOOM,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapObjRef.current = { map, L };

      // ── Fetch all 18 named streets in one call ──────────────
      try {
        const res  = await fetch("/api/roads");
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        const day  = new Date().getDay();
        const seen = new Set();
        const roads = [];

        for (const way of (data.elements || [])) {
          if (!way.geometry || way.geometry.length < 2) continue;
          const name = way.tags?.name || `Road #${way.id}`;
          const key  = name;
          if (!seen.has(key)) {
            seen.add(key);
            const baseFlow = 80 + Math.floor(Math.random() * 500);
            roads.push({
              id:          way.id,
              name,
              shortName:   name.length > 18 ? name.slice(0, 18) + "…" : name,
              highway:     way.tags?.highway || "road",
              nodes:       way.geometry,
              baseFlow,
              avgSpeed:    15 + Math.floor(Math.random() * 35),
              description: `${way.tags?.highway || "road"} · Calbayog proper`,
              // Pre-generate 24-hr series so SegmentPanel always works
              series:      generateFullDaySeries(baseFlow, day),
            });
          } else {
            // Append extra geometry from duplicate OSM ways with same name
            const existing = roads.find(r => r.name === name);
            if (existing) existing.nodes = [...existing.nodes, ...way.geometry];
          }
        }

        osmRoadsRef.current = roads;
        setRoadCount(roads.length);
        onOsmRoadsLoaded?.(roads);
        setStatus("ready");
        drawRoadsGrey(map, L, roads, segments, selectedHour);
      } catch (err) {
        console.error("Failed to load roads:", err);
        setStatus("error");
        // Fall back to drawing static segments grey
        drawRoadsGrey(map, L, [], segments, selectedHour);
      }
    });

    return () => {
      if (map) { map.remove(); mapObjRef.current = null; }
    };
  }, []);

  // ── Redraw when hour or segments change ───────────────────────
  useEffect(() => {
    const ref = mapObjRef.current;
    if (!ref) return;
    if (simResults && Object.keys(simResults).length > 0) {
      drawRoadsWithPredictions(ref.map, ref.L, osmRoadsRef.current, simResults);
    } else {
      drawRoadsGrey(ref.map, ref.L, osmRoadsRef.current, segments, selectedHour);
    }
  }, [segments, selectedHour, simResults]);

  // ── Apply insert-data form ─────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Status bar */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        background: "#0f172acc", border: "1px solid #1e3a5f", borderRadius: 6,
        padding: "5px 16px", fontSize: 10, color: "#475569", letterSpacing: "0.1em",
        zIndex: 500, whiteSpace: "nowrap", backdropFilter: "blur(4px)", pointerEvents: "none",
      }}>
        {status === "loading" && "⟳  LOADING CALBAYOG STREETS…"}
        {status === "ready" && !simResults?.length && `✓  ${roadCount} STREETS ACTIVE  ·  CLICK A ROAD TO INSPECT`}
        {status === "error"   && "⚠  OVERPASS UNAVAILABLE — SHOWING FALLBACK DATA"}
      </div>

      {/* ── Pre-simulate hint overlay ── */}
      {status === "ready" && (!simResults || Object.keys(simResults).length === 0) && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#0a1220ee", border: "1px solid #1e3a5f",
          borderRadius: 12, padding: "18px 28px", zIndex: 500,
          backdropFilter: "blur(8px)", textAlign: "center",
          pointerEvents: "none", fontFamily: "'JetBrains Mono', monospace",
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔮</div>
          <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
            ROADS LOADED
          </div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.08em", lineHeight: 1.6 }}>
            Press <span style={{ color: "#38bdf8" }}>SIMULATE & PREDICT</span> in the sidebar<br />
            to run LSTM predictions and colorize the map
          </div>
        </div>
      )}

      {/* ── Street Visibility Panel ── */}
      <div style={{ position: "absolute", bottom: 70, left: 12, zIndex: 1000, fontFamily: "'JetBrains Mono', monospace" }}>
        {/* Toggle button */}
        <button
          onClick={() => setVisOpen(v => !v)}
          style={{
            background: "#0f172af5", border: "1px solid #1e3a5f",
            color: "#38bdf8", fontSize: 10, letterSpacing: "0.08em", fontWeight: 700,
            padding: "7px 14px", borderRadius: visOpen ? "8px 8px 0 0" : 8,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", width: "100%",
          }}
        >
          <span>{visOpen ? "▾" : "▸"}</span> STREET VISIBILITY
        </button>

        {/* Expandable list */}
        {visOpen && (
          <div style={{
            background: "#0f172af5", border: "1px solid #1e3a5f", borderTop: "none",
            borderRadius: "0 0 8px 8px", padding: "8px 0",
            maxHeight: 320, overflowY: "auto", minWidth: 230,
          }}>
            {/* Show all / Hide all */}
            <div style={{ display: "flex", gap: 6, padding: "0 10px 8px", borderBottom: "1px solid #1e293b", marginBottom: 4 }}>
              <button onClick={() => toggleAll(true)} style={{
                flex: 1, background: "#1e293b", border: "1px solid #334155",
                color: "#22c55e", fontSize: 9, padding: "4px 0", borderRadius: 4,
                cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
              }}>SHOW ALL</button>
              <button onClick={() => toggleAll(false)} style={{
                flex: 1, background: "#1e293b", border: "1px solid #334155",
                color: "#ef4444", fontSize: 9, padding: "4px 0", borderRadius: 4,
                cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
              }}>HIDE ALL</button>
            </div>

            {/* Per-road toggles */}
            {osmRoadsRef.current.map(road => {
              const id      = String(road.id);
              const visible = !hiddenRoads.has(id);
              const traffic = getTrafficLevel(road.baseFlow);
              return (
                <div
                  key={id}
                  onClick={() => toggleRoadVisibility(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 12px", cursor: "pointer",
                    opacity: visible ? 1 : 0.35,
                    transition: "opacity 0.15s",
                  }}
                >
                  {/* Colour dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: visible ? traffic.color : "#334155",
                  }}/>
                  {/* Road name */}
                  <span style={{ fontSize: 10, color: visible ? "#e2e8f0" : "#475569", flex: 1 }}>
                    {road.name}
                  </span>
                  {/* Toggle indicator */}
                  <span style={{ fontSize: 9, color: visible ? "#22c55e" : "#475569" }}>
                    {visible ? "ON" : "OFF"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}

// ── Draw all roads in grey (pre-simulation state) ────────────────────────
function drawRoadsGrey(map, L, osmRoads, staticSegments, selectedHour) {
  if (!map || !L) return;

  if (!document.getElementById("_traf_css")) {
    const s = document.createElement("style");
    s.id = "_traf_css";
    s.textContent = `@keyframes trafGlow{0%,100%{opacity:.08}50%{opacity:.35}}`;
    document.head.appendChild(s);
  }

  map.eachLayer(l => { if (l._isTL) l.remove(); });

  const roads = osmRoads.length > 0 ? osmRoads : staticSegments;
  for (const road of roads) {
    const coords = osmRoads.length > 0
      ? road.nodes.map(n => [n.lat, n.lon])
      : [road.from, road.to];

    const glow = L.polyline(coords, { color: "#334155", weight: 10, opacity: 0.12 }).addTo(map);
    glow._isTL = true;

    const pl = L.polyline(coords, { color: "#475569", weight: 3, opacity: 0.55 }).addTo(map);
    pl._isTL = true;

    pl.bindTooltip(`
      <div style="min-width:170px;font-family:monospace">
        <div style="font-weight:700;color:#38bdf8;margin-bottom:3px">${road.name}</div>
        <div style="color:#475569;font-size:11px">Press 🔮 Simulate & Predict to analyze traffic</div>
      </div>
    `, { sticky: true, offset: [10, 0] });

    pl.on("click", (e) => { L.DomEvent.stopPropagation(e); _onSelect?.(road); });
  }
}

// ── Draw all roads (OSM geometry + fallback static segments) ─────
function drawRoads(map, L, osmRoads, staticSegments, selectedHour) {
  if (!map || !L) return;

  // Inject glow keyframe once
  if (!document.getElementById("_traf_css")) {
    const s = document.createElement("style");
    s.id = "_traf_css";
    s.textContent = `@keyframes trafGlow{0%,100%{opacity:.08}50%{opacity:.35}}`;
    document.head.appendChild(s);
  }

  // Remove old traffic layers
  map.eachLayer(l => { if (l._isTL) l.remove(); });

  if (osmRoads.length > 0) {
    // ── Draw full OSM polylines ──────────────────────────────────
    for (const road of osmRoads) {
      const coords  = road.nodes.map(n => [n.lat, n.lon]);
      // Use hour-specific flow from series if available, otherwise fall back to baseFlow
      const flow    = road.series?.[selectedHour]?.flow ?? road.baseFlow;
      const traffic = getTrafficLevel(flow);

      // Animated glow halo
      const glow = L.polyline(coords, {
        color: traffic.color, weight: traffic.weight + 8, opacity: 0.18,
      }).addTo(map);
      glow._isTL = true;
      setTimeout(() => {
        const el = glow.getElement();
        if (el) el.style.animation = "trafGlow 2.8s ease-in-out infinite";
      }, 10);

      // Main coloured line
      const pl = L.polyline(coords, {
        color: traffic.color, weight: traffic.weight, opacity: 0.92,
      }).addTo(map);
      pl._isTL = true;

      pl.bindTooltip(`
        <div style="min-width:170px;font-family:monospace">
          <div style="font-weight:700;color:#38bdf8;margin-bottom:3px">${road.name}</div>
          <div style="color:#94a3b8;font-size:11px">📊 ${flow.toLocaleString()} veh/hr</div>
          ${road.avgSpeed ? `<div style="color:#94a3b8;font-size:11px">🏎 ${road.avgSpeed} km/h avg</div>` : ""}
          <div style="color:${traffic.color};font-size:11px">● ${traffic.label}</div>
          <div style="color:#475569;font-size:10px;margin-top:3px">${road.highway ?? ""}</div>
        </div>
      `, { sticky: true, offset: [10, 0] });

      pl.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        _onSelect?.(road);
      });

      // ── Divider marker at the geographic center split of Avelino ──
      if (road.name === "Jose D. Avelino Street(1)" && coords.length > 0) {
        const splitPt = coords[coords.length - 1];
        const divOuter = L.circleMarker(splitPt, {
          radius: 7, color: "#0f172a", fillColor: "#0f172a",
          fillOpacity: 1, weight: 3,
        }).addTo(map);
        divOuter._isTL = true;
        const divInner = L.circleMarker(splitPt, {
          radius: 4, color: "#fff", fillColor: "#fff",
          fillOpacity: 1, weight: 2,
        }).addTo(map);
        divInner._isTL = true;
        divInner.bindTooltip("── SPLIT ──", { permanent: false, direction: "top", offset: [0, -8] });
      }
    }
  } else {
    // ── Fallback: draw static from→to segments ───────────────────
    for (const seg of staticSegments) {
      const flow    = seg.series?.[selectedHour]?.flow ?? seg.baseFlow;
      const traffic = getTrafficLevel(flow);

      const glow = L.polyline([seg.from, seg.to], {
        color: traffic.color, weight: traffic.weight + 6, opacity: 0.15,
      }).addTo(map);
      glow._isTL = true;

      const pl = L.polyline([seg.from, seg.to], {
        color: traffic.color, weight: traffic.weight, opacity: 0.9,
      }).addTo(map);
      pl._isTL = true;

      pl.bindTooltip(`
        <div style="min-width:160px;font-family:monospace">
          <div style="font-weight:700;color:#38bdf8;margin-bottom:4px">${seg.name}</div>
          <div style="color:#94a3b8;font-size:11px">📊 ${flow.toLocaleString()} veh/hr</div>
          <div style="color:${traffic.color};font-size:11px">● ${traffic.label}</div>
        </div>
      `, { sticky: true, offset: [10, 0] });

      pl.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        _onSelect?.(seg);
      });
    }
  }
}

// ── Draw roads colored by LSTM predictions (simResults: { [roadName]: { label, confidence } }) ──
function drawRoadsWithPredictions(map, L, osmRoads, simResults) {
  if (!map || !L || !osmRoads.length) return;

  const COLORS  = { LIGHT:"#22c55e", MODERATE:"#f59e0b", TRAFFIC:"#ef4444" };
  const WEIGHTS = { LIGHT:4, MODERATE:6, TRAFFIC:8 };

  map.eachLayer(l => { if (l._isTL) l.remove(); });

  for (const road of osmRoads) {
    const coords = road.nodes.map(n => [n.lat, n.lon]);
    const result = simResults[road.name];
    const label  = result?.label;

    if (label && COLORS[label]) {
      const color  = COLORS[label];
      const weight = WEIGHTS[label];

      const glow = L.polyline(coords, { color, weight: weight + 8, opacity: 0.28 }).addTo(map);
      glow._isTL = true;

      const pl = L.polyline(coords, { color, weight, opacity: 0.95 }).addTo(map);
      pl._isTL = true;

      pl.bindTooltip(`
        <div style="min-width:170px;font-family:monospace">
          <div style="font-weight:700;color:#38bdf8;margin-bottom:3px">${road.name}</div>
          <div style="color:${color};font-size:12px;font-weight:700">● ${label}</div>
          <div style="color:#475569;font-size:10px">🔮 LSTM — ${result.confidence}% confidence</div>
        </div>
      `, { sticky:true, offset:[10,0] });

      pl.on("click", (e) => { L.DomEvent.stopPropagation(e); _onSelect?.(road); });

    } else {
      // No prediction available — draw normally with base flow color
      const traffic = getTrafficLevel(road.baseFlow);
      const pl = L.polyline(coords, { color: traffic.color, weight: traffic.weight, opacity: 0.55 }).addTo(map);
      pl._isTL = true;

      pl.bindTooltip(`
        <div style="min-width:170px;font-family:monospace">
          <div style="font-weight:700;color:#38bdf8;margin-bottom:3px">${road.name}</div>
          <div style="color:#475569;font-size:11px">No LSTM data for this road</div>
        </div>
      `, { sticky:true, offset:[10,0] });

      pl.on("click", (e) => { L.DomEvent.stopPropagation(e); _onSelect?.(road); });
    }
  }
}