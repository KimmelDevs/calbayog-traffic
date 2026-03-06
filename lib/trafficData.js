// lib/trafficData.js

export const ROAD_SEGMENTS = [
  {
    id: 1,
    name: "Maharlika Highway (North)",
    shortName: "Maharlika N.",
    from: [12.075, 124.595],
    to: [12.068, 124.602],
    baseFlow: 320,
    description: "Main northern entry corridor into Calbayog City proper",
  },
  {
    id: 2,
    name: "Maharlika Highway (South)",
    shortName: "Maharlika S.",
    from: [12.068, 124.602],
    to: [12.058, 124.607],
    baseFlow: 410,
    description: "Southern extension of the national highway through the city",
  },
  {
    id: 3,
    name: "Mabini St – City Proper",
    shortName: "Mabini St.",
    from: [12.068, 124.602],
    to: [12.066, 124.606],
    baseFlow: 280,
    description: "Primary city center street connecting key government buildings",
  },
  {
    id: 4,
    name: "Rizal Boulevard",
    shortName: "Rizal Blvd.",
    from: [12.066, 124.606],
    to: [12.064, 124.61],
    baseFlow: 195,
    description: "Coastal boulevard running along the waterfront",
  },
  {
    id: 5,
    name: "Sto. Niño – Market Road",
    shortName: "Market Rd.",
    from: [12.065, 124.604],
    to: [12.062, 124.608],
    baseFlow: 460,
    description: "High-traffic commercial corridor near the public market",
  },
  {
    id: 6,
    name: "Obrero Road",
    shortName: "Obrero Rd.",
    from: [12.062, 124.608],
    to: [12.06, 124.612],
    baseFlow: 150,
    description: "Residential connector road in Barangay Obrero",
  },
  {
    id: 7,
    name: "Rosales Street",
    shortName: "Rosales St.",
    from: [12.066, 124.606],
    to: [12.069, 124.609],
    baseFlow: 220,
    description: "Secondary street near the city hall district",
  },
  {
    id: 8,
    name: "San Joaquin Road",
    shortName: "San Joaquin",
    from: [12.058, 124.607],
    to: [12.056, 124.611],
    baseFlow: 175,
    description: "Access road to residential zone south of the city proper",
  },
];

/**
 * Simulates LSTM-style traffic flow prediction.
 * In production, replace this with an actual API call to your
 * trained LSTM model (e.g., POST /api/predict).
 *
 * The formula approximates:
 * - Morning peak: 7:00–9:00
 * - Evening peak: 17:00–19:00
 * - Night trough: 22:00–05:00
 * - Weekend reduction
 */
export function simulateLSTMFlow(baseFlow, hour, dayOfWeek) {
  const peakMorning = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.2, 2)) * 220;
  const peakEvening = Math.exp(-0.5 * Math.pow((hour - 17.5) / 1.3, 2)) * 260;
  const nightDip = hour >= 22 || hour <= 5 ? -100 : 0;
  const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? -80 : 0;
  const noise = (Math.random() - 0.5) * 25;
  return Math.max(10, Math.round(baseFlow + peakMorning + peakEvening + nightDip + weekendFactor + noise));
}

export function generateFullDaySeries(baseFlow, dayOfWeek) {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    flow: simulateLSTMFlow(baseFlow, h, dayOfWeek),
  }));
}

export function getTrafficLevel(flow) {
  if (flow < 200) return { label: "Light", color: "#22c55e", bg: "#22c55e22", weight: 4 };
  if (flow < 350) return { label: "Moderate", color: "#f59e0b", bg: "#f59e0b22", weight: 5 };
  if (flow < 500) return { label: "Heavy", color: "#f97316", bg: "#f9731622", weight: 7 };
  return { label: "Congested", color: "#ef4444", bg: "#ef444422", weight: 9 };
}

export const MAP_CENTER = [12.065, 124.606];
export const MAP_ZOOM = 14;

export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
