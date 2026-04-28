// lib/trafficData.js
// ── Real LSTM inference via TensorFlow.js ─────────────────────────────────
import { supabase } from "./supabase";

// ── Scaler config (must match your training data) ─────────────────────────
const VEHICLE_MIN = 19;
const VEHICLE_MAX = 143;

// ── Location encoding (must match LabelEncoder from training) ─────────────
const LOCATION_ENCODING = {
  "Cajurao Street":              0,
  "Magsaysay Boulevard":         1,
  "Rueda Street":                2,
  "Senator Tomas Gomez Street":  3,
};

// JS day (0=Sun) → Python day_encoded (0=Mon) used in training
const JS_DAY_TO_ENCODED = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 };

const CLASS_NAMES = ["LIGHT", "MODERATE", "TRAFFIC"];
const LOOKBACK    = 8;
const N_FEATURES  = 12;

// ── Singleton model loader ─────────────────────────────────────────────────
let _model       = null;
let _loadPromise = null;

export async function loadModel() {
  if (_model) return _model;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    console.log("[LSTM] Loading model from /tfjs_model/model.json...");
    const tf = await import("@tensorflow/tfjs");
    console.log("[LSTM] TensorFlow.js version:", tf.version?.tfjs ?? "unknown");
    try {
      _model = await tf.loadLayersModel("/tfjs_model/model.json");
      console.log("[LSTM] ✅ Loaded as LayersModel");
    } catch (e1) {
      console.warn("[LSTM] LayersModel failed, trying GraphModel...", e1.message);
      try {
        _model = await tf.loadGraphModel("/tfjs_model/model.json");
        console.log("[LSTM] ✅ Loaded as GraphModel");
      } catch (e2) {
        console.error("[LSTM] ❌ Both loaders failed:", e2.message);
        throw e2;
      }
    }
    console.log("[LSTM] Input shape:", JSON.stringify(_model.inputs?.[0]?.shape ?? "unknown"));
    console.log("[LSTM] Output shape:", JSON.stringify(_model.outputs?.[0]?.shape ?? "unknown"));
    if (typeof window !== "undefined") window.__lstmModel = _model;
    return _model;
  })();
  return _loadPromise;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function minMaxScale(value) {
  return (value - VEHICLE_MIN) / (VEHICLE_MAX - VEHICLE_MIN);
}

function unscale(scaledValue) {
  return scaledValue * (VEHICLE_MAX - VEHICLE_MIN) + VEHICLE_MIN;
}

// ── Feature builder ────────────────────────────────────────────────────────
// Feature layout must exactly match FEATURE_COLS order from training:
//   [0] Location_encoded
//   [1] Vehicle_Count_scaled   → scaledFlow (0–1)
//   [2] Scaled_lag1            → scaledFlow (0–1)
//   [3] Scaled_lag2            → scaledFlow (0–1)
//   [4] Scaled_lag3            → scaledFlow (0–1)
//   [5] Scaled_lag4            → scaledFlow (0–1)
//   [6] Rolling_Mean_4         → RAW vehicle count (19–143), NOT scaled
//   [7] is_anomaly
//   [8] hour_sin
//   [9] hour_cos
//  [10] day_sin
//  [11] day_cos
function buildFeatureStep(locationEnc, scaledFlow, hour, dayEncoded, lag1, lag2, lag3, lag4, rollingMean, isAnomaly = 0) {
  const hSin = Math.sin(2 * Math.PI * hour / 24);
  const hCos = Math.cos(2 * Math.PI * hour / 24);
  const dSin = Math.sin(2 * Math.PI * dayEncoded / 7);
  const dCos = Math.cos(2 * Math.PI * dayEncoded / 7);

  return [
    locationEnc,   // [0] Location_encoded
    scaledFlow,    // [1] Vehicle_Count_scaled
    lag1,          // [2] Scaled_lag1  ← actual 1-hour-prior scaled count
    lag2,          // [3] Scaled_lag2  ← actual 2-hours-prior scaled count
    lag3,          // [4] Scaled_lag3  ← actual 3-hours-prior scaled count
    lag4,          // [5] Scaled_lag4  ← actual 4-hours-prior scaled count
    rollingMean,   // [6] Rolling_Mean_4  ← raw avg of last 4 counts, NOT scaled
    isAnomaly,     // [7] is_anomaly
    hSin,          // [8] hour_sin
    hCos,          // [9] hour_cos
    dSin,          // [10] day_sin
    dCos,          // [11] day_cos
  ];
}

// ── Core prediction function ───────────────────────────────────────────────
export async function predictCongestion(locationName, hour, jsDayOfWeek, vehicleCount = null, isAnomaly = 0) {
  // hour is a decimal (e.g. 8.25 = 8:15 AM). Convert to human-readable for logging.
  const hourInt  = Math.floor(hour);
  const minPart  = Math.round((hour - hourInt) * 60);
  const hourLabel = `${String(hourInt).padStart(2,"0")}:${String(minPart).padStart(2,"0")}`;
  console.log(`[PREDICT] Road: "${locationName}" | Time: ${hourLabel} | Day: ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][jsDayOfWeek]}`);

  const tf          = await import("@tensorflow/tfjs");
  const model       = await loadModel();
  const locationEnc = LOCATION_ENCODING[locationName] ?? 0;
  const dayEncoded  = JS_DAY_TO_ENCODED[jsDayOfWeek] ?? 0;
  const segment     = ROAD_SEGMENTS.find(s => s.name === locationName);
  const baseFlow    = segment?.baseFlow ?? 300;

  console.log(`[PREDICT] locationEnc=${locationEnc} dayEncoded=${dayEncoded} baseFlow=${baseFlow} vehicleCount=${vehicleCount}`);

  // Step 1: try to fetch real historical averages per hour for this road+day from Supabase.
  // Build a lookup: hour → average vehicle count from all past entries matching road+day.
  let historyByHour = {};
  try {
    const { data: histRows } = await supabase
      .from("traffic_logs")
      .select("hour, vehicle_count")
      .eq("location", locationName)
      .eq("day_of_week", jsDayOfWeek)
      .order("recorded_at", { ascending: false })
      .limit(200);

    if (histRows && histRows.length > 0) {
      // Group by hour (decimal) and average; use exact match with small tolerance
      const grouped = {};
      for (const row of histRows) {
        const key = Math.round(row.hour * 4) / 4; // round to nearest 0.25
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row.vehicle_count);
      }
      for (const [h, counts] of Object.entries(grouped)) {
        historyByHour[Number(h)] = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
      }
      console.log(`[PREDICT] ✅ Real history loaded: ${histRows.length} entries, ${Object.keys(historyByHour).length} hours covered`);
    } else {
      console.log("[PREDICT] ℹ️ No history in DB yet — using simulation fallback");
    }
  } catch (e) {
    console.warn("[PREDICT] Could not fetch Supabase history:", e.message);
  }

  // Step 2: collect raw vehicle counts for all 8 past time slots (oldest → newest).
  // Slots are spaced by 0.25 hours (15 min). pastHour is a decimal.
  const rawFlows = [];
  for (let i = LOOKBACK - 1; i >= 0; i--) {
    // Step back in 15-min increments, wrap around 24h
    const pastHour = ((hour - i * 0.25) % 24 + 24) % 24;
    const roundedPastHour = Math.round(pastHour * 4) / 4; // snap to nearest 0.25
    let rawCount;
    if (i === 0 && vehicleCount !== null) {
      rawCount = vehicleCount;
    } else if (historyByHour[roundedPastHour] !== undefined) {
      rawCount = historyByHour[roundedPastHour];
    } else {
      // Fall back to simulation using decimal hour
      rawCount = simulateLSTMFlow(baseFlow, pastHour, jsDayOfWeek);
    }
    rawFlows.push({ pastHour, rawCount });
  }

  // Step 3: build each feature step with REAL lag values (not copies of current)
  const sequence = rawFlows.map((step, idx) => {
    const scaledFlow = minMaxScale(step.rawCount);
    // Look back into rawFlows for actual prior counts; fall back to current if not enough history
    const lag1 = minMaxScale((rawFlows[idx - 1] ?? rawFlows[0]).rawCount);
    const lag2 = minMaxScale((rawFlows[idx - 2] ?? rawFlows[0]).rawCount);
    const lag3 = minMaxScale((rawFlows[idx - 3] ?? rawFlows[0]).rawCount);
    const lag4 = minMaxScale((rawFlows[idx - 4] ?? rawFlows[0]).rawCount);
    // Rolling mean of up to last 4 raw counts (matches training: raw, not scaled)
    const window = rawFlows.slice(Math.max(0, idx - 3), idx + 1);
    const rollingMean = window.reduce((sum, s) => sum + s.rawCount, 0) / window.length;

    return buildFeatureStep(locationEnc, scaledFlow, step.pastHour, dayEncoded, lag1, lag2, lag3, lag4, rollingMean, isAnomaly);
  });

  console.log(`[PREDICT] Sequence built — shape: [1, ${LOOKBACK}, ${N_FEATURES}]`);
  console.log(`[PREDICT] First step features:`, sequence[0]);

  const inputTensor = tf.tensor3d([sequence], [1, LOOKBACK, N_FEATURES]);
  const probsTensor = model.predict(inputTensor);
  const probs       = Array.from(await probsTensor.data());
  inputTensor.dispose();
  probsTensor.dispose();

  const classIdx   = probs.indexOf(Math.max(...probs));
  const label      = CLASS_NAMES[classIdx];
  const confidence = Math.round(probs[classIdx] * 100);

  const actualVehicleCount = rawFlows[LOOKBACK - 1].rawCount;

  console.log(`[PREDICT] ✅ Result: ${label} (${confidence}%) | LIGHT=${Math.round(probs[0]*100)}% MODERATE=${Math.round(probs[1]*100)}% TRAFFIC=${Math.round(probs[2]*100)}% | vehicleCount=${actualVehicleCount}`);

  return {
    label,
    confidence,
    probabilities: {
      LIGHT:    Math.round(probs[0] * 100),
      MODERATE: Math.round(probs[1] * 100),
      TRAFFIC:  Math.round(probs[2] * 100),
    },
    vehicleCount: actualVehicleCount,
  };
}

// ── Map congestion label → display properties ──────────────────────────────
export function getTrafficLevelFromLabel(label) {
  switch (label) {
    case "LIGHT":    return { label: "Light",    color: "#22c55e", bg: "#22c55e22", weight: 4 };
    case "MODERATE": return { label: "Moderate", color: "#f59e0b", bg: "#f59e0b22", weight: 5 };
    case "TRAFFIC":  return { label: "Heavy",    color: "#ef4444", bg: "#ef444422", weight: 9 };
    default:         return { label: "Unknown",  color: "#94a3b8", bg: "#94a3b822", weight: 4 };
  }
}

// ── Legacy flow-based level (kept for fallback) ────────────────────────────
export function getTrafficLevel(flow) {
  if (flow < 200) return { label: "Light",    color: "#22c55e", bg: "#22c55e22", weight: 4 };
  if (flow < 350) return { label: "Moderate", color: "#f59e0b", bg: "#f59e0b22", weight: 5 };
  if (flow < 500) return { label: "Heavy",    color: "#f97316", bg: "#f9731622", weight: 7 };
  return               { label: "Congested", color: "#ef4444", bg: "#ef444422", weight: 9 };
}

// ── Simulation ─────────────────────────────────────────────────────────────
// Per-day multipliers: Mon=busiest commute, Fri=slightly elevated,
// Sat=midday leisure bump, Sun=quietest. Each day has its own character.
const DAY_FACTORS = {
  0: { base: -0.30, morningScale: 0.3, eveningScale: 0.5 }, // Sunday   – very quiet
  1: { base:  0.12, morningScale: 0.7, eveningScale: 0.9 }, // Monday   – strong commute
  2: { base:  0.05, morningScale: 0.6, eveningScale: 0.8 }, // Tuesday  – normal weekday
  3: { base:  0.00, morningScale: 0.6, eveningScale: 0.8 }, // Wednesday– normal weekday
  4: { base:  0.08, morningScale: 0.6, eveningScale: 0.85 }, // Thursday – slight uptick
  5: { base:  0.15, morningScale: 0.5, eveningScale: 1.0 }, // Friday   – big afternoon rush
  6: { base: -0.15, morningScale: 0.4, eveningScale: 0.6 }, // Saturday – leisure pattern
};

export function simulateLSTMFlow(baseFlow, hour, dayOfWeek) {
  const df = DAY_FACTORS[dayOfWeek] ?? DAY_FACTORS[3];

  const peakMorning = Math.exp(-0.5 * Math.pow((hour - 7.5)  / 1.2, 2));
  const peakEvening = Math.exp(-0.5 * Math.pow((hour - 17.5) / 1.3, 2));
  const nightDip    = (hour >= 22 || hour <= 5) ? -0.5 : 0;
  const noise       = (Math.random() - 0.5) * 0.08;

  const signal = Math.max(0, Math.min(1,
    0.1
    + peakMorning * df.morningScale
    + peakEvening * df.eveningScale
    + nightDip
    + df.base
    + noise
  ));

  return Math.round(VEHICLE_MIN + signal * (VEHICLE_MAX - VEHICLE_MIN));
}

// ── Generate full-day series using real LSTM predictions ──────────────────
export async function generateFullDaySeriesLSTM(locationName, jsDayOfWeek) {
  const results = [];
  for (let h = 0; h < 24; h++) {
    const pred = await predictCongestion(locationName, h, jsDayOfWeek);
    results.push({
      hour:  h,
      label: `${String(h).padStart(2, "0")}:00`,
      congestion:    pred.label,
      confidence:    pred.confidence,
      probabilities: pred.probabilities,
      flow: pred.vehicleCount ?? (pred.label === "TRAFFIC"   ? 520
          : pred.label === "MODERATE"  ? 275
          : 120),
    });
  }
  return results;
}

// ── Legacy sync version (kept for backward compat) ────────────────────────
export function generateFullDaySeries(baseFlow, dayOfWeek) {
  return Array.from({ length: 24 }, (_, h) => ({
    hour:  h,
    label: `${String(h).padStart(2, "0")}:00`,
    flow:  simulateLSTMFlow(baseFlow, h, dayOfWeek),
  }));
}

// ── Road segments ──────────────────────────────────────────────────────────
export const ROAD_SEGMENTS = [
  { id: 1, name: "Cajurao Street",             shortName: "Cajurao St",    from: [12.0716, 124.5992], to: [12.0714, 124.6075], baseFlow: 175, description: "Connecting street in the city proper" },
  { id: 2, name: "Magsaysay Boulevard",        shortName: "Magsaysay Blvd",from: [12.0712, 124.5978], to: [12.0708, 124.6100], baseFlow: 480, description: "Main east-west boulevard through Calbayog City proper" },
  { id: 3, name: "Rueda Street",               shortName: "Rueda St",      from: [12.0760, 124.6025], to: [12.0680, 124.6021], baseFlow: 420, description: "North-south street near city center" },
  { id: 4, name: "Senator Tomas Gomez Street", shortName: "T. Gomez St",   from: [12.0724, 124.5995], to: [12.0722, 124.6080], baseFlow: 200, description: "Named street in the Calbayog city grid" },
];

export const MAP_CENTER   = [12.0700, 124.6045];
export const MAP_ZOOM     = 15;
export const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];