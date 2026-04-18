// lib/trafficData.js
// ── Real LSTM inference via TensorFlow.js ─────────────────────────────────

// ── Scaler config (must match your training data) ─────────────────────────
const VEHICLE_MIN = 10;
const VEHICLE_MAX = 650;

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
    const tf = await import("@tensorflow/tfjs");
    _model = await tf.loadLayersModel("/tfjs_model/model.json");
    console.log("✅ LSTM model loaded");
    return _model;
  })();
  return _loadPromise;
}

// ── Feature builder ────────────────────────────────────────────────────────
function minMaxScale(value) {
  return (value - VEHICLE_MIN) / (VEHICLE_MAX - VEHICLE_MIN);
}

function buildFeatureStep(locationEnc, scaledFlow, hour, dayEncoded, isAnomaly = 0) {
  const hSin = Math.sin(2 * Math.PI * hour / 24);
  const hCos = Math.cos(2 * Math.PI * hour / 24);
  const dSin = Math.sin(2 * Math.PI * dayEncoded / 7);
  const dCos = Math.cos(2 * Math.PI * dayEncoded / 7);
  return [
    locationEnc,
    scaledFlow,
    scaledFlow, scaledFlow, scaledFlow, scaledFlow,
    scaledFlow,
    isAnomaly,
    hSin, hCos, dSin, dCos,
  ];
}

// ── Core prediction function ───────────────────────────────────────────────
export async function predictCongestion(locationName, hour, jsDayOfWeek) {
  const tf          = await import("@tensorflow/tfjs");
  const model       = await loadModel();
  const locationEnc = LOCATION_ENCODING[locationName] ?? 1;
  const dayEncoded  = JS_DAY_TO_ENCODED[jsDayOfWeek] ?? 0;
  const segment     = ROAD_SEGMENTS.find(s => s.name === locationName);
  const baseFlow    = segment?.baseFlow ?? 300;

  const sequence = [];
  for (let i = LOOKBACK - 1; i >= 0; i--) {
    const pastHour   = ((hour - i) + 24) % 24;
    const scaledFlow = minMaxScale(simulateLSTMFlow(baseFlow, pastHour, jsDayOfWeek));
    sequence.push(buildFeatureStep(locationEnc, scaledFlow, pastHour, dayEncoded));
  }

  const inputTensor = tf.tensor3d([sequence], [1, LOOKBACK, N_FEATURES]);
  const probsTensor = model.predict(inputTensor);
  const probs       = Array.from(await probsTensor.data());
  inputTensor.dispose();
  probsTensor.dispose();

  const classIdx   = probs.indexOf(Math.max(...probs));
  const label      = CLASS_NAMES[classIdx];
  const confidence = Math.round(probs[classIdx] * 100);

  return {
    label,
    confidence,
    probabilities: {
      LIGHT:    Math.round(probs[0] * 100),
      MODERATE: Math.round(probs[1] * 100),
      TRAFFIC:  Math.round(probs[2] * 100),
    },
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

// ── Simulation fallback ────────────────────────────────────────────────────
export function simulateLSTMFlow(baseFlow, hour, dayOfWeek) {
  const peakMorning   = Math.exp(-0.5 * Math.pow((hour - 7.5)  / 1.2, 2)) * 220;
  const peakEvening   = Math.exp(-0.5 * Math.pow((hour - 17.5) / 1.3, 2)) * 260;
  const nightDip      = hour >= 22 || hour <= 5 ? -100 : 0;
  const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? -80 : 0;
  const noise         = (Math.random() - 0.5) * 25;
  return Math.max(10, Math.round(baseFlow + peakMorning + peakEvening + nightDip + weekendFactor + noise));
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
      flow: pred.label === "TRAFFIC"   ? 520
          : pred.label === "MODERATE"  ? 275
          : 120,
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
  { id: 1,  name: "Magsaysay Boulevard",        shortName: "Magsaysay Blvd",  from: [12.0712, 124.5978], to: [12.0708, 124.6100], baseFlow: 480, description: "Main east-west boulevard through Calbayog City proper" },
  { id: 2,  name: "Navarro Street",              shortName: "Navarro St",      from: [12.0730, 124.5988], to: [12.0728, 124.6085], baseFlow: 310, description: "East-west street north of Magsaysay Boulevard" },
  { id: 3,  name: "Senator Tomas Gomez Street",  shortName: "T. Gomez St",     from: [12.0724, 124.5995], to: [12.0722, 124.6080], baseFlow: 200, description: "Named street in the Calbayog city grid" },
  { id: 4,  name: "Cajurao Street",              shortName: "Cajurao St",      from: [12.0716, 124.5992], to: [12.0714, 124.6075], baseFlow: 175, description: "Connecting street in the city proper" },
  { id: 5,  name: "Rosales Boulevard",           shortName: "Rosales Blvd",    from: [12.0698, 124.5988], to: [12.0695, 124.6080], baseFlow: 360, description: "Boulevard running south of Magsaysay" },
  { id: 6,  name: "Bugallon Street",             shortName: "Bugallon St",     from: [12.0662, 124.5990], to: [12.0659, 124.6075], baseFlow: 150, description: "Residential east-west connector" },
  { id: 7,  name: "Umbria Street",               shortName: "Umbria St",       from: [12.0690, 124.5992], to: [12.0688, 124.6070], baseFlow: 160, description: "Street in the southern city grid" },
  { id: 8,  name: "Jose D. Avelino Street",      shortName: "Avelino St",      from: [12.0678, 124.5978], to: [12.0675, 124.6070], baseFlow: 180, description: "Lower east-west street in the city proper" },
  { id: 9,  name: "Asis Street",                 shortName: "Asis St",         from: [12.0705, 124.5994], to: [12.0703, 124.6060], baseFlow: 190, description: "Connector street in the city center" },
  { id: 10, name: "Rama Street",                 shortName: "Rama St",         from: [12.0750, 124.6052], to: [12.0670, 124.6049], baseFlow: 290, description: "North-south mid-city connector" },
  { id: 11, name: "Burgos Street",               shortName: "Burgos St",       from: [12.0748, 124.6072], to: [12.0668, 124.6070], baseFlow: 195, description: "North-south street east of Rama" },
  { id: 12, name: "Pido Street",                 shortName: "Pido St",         from: [12.0760, 124.6100], to: [12.0665, 124.6097], baseFlow: 250, description: "North-south street on the eastern side" },
  { id: 13, name: "Orquin Street",               shortName: "Orquin St",       from: [12.0735, 124.6010], to: [12.0733, 124.6075], baseFlow: 210, description: "Street in the northern city grid" },
  { id: 14, name: "Pajarito Street",             shortName: "Pajarito St",     from: [12.0708, 124.6005], to: [12.0706, 124.6068], baseFlow: 185, description: "Mid-city connecting street" },
  { id: 15, name: "Rueda Street",                shortName: "Rueda St",        from: [12.0760, 124.6025], to: [12.0680, 124.6021], baseFlow: 420, description: "North-south street near city center" },
  { id: 16, name: "Licenciado Street",           shortName: "Licenciado St",   from: [12.0742, 124.6038], to: [12.0740, 124.6080], baseFlow: 165, description: "Street in the upper city grid" },
  { id: 17, name: "Road #318478450",             shortName: "Road #318478450", from: [12.0700, 124.6030], to: [12.0698, 124.6065], baseFlow: 220, description: "OSM road in Calbayog proper" },
];

export const MAP_CENTER   = [12.0700, 124.6045];
export const MAP_ZOOM     = 15;
export const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
