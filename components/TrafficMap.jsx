// components/TrafficMap.jsx
import { useEffect, useRef } from "react";
import { getTrafficLevel, MAP_CENTER, MAP_ZOOM } from "../lib/trafficData";

export default function TrafficMap({ segments, selectedHour, onSelectSegment, onAddRoad }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);

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

      // Loading indicator div (shown while querying Overpass)
      const loadingDiv = document.createElement("div");
      loadingDiv.id = "map-loading";
      loadingDiv.style.cssText = `
        display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        background:#0f172acc;border:1px solid #3b82f6;color:#38bdf8;
        font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;
        padding:10px 20px;border-radius:8px;z-index:1000;pointer-events:none;
        backdrop-filter:blur(4px);
      `;
      loadingDiv.textContent = "⏳ FETCHING ROAD DATA...";
      mapRef.current.appendChild(loadingDiv);

      // Click on map → query Overpass for nearest road
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        loadingDiv.style.display = "block";

        try {
          const road = await fetchNearestRoad(lat, lng);
          if (road) {
            onAddRoad(road);
          } else {
            showToast(mapRef.current, "No road found at this location");
          }
        } catch (err) {
          showToast(mapRef.current, "Could not fetch road data");
        } finally {
          loadingDiv.style.display = "none";
        }
      });

      map._L = L;
      leafletMapRef.current = map;
      drawPolylines(map, L, segments, selectedHour, onSelectSegment);
    });

    return () => {
      if (map) { map.remove(); leafletMapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !map._L) return;
    drawPolylines(map, map._L, segments, selectedHour, onSelectSegment);
  }, [segments, selectedHour]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {/* Hint overlay */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
        background: "#0f172acc", border: "1px solid #1e3a5f", borderRadius: 6,
        padding: "5px 14px", fontSize: 10, color: "#475569", letterSpacing: "0.1em",
        pointerEvents: "none", zIndex: 500, whiteSpace: "nowrap", backdropFilter: "blur(4px)",
      }}>
        🖱 CLICK ANY ROAD TO ADD IT AS A MONITORED SEGMENT
      </div>
    </div>
  );
}

// Query Overpass API for the nearest highway within ~50m of click
async function fetchNearestRoad(lat, lng) {
  const delta = 0.0005; // ~55m bounding box
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;

  const query = `
    [out:json][timeout:10];
    way["highway"~"^(primary|secondary|tertiary|residential|unclassified|trunk|service)$"](${bbox});
    out geom;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });

  const data = await res.json();
  if (!data.elements || data.elements.length === 0) return null;

  // Pick the first result (closest)
  const way = data.elements[0];
  const name = way.tags?.name || way.tags?.["name:en"] || `Road #${way.id}`;
  const nodes = way.geometry;

  if (!nodes || nodes.length < 2) return null;

  // Use first and last node as the segment endpoints
  const from = [nodes[0].lat, nodes[0].lon];
  const to = [nodes[nodes.length - 1].lat, nodes[nodes.length - 1].lon];

  return {
    id: way.id,
    name,
    shortName: name.length > 14 ? name.slice(0, 14) + "…" : name,
    from,
    to,
    baseFlow: 200 + Math.floor(Math.random() * 250),
    description: `${way.tags?.highway || "road"} — OSM id ${way.id}`,
    fromOSM: true,
  };
}

function drawPolylines(map, L, segments, selectedHour, onSelectSegment) {
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
    pl.on("click", () => onSelectSegment(seg));
  });
}

function showToast(container, msg) {
  const t = document.createElement("div");
  t.style.cssText = `
    position:absolute;top:60px;left:50%;transform:translateX(-50%);
    background:#1e293b;border:1px solid #ef4444;color:#ef4444;
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;
    padding:8px 16px;border-radius:6px;z-index:1000;pointer-events:none;
    backdrop-filter:blur(4px);
  `;
  t.textContent = `⚠ ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
