// components/TrafficMap.jsx
import { useEffect, useRef } from "react";
import { getTrafficLevel, MAP_CENTER, MAP_ZOOM } from "../lib/trafficData";

export default function TrafficMap({ segments, selectedHour, onSelectSegment, onAddRoad }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  // Keep callbacks in refs so the map click closure always has the latest version
  const onAddRoadRef = useRef(onAddRoad);
  const onSelectSegmentRef = useRef(onSelectSegment);

  useEffect(() => { onAddRoadRef.current = onAddRoad; }, [onAddRoad]);
  useEffect(() => { onSelectSegmentRef.current = onSelectSegment; }, [onSelectSegment]);

  // Init map once
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

      const cityIcon = L.divIcon({
        html: `<div style="background:#0f172a;border:1px solid #3b82f6;color:#38bdf8;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;padding:4px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 0 12px #3b82f640;">📍 CALBAYOG CITY PROPER</div>`,
        className: "",
        iconAnchor: [90, 10],
      });
      L.marker([12.066, 124.607], { icon: cityIcon }).addTo(map);

      // Loading toast
      const loadingDiv = document.createElement("div");
      loadingDiv.style.cssText = `
        display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        background:#0f172acc;border:1px solid #3b82f6;color:#38bdf8;
        font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;
        padding:10px 20px;border-radius:8px;z-index:2000;pointer-events:none;
      `;
      loadingDiv.textContent = "⏳ FETCHING ROAD DATA...";
      mapRef.current.appendChild(loadingDiv);
      map._loadingDiv = loadingDiv;

      // Map click → Overpass query
      // Use a flag to prevent firing when clicking a polyline
      map._clickedPolyline = false;
      map.on("click", async (e) => {
        if (map._clickedPolyline) {
          map._clickedPolyline = false;
          return;
        }
        const { lat, lng } = e.latlng;
        loadingDiv.style.display = "block";
        try {
          const road = await fetchNearestRoad(lat, lng);
          if (road) {
            onAddRoadRef.current(road);
          } else {
            showToast(mapRef.current, "No road found here — try clicking closer to a road");
          }
        } catch (err) {
          showToast(mapRef.current, "Could not fetch road data. Check your connection.");
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

  // Redraw polylines when hour or segments change
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
        🖱 CLICK ANY SPOT ON THE MAP TO ADD NEAREST ROAD
      </div>
    </div>
  );
}

async function fetchNearestRoad(lat, lng) {
  // Wider bbox (0.001 ≈ 110m) for easier clicking
  const delta = 0.001;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;

  const query = `[out:json][timeout:15];way["highway"~"^(primary|secondary|tertiary|residential|unclassified|trunk|service|path|footway)$"](${bbox});out geom;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const data = await res.json();
  if (!data.elements || data.elements.length === 0) return null;

  // Find the way whose geometry is closest to the click point
  let best = null;
  let bestDist = Infinity;

  for (const way of data.elements) {
    if (!way.geometry || way.geometry.length < 2) continue;
    // Check distance to each node
    for (const node of way.geometry) {
      const d = Math.hypot(node.lat - lat, node.lon - lng);
      if (d < bestDist) {
        bestDist = d;
        best = way;
      }
    }
  }

  if (!best) return null;

  const name = best.tags?.name || best.tags?.["name:en"] || `Road #${best.id}`;
  const nodes = best.geometry;
  const from = [nodes[0].lat, nodes[0].lon];
  const to = [nodes[nodes.length - 1].lat, nodes[nodes.length - 1].lon];

  return {
    id: best.id,
    name,
    shortName: name.length > 16 ? name.slice(0, 16) + "…" : name,
    from,
    to,
    baseFlow: 150 + Math.floor(Math.random() * 300),
    description: `${best.tags?.highway || "road"} — OSM id ${best.id}`,
    fromOSM: true,
  };
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

    // Mark as polyline click so map click handler skips Overpass fetch
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