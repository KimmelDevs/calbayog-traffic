// pages/api/roads.js
// Fetches only the 4 roads with real training data from Overpass.

export default async function handler(req, res) {
  const BBOX       = "12.062,124.597,12.078,124.612";
  const GOMEZ_BBOX = "12.062,124.590,12.078,124.612";

  const EXACT_NAMES = [
    "Cajurao Street",
    "Magsaysay Boulevard",
    "Rueda Street",
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

    const raw = await response.json();

    // Clip Gomez to only the middle segment
    const data = {
      ...raw,
      elements: (raw.elements || []).map(way => {
        const name = way.tags?.name || "";
        if (/Gomez/i.test(name) && way.geometry) {
          return {
            ...way,
            geometry: way.geometry.filter(n => n.lat >= 12.0675 && n.lat <= 12.0715),
          };
        }
        return way;
      }).filter(way => !way.geometry || way.geometry.length >= 2),
    };

    return res.status(200).json(data);
  } catch (err) {
    console.error("Overpass fetch error:", err);
    return res.status(502).json({ error: "Failed to reach Overpass API" });
  }
}
