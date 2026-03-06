// pages/api/roads.js
export default async function handler(req, res) {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const delta = 0.003; // ~330m radius — gets all nearby roads
  const bbox = `${+lat - delta},${+lng - delta},${+lat + delta},${+lng + delta}`;
  const query = `[out:json][timeout:15];way["highway"~"^(primary|secondary|tertiary|residential|unclassified|trunk|service)$"](${bbox});out geom;`;

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