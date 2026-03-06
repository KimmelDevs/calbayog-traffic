// pages/api/predict.js
/**
 * LSTM Traffic Flow Prediction API Route
 *
 * In production, this endpoint should:
 * 1. Accept a road segment ID and target hours
 * 2. Query your trained LSTM model (via TensorFlow Serving, Python backend, etc.)
 * 3. Return predicted vehicle flow values
 *
 * Currently returns simulated data matching the LSTM curve shape.
 */

import { ROAD_SEGMENTS, simulateLSTMFlow } from "../../lib/trafficData";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { segmentId, hours } = req.query;

  // Validate segment
  const seg = ROAD_SEGMENTS.find((s) => s.id === Number(segmentId));
  if (segmentId && !seg) {
    return res.status(404).json({ error: `Segment ${segmentId} not found` });
  }

  const segments = seg ? [seg] : ROAD_SEGMENTS;
  const day = new Date().getDay();
  const targetHours = hours
    ? hours.split(",").map(Number)
    : Array.from({ length: 24 }, (_, i) => i);

  const predictions = segments.map((s) => ({
    id: s.id,
    name: s.name,
    predictions: targetHours.map((h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      flow: simulateLSTMFlow(s.baseFlow, h, day),
      // Replace above with real model inference:
      // flow: await model.predict({ segmentId: s.id, hour: h, dayOfWeek: day })
    })),
  }));

  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    dayOfWeek: day,
    data: predictions,
  });
}
