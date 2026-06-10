import type { NextConfig } from "next";

// Backend (CONDUCTOR FastAPI) base URL. Override with BACKEND_URL in env.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // Tree-shake heavy barrel-file libs so only the used exports ship to the client.
  experimental: {
    optimizePackageImports: ["framer-motion", "gsap"],
  },
  // Proxy REST API calls to the FastAPI backend so the frontend can use
  // same-origin "/api/..." paths in dev and prod (no CORS, no hardcoded host).
  // WebSockets (/ws/chat/...) are NOT proxied here — connect to them directly
  // via NEXT_PUBLIC_API_URL on the client.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      // Public developer API — proxy /v1/* so devs can call it on the main
      // domain (https://yourdomain.com/v1/chat) instead of the raw backend URL.
      { source: "/v1/:path*", destination: `${BACKEND_URL}/v1/:path*` },
      { source: "/health", destination: `${BACKEND_URL}/health` },
    ];
  },
};

export default nextConfig;
