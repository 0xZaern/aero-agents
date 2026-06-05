"use client";

/**
 * Client wrapper that defers the three.js terrain off the landing critical path.
 * three core is ~1.5MB; the terrain is a decorative background, so it loads in a
 * separate chunk after first paint (ssr:false) instead of blocking the hero.
 */

import dynamic from "next/dynamic";

const TerrainBackground = dynamic(() => import("./TerrainBackground"), {
  ssr: false,
});

export default TerrainBackground;
