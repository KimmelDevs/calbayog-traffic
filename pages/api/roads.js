// pages/api/roads.js
// Real coordinates from OpenStreetMap via Overpass API (fetched 2026-04-21)
// Cajurao Street not found in OSM — approximated from known location

export default function handler(req, res) {
  const data = {
    version: 0.6,
    elements: [
      // ── Magsaysay Boulevard (2 ways merged) ──────────────────────────────
      {
        type: "way", id: 153370079,
        tags: { name: "Magsaysay Boulevard", highway: "tertiary", oneway: "yes" },
        geometry: [
          { lat: 12.0668514, lon: 124.5996369 },
          { lat: 12.0670545, lon: 124.5991563 },
          { lat: 12.067372,  lon: 124.5984048 },
          { lat: 12.0675909, lon: 124.5979221 },
          { lat: 12.0676224, lon: 124.5978585 },
          { lat: 12.0679062, lon: 124.5972858 },
          { lat: 12.0679629, lon: 124.5971736 },
          { lat: 12.0681697, lon: 124.5967394 },
          { lat: 12.0681835, lon: 124.5967100 },
          { lat: 12.0682755, lon: 124.5965134 },
          { lat: 12.0683040, lon: 124.5964525 },
          { lat: 12.0686197, lon: 124.5957837 },
          { lat: 12.0688557, lon: 124.5953110 },
          { lat: 12.0690910, lon: 124.5948165 },
          { lat: 12.0695579, lon: 124.5938576 },
          { lat: 12.0699135, lon: 124.5931202 },
        ],
      },
      {
        type: "way", id: 264030344,
        tags: { name: "Magsaysay Boulevard", highway: "tertiary", oneway: "yes" },
        geometry: [
          { lat: 12.0698461, lon: 124.5930833 },
          { lat: 12.0694840, lon: 124.5938161 },
          { lat: 12.0690290, lon: 124.5947788 },
          { lat: 12.0687771, lon: 124.5952726 },
          { lat: 12.0685606, lon: 124.5957547 },
          { lat: 12.0681149, lon: 124.5966731 },
          { lat: 12.0678313, lon: 124.5972408 },
          { lat: 12.0675828, lon: 124.5977597 },
          { lat: 12.0675516, lon: 124.5978224 },
          { lat: 12.0675234, lon: 124.5978786 },
          { lat: 12.0672990, lon: 124.5983652 },
          { lat: 12.0669853, lon: 124.5991259 },
          { lat: 12.0667895, lon: 124.5996006 },
        ],
      },

      // ── Rueda Street ──────────────────────────────────────────────────────
      {
        type: "way", id: 149402407,
        tags: { name: "Rueda Street", highway: "tertiary" },
        geometry: [
          { lat: 12.0709638, lon: 124.5970657 },
          { lat: 12.0709979, lon: 124.5970041 },
          { lat: 12.0710038, lon: 124.5969718 },
          { lat: 12.0709946, lon: 124.5969357 },
          { lat: 12.0709769, lon: 124.5969182 },
          { lat: 12.0709520, lon: 124.5969008 },
          { lat: 12.0706156, lon: 124.5967264 },
          { lat: 12.0702688, lon: 124.5965776 },
          { lat: 12.0688942, lon: 124.5959198 },
        ],
      },

      // ── Senator Tomas Gomez Street (main ways in the city proper) ─────────
      {
        type: "way", id: 181227877,
        tags: { name: "Senator Tomas Gomez Street", highway: "secondary" },
        geometry: [
          { lat: 12.0721755, lon: 124.5963928 },
          { lat: 12.0714457, lon: 124.5951113 },
          { lat: 12.0714083, lon: 124.5950534 },
          { lat: 12.0713724, lon: 124.5950059 },
          { lat: 12.0713245, lon: 124.5949507 },
          { lat: 12.0712725, lon: 124.5948907 },
          { lat: 12.0712381, lon: 124.5948551 },
          { lat: 12.0712083, lon: 124.5948314 },
          { lat: 12.0700485, lon: 124.5941226 },
        ],
      },
      {
        type: "way", id: 153545262,
        tags: { name: "Senator Tomas Gomez Street", highway: "secondary" },
        geometry: [
          { lat: 12.0700485, lon: 124.5941226 },
          { lat: 12.0695579, lon: 124.5938576 },
          { lat: 12.0694840, lon: 124.5938161 },
          { lat: 12.0691359, lon: 124.5936529 },
        ],
      },
      {
        type: "way", id: 337410417,
        tags: { name: "Senator Tomas Gomez Street", highway: "secondary" },
        geometry: [
          { lat: 12.0691359, lon: 124.5936529 },
          { lat: 12.0688248, lon: 124.5935061 },
          { lat: 12.0685029, lon: 124.5933529 },
          { lat: 12.0684415, lon: 124.5933212 },
        ],
      },
      {
        type: "way", id: 264539136,
        tags: { name: "Senator Tomas Gomez Street", highway: "secondary" },
        geometry: [
          { lat: 12.0684415, lon: 124.5933212 },
          { lat: 12.0683654, lon: 124.5932739 },
          { lat: 12.0680361, lon: 124.5930829 },
          { lat: 12.0676143, lon: 124.5928474 },
        ],
      },

      // ── Cajurao Street (real OSM coordinates) ───────────────────────────
      {
        type: "way", id: 149557784,
        tags: { name: "Cajurao Street", highway: "tertiary", oneway: "yes" },
        geometry: [
          { lat: 12.0688942, lon: 124.5959198 },
          { lat: 12.0691648, lon: 124.5954690 },
          { lat: 12.0694537, lon: 124.5950257 },
        ],
      },
      {
        type: "way", id: 155021770,
        tags: { name: "Cajurao Street", highway: "tertiary", oneway: "yes" },
        geometry: [
          { lat: 12.0694537, lon: 124.5950257 },
          { lat: 12.0698156, lon: 124.5944674 },
          { lat: 12.0700485, lon: 124.5941226 },
          { lat: 12.0704953, lon: 124.5934443 },
        ],
      },
      {
        type: "way", id: 1311923612,
        tags: { name: "Cajurao Street", highway: "tertiary" },
        geometry: [
          { lat: 12.0704953, lon: 124.5934443 },
          { lat: 12.0705171, lon: 124.5934137 },
        ],
      },
      {
        type: "way", id: 155021771,
        tags: { name: "Cajurao Street", highway: "tertiary", bridge: "yes" },
        geometry: [
          { lat: 12.0705171, lon: 124.5934137 },
          { lat: 12.0707793, lon: 124.5930076 },
        ],
      },
      {
        type: "way", id: 254486309,
        tags: { name: "Cajurao Street", highway: "tertiary" },
        geometry: [
          { lat: 12.0707793, lon: 124.5930076 },
          { lat: 12.0709606, lon: 124.5927460 },
          { lat: 12.0711535, lon: 124.5924914 },
          { lat: 12.0713133, lon: 124.5922925 },
          { lat: 12.0715280, lon: 124.5921287 },
          { lat: 12.0727864, lon: 124.5910639 },
          { lat: 12.0738321, lon: 124.5901790 },
        ],
      },
    ],
  };

  return res.status(200).json(data);
}
