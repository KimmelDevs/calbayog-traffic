// pages/api/predict.js
// NOTE: TensorFlow.js runs client-side in this app.
// This API route is kept for server-side or testing use only.
// For real predictions, call predictCongestion() from lib/trafficData.js directly in your components.

import { ROAD_SEGMENTS, simulateLSTMFlow } from "../../lib/trafficData";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { segmentId, hours } = req.query;
  const seg = ROAD_SEGMENTS.find((s) => s.id === Number(segmentId));

  if (segmentId && !seg) {
    return res.status(404).json({ error: `Segment ${segmentId} not found` });
  }

  const segments    = seg ? [seg] : ROAD_SEGMENTS;
  const day         = new Date().getDay();
  const targetHours = hours
    ? hours.split(",").map(Number)
    : Array.from({ length: 24 }, (_, i) => i);

  // ⚠️  Still using simulation here — real inference runs client-side via TF.js
  // To use the real model server-side, set up a Python FastAPI sidecar instead
  const predictions = segments.map((s) => ({
    id:   s.id,
    name: s.name,
    predictions: targetHours.map((h) => ({
      hour:  h,
      label: `${String(h).padStart(2, "0")}:00`,
      flow:  simulateLSTMFlow(s.baseFlow, h, day),
    })),
  }));

  return res.status(200).json({
    success:   true,
    timestamp: new Date().toISOString(),
    dayOfWeek: day,
    note:      "Server-side simulation. Real LSTM predictions run client-side via TF.js.",
    data:      predictions,
  });
}
