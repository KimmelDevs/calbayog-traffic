// pages/api/roads.js
// Fetches all 18 named Calbayog proper streets from Overpass in one query.
// No lat/lng needed — streets are fetched by name within the city bbox.

export default async function handler(req, res) {
  // Bounding box covering all of Calbayog proper
  // south, west, north, east
  const BBOX = "12.060,124.595,12.080,124.615";

  // All 18 streets by exact OSM name
  const STREET_NAMES = [
    "Magsaysay Boulevard",
    "Navarro Street",
    "Senator Tomas Gomez Street",
    "Cajurao Street",
    "Rosales Boulevard",
    "Bugallon Street",
    "Umbria Street",
    "Jose D. Avelino Street",
    "Asis Street",
    "Rama Street",
    "Burgos Street",
    "Pido Street",
    "Orquin Street",
    "Pajarito Street",
    "Rueda Street",
    "Licenciado Street",
    "Nijaga Street",
    "Maharlika Highway",
  ];

  // Build one Overpass query that fetches all ways by name inside the bbox
  const nameFilters = STREET_NAMES.map(
    (n) => `way["name"="${n}"](${BBOX});`
  ).join("\n");

  // Also fetch Road #318478450 by OSM id directly
  const query = `
[out:json][timeout:25];
(
  ${nameFilters}
  way(318478450);
);
out geom;
`.trim();

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Overpass returned ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Overpass fetch error:", err);
    return res.status(502).json({ error: "Failed to reach Overpass API" });
  }
}
