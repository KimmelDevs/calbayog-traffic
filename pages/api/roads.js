// pages/api/roads.js
// Fetches named Calbayog proper streets from Overpass in one query.

export default async function handler(req, res) {
  // Tight bbox — Calbayog city proper only, keeps Gomez clipped to the middle section
  // south, west, north, east
  const BBOX = "12.062,124.597,12.078,124.612";

  // Streets fetched by exact name (Maharlika Highway excluded)
  const EXACT_NAMES = [
    "Magsaysay Boulevard",
    "Navarro Street",
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
  ];

  const exactFilters = EXACT_NAMES.map(
    (n) => `way["name"="${n}"](${BBOX});`
  ).join("\n  ");

  // Senator Gomez — regex to catch OSM name variations, same tight bbox keeps only the inner segment
  // Road #318478450 fetched by OSM id but clipped to the same bbox via the (if:) filter
  const query = `
[out:json][timeout:30];
(
  ${exactFilters}
  way["name"~"Gomez",i](${BBOX});
  way(318478450)(${BBOX});
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
