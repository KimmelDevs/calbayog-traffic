// components/TrafficMap.jsx
import { useEffect, useRef, useState } from "react";
import { getTrafficLevel, generateFullDaySeries, MAP_CENTER, MAP_ZOOM } from "../lib/trafficData";

// Module-level ref so Leaflet closures always call the latest onSelectSegment
let _onSelect = null;

export default function TrafficMap({ segments, selectedHour, onSelectSegment, onSegmentUpdate }) {
  const mapRef     = useRef(null);
  const mapObjRef  = useRef(null); // { map, L }
  const osmRoadsRef = useRef([]);  // full OSM roads with geometry

  const [status,   setStatus]   = useState("loading"); // loading | ready | error
  const [roadCount, setRoadCount] = useState(0);

  // Insert-data panel
  const [panelOpen, setPanelOpen] = useState(true);
  const [form,      setForm]      = useState({ roadId: "", vehicles: "", avgSpeed: "" });
  const [applied,   setApplied]   = useState(false);

  const previewFlow  = parseInt(form.vehicles);
  const previewLevel = !isNaN(previewFlow) && previewFlow >= 0 ? getTrafficLevel(previewFlow) : null;

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
        setStatus("ready");
        drawRoads(map, L, roads, segments, selectedHour);
      } catch (err) {
        console.error("Failed to load roads:", err);
        setStatus("error");
        // Fall back to drawing static segments
        drawRoads(map, L, [], segments, selectedHour);
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
    drawRoads(ref.map, ref.L, osmRoadsRef.current, segments, selectedHour);
  }, [segments, selectedHour]);

  // ── Apply insert-data form ─────────────────────────────────────
  const handleApply = () => {
    const flow = parseInt(form.vehicles);
    const spd  = parseInt(form.avgSpeed);
    if (isNaN(flow) || flow < 0 || !form.roadId) return;

    const updated = osmRoadsRef.current.map(r =>
      String(r.id) === form.roadId
        ? { ...r, baseFlow: flow, avgSpeed: !isNaN(spd) && spd > 0 ? spd : r.avgSpeed }
        : r
    );
    osmRoadsRef.current = updated;

    const ref = mapObjRef.current;
    if (ref) drawRoads(ref.map, ref.L, updated, segments, selectedHour);

    if (onSegmentUpdate) {
      const road = updated.find(r => String(r.id) === form.roadId);
      if (road) onSegmentUpdate(road);
    }

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const roadOptions = osmRoadsRef.current.map(r => ({ value: String(r.id), label: r.name }));

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
        {status === "ready"   && `✓  ${roadCount} STREETS ACTIVE  ·  CLICK A ROAD TO INSPECT`}
        {status === "error"   && "⚠  OVERPASS UNAVAILABLE — SHOWING FALLBACK DATA"}
      </div>

      {/* ── Insert Road Data panel ── */}
      {panelOpen ? (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 1000,
          background: "#0f172af5", border: "1px solid #1e3a5f",
          borderRadius: 10, padding: "14px 16px", width: 240,
          backdropFilter: "blur(8px)", fontFamily: "'JetBrains Mono', monospace",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.1em", fontWeight: 700 }}>
              INSERT ROAD DATA
            </span>
            <button onClick={() => setPanelOpen(false)} style={{
              background: "none", border: "none", color: "#475569",
              cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0,
            }}>✕</button>
          </div>

          {/* Road selector */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>ROAD</div>
            <select
              value={form.roadId}
              onChange={e => setForm({ ...form, roadId: e.target.value })}
              style={{
                width: "100%", background: "#1e293b", border: "1px solid #1e3a5f",
                borderRadius: 5, padding: "6px 8px", fontSize: 11, color: "#94a3b8",
                fontFamily: "inherit",
              }}
            >
              <option value="">— select road —</option>
              {roadOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {status === "loading" && (
              <div style={{ fontSize: 9, color: "#334155", marginTop: 3 }}>loading streets…</div>
            )}
          </div>

          {/* Vehicle count */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>
              VEHICLE COUNT (veh/hr)
            </div>
            <input
              type="number" min={0} max={9999} placeholder="e.g. 450"
              value={form.vehicles}
              onChange={e => setForm({ ...form, vehicles: e.target.value })}
              style={{
                width: "100%", background: "#1e293b", border: "1px solid #1e3a5f",
                borderRadius: 5, padding: "6px 8px", fontSize: 11, color: "#e2e8f0",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Live level preview */}
          {previewLevel && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#1e293b", border: `1px solid ${previewLevel.color}44`,
              borderRadius: 5, padding: "5px 8px", marginBottom: 6,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: previewLevel.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 10, color: previewLevel.color, fontWeight: 700 }}>
                {previewLevel.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 9, color: "#334155", marginLeft: "auto" }}>
                {previewFlow < 200 ? "<200" : previewFlow < 350 ? "200–349" : previewFlow < 500 ? "350–499" : "≥500"}
              </span>
            </div>
          )}

          {/* Avg speed */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 4 }}>
              AVG SPEED (km/h)
            </div>
            <input
              type="number" min={0} max={120} placeholder="e.g. 30"
              value={form.avgSpeed}
              onChange={e => setForm({ ...form, avgSpeed: e.target.value })}
              style={{
                width: "100%", background: "#1e293b", border: "1px solid #1e3a5f",
                borderRadius: 5, padding: "6px 8px", fontSize: 11, color: "#e2e8f0",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={!form.roadId || !form.vehicles}
            style={{
              width: "100%", padding: "8px 0", borderRadius: 6, border: "none",
              background: applied
                ? "#1d4ed8"
                : (!form.roadId || !form.vehicles ? "#1e293b" : "#3b82f6"),
              color: applied
                ? "#93c5fd"
                : (!form.roadId || !form.vehicles ? "#334155" : "#fff"),
              fontSize: 11, fontWeight: 700,
              cursor: !form.roadId || !form.vehicles ? "not-allowed" : "pointer",
              letterSpacing: "0.08em", transition: "background 0.2s", fontFamily: "inherit",
            }}
          >
            {applied ? "✓  APPLIED!" : "APPLY TO MAP"}
          </button>

          {/* Level guide */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1e293b" }}>
            <div style={{ fontSize: 8, color: "#334155", letterSpacing: "0.1em", marginBottom: 6 }}>
              AUTO-LEVEL GUIDE
            </div>
            {[
              { range: "< 200 veh/hr",   color: "#22c55e", label: "Light"     },
              { range: "200–349 veh/hr", color: "#f59e0b", label: "Moderate"  },
              { range: "350–499 veh/hr", color: "#f97316", label: "Heavy"     },
              { range: "≥ 500 veh/hr",   color: "#ef4444", label: "Congested" },
            ].map(({ range, color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                <span style={{ fontSize: 9, color, width: 62, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 9, color: "#334155" }}>{range}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 1000,
            background: "#0f172a", border: "1px solid #1e3a5f", color: "#38bdf8",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em",
            padding: "7px 14px", borderRadius: 6, cursor: "pointer",
          }}
        >
          + INSERT DATA
        </button>
      )}
    </div>
  );
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
      const traffic = getTrafficLevel(road.baseFlow);

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
          <div style="color:#94a3b8;font-size:11px">📊 ${road.baseFlow.toLocaleString()} veh/hr</div>
          ${road.avgSpeed ? `<div style="color:#94a3b8;font-size:11px">🏎 ${road.avgSpeed} km/h avg</div>` : ""}
          <div style="color:${traffic.color};font-size:11px">● ${traffic.label}</div>
          <div style="color:#475569;font-size:10px;margin-top:3px">${road.highway}</div>
        </div>
      `, { sticky: true, offset: [10, 0] });

      pl.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        _onSelect?.(road);
      });

      // ── Divider marker at the split point of Avelino ─────────
      if (road.name === "Jose D. Avelino Street(1)" && coords.length > 0) {
        const splitPt = coords[coords.length - 1];
        // White gap circle — visually breaks the two halves
        const divOuter = L.circleMarker(splitPt, {
          radius: 7, color: "#0f172a", fillColor: "#0f172a",
          fillOpacity: 1, weight: 3,
        }).addTo(map);
        divOuter._isTL = true;
        // Coloured ring on top
        const divInner = L.circleMarker(splitPt, {
          radius: 4, color: "#fff", fillColor: "#fff",
          fillOpacity: 1, weight: 2,
        }).addTo(map);
        divInner._isTL = true;
        divInner.bindTooltip("SPLIT POINT", { permanent: false, direction: "top", offset: [0, -8] });
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
