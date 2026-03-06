// components/TrafficMap.jsx
import { useEffect, useRef } from "react";
import { getTrafficLevel, MAP_CENTER, MAP_ZOOM } from "../lib/trafficData";

export default function TrafficMap({ segments, selectedHour, onSelectSegment, onReplaceRoads }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const onReplaceRoadsRef = useRef(onReplaceRoads);
  const onSelectSegmentRef = useRef(onSelectSegment);

  useEffect(() => { onReplaceRoadsRef.current = onReplaceRoads; }, [onReplaceRoads]);
  useEffect(() => { onSelectSegmentRef.current = onSelectSegment; }, [onSelectSegment]);

  useEffect(() => {
    let map = null;

    import("leaflet").then((mod) => {
      const L = mod.default ?? mod;

      if (mapRef.current._leaflet_id) {
        mapRef.current._leaflet_id = null;
      }

      map = L.map(mapRef.current, {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Loading overlay
      const loadingDiv = document.createElement("div");
      loadingDiv.style.cssText = `
        display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        background:#0f172aee;border:1px solid #3b82f6;color:#38bdf8;
        font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;
        padding:12px 24px;border-radius:8px;z-index:2000;pointer-events:none;
      `;
      loadingDiv.textContent = "⏳ LOADING NEARBY ROADS...";
      mapRef.current.appendChild(loadingDiv);

      // Click → fetch all nearby roads and replace current set
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        loadingDiv.style.display = "block";

        try {
          const roads = await fetchNearbyRoads(lat, lng);
          if (roads.length > 0) {
            onReplaceRoadsRef.current(roads);
          } else {
            showToast(mapRef.current, "No roads found here — try clicking on a street");
          }
        } catch (err) {
          showToast(mapRef.current, "Could not fetch roads. Check your connection.");
          console.error(err);
        } finally {
          loadingDiv.style.display = "none";
        }
      });

      map._L = L;
      leafletMapRef.current = map;
      drawPolylines(map, L, segments, selectedHour, onSelectSegmentRef);
    });

    return () => {
      if (map) { map.remove(); leafletMapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !map._L) return;
    drawPolylines(map, map._L, segments, selectedHour, onSelectSegmentRef);
  }, [segments, selectedHour]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        background: "#0f172acc", border: "1px solid #1e3a5f", borderRadius: 6,
        padding: "5px 14px", fontSize: 10, color: "#475569", letterSpacing: "0.1em",
        pointerEvents: "none", zIndex: 500, whiteSpace: "nowrap",
      }}>
        🖱 CLICK ANYWHERE TO LOAD NEARBY ROADS
      </div>
    </div>
  );
}

async function fetchNearbyRoads(lat, lng) {
  const res = await fetch(`/api/roads?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (!data.elements || data.elements.length === 0) return [];

  const roads = [];
  const seen = new Set();

  for (const way of data.elements) {
    if (!way.geometry || way.geometry.length < 2) continue;

    const name = way.tags?.name || way.tags?.["name:en"] || `Road #${way.id}`;

    // Deduplicate by name so we don't get 10 segments of "Maharlika Highway"
    if (seen.has(name)) continue;
    seen.add(name);

    const nodes = way.geometry;
    const from = [nodes[0].lat, nodes[0].lon];
    const to = [nodes[nodes.length - 1].lat, nodes[nodes.length - 1].lon];

    roads.push({
      id: way.id,
      name,
      shortName: name.length > 16 ? name.slice(0, 16) + "…" : name,
      from,
      to,
      baseFlow: 150 + Math.floor(Math.random() * 300),
      description: `${way.tags?.highway || "road"} · OSM ${way.id}`,
      fromOSM: true,
    });
  }

  return roads;
}

function drawPolylines(map, L, segments, selectedHour, onSelectSegmentRef) {
  map.eachLayer((layer) => {
    if (layer._isTrafficLine) layer.remove();
  });

  segments.forEach((seg) => {
    const flow = seg.series?.[selectedHour]?.flow ?? seg.baseFlow;
    const traffic = getTrafficLevel(flow);

    const glow = L.polyline([seg.from, seg.to], {
      color: traffic.color, weight: traffic.weight + 6, opacity: 0.15,
    }).addTo(map);
    glow._isTrafficLine = true;

    const pl = L.polyline([seg.from, seg.to], {
      color: traffic.color, weight: traffic.weight, opacity: 0.9,
    }).addTo(map);
    pl._isTrafficLine = true;

    pl.bindTooltip(
      `<div style="min-width:160px">
        <div style="font-weight:700;color:#38bdf8;margin-bottom:4px">${seg.name}</div>
        <div style="color:#94a3b8;font-size:11px;margin-bottom:2px">📊 ${flow.toLocaleString()} veh/hr</div>
        <div style="color:${traffic.color};font-size:11px">● ${traffic.label}</div>
        <div style="color:#475569;font-size:10px;margin-top:4px">${seg.description}</div>
      </div>`,
      { sticky: true, offset: [10, 0] }
    );

    pl.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      onSelectSegmentRef.current(seg);
    });
  });
}

function showToast(container, msg) {
  const t = document.createElement("div");
  t.style.cssText = `
    position:absolute;top:60px;left:50%;transform:translateX(-50%);
    background:#1e293b;border:1px solid #ef4444;color:#ef4444;
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;
    padding:8px 16px;border-radius:6px;z-index:2000;pointer-events:none;
  `;
  t.textContent = `⚠ ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}