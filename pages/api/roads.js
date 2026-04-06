// pages/api/roads.js
// Fetches named Calbayog proper streets from Overpass in one query.

export default async function handler(req, res) {
  // Main city grid bbox
  const BBOX = "12.062,124.597,12.078,124.612";

  // Gomez extended west to 124.590 to reach the pantalan (port/waterfront)
  const GOMEZ_BBOX = "12.062,124.590,12.078,124.612";

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

  const query = `
[out:json][timeout:30];
(
  ${exactFilters}
  way["name"~"Gomez",i](${GOMEZ_BBOX});
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
