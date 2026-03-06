/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabled to prevent double useEffect invocation in dev which breaks Leaflet
  reactStrictMode: false,
};

module.exports = nextConfig;
