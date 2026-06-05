"use client";

/**
 * TerrainBackground - a single fixed-position wireframe terrain you fly THROUGH
 * as you scroll. Scroll progress (0→1 over FLY_VH viewport-heights) drives the
 * camera forward + down, so the opening of the site feels like descending over
 * an endless mountain range. Mouse adds parallax. Theme-aware via CSS vars.
 *
 * This replaces the old static hero canvas - the terrain is now a persistent
 * atmospheric layer behind the first few sections, fading out as you land.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}
function ridge(x: number, y: number) {
  let n = fbm(x, y);
  n = 1 - Math.abs(n * 2 - 1);
  return n * n;
}
/** Infinite-feel terrain height: ridged fbm + a few sine ridges. World units. */
function terrainH(x: number, z: number) {
  let h = ridge(x * 0.18 + 11, z * 0.18 + 7) * 4.2;
  h += fbm(x * 0.08 + 3, z * 0.08 + 9) * 2.2;
  h += Math.sin(x * 0.5) * Math.cos(z * 0.4) * 0.25;
  return h;
}

function parseRGBVar(name: string, fb: [number, number, number]) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fb;
  const p = raw.split(",").map((n) => parseInt(n.trim(), 10));
  return p.length === 3 && p.every((n) => !isNaN(n)) ? (p as [number, number, number]) : fb;
}

const FLY_VH = 5; // flythrough lasts this many viewport heights of scroll (higher = slower)

export default function TerrainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // WebGL may be unavailable (GPU disabled, sandboxed browser, blocklisted
    // driver, enterprise policy). Feature-detect on a throwaway canvas FIRST:
    // THREE.WebGLRenderer's constructor console.errors AND throws on failure, so
    // we must avoid constructing it at all. Missing context => no terrain layer.
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      canvas.style.display = "none";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);

    // ── geometry: a long strip of terrain running into the distance (−Z) ──
    const W = 40, D = 80, SX = 120, SZ = 200;
    const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const N = pos.count;
    const baseY = new Float32Array(N), AX = new Float32Array(N), AZ = new Float32Array(N), FADE = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      AX[i] = x; AZ[i] = z;
      const h = terrainH(x, z);
      baseY[i] = h;
      pos.setY(i, h);
      // fade the far + near edges into the fog
      const near = Math.min(Math.max((z + D / 2) / 8, 0), 1);
      const far = Math.min(Math.max((D / 2 - z) / 18, 0), 1);
      FADE[i] = near * far;
    }

    const colors = new Float32Array(N * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const lineCol = new THREE.Color(), bgCol = new THREE.Color();
    function applyTheme() {
      const [lr, lg, lb] = parseRGBVar("--terrain-line", [255, 255, 255]);
      const [br, bg, bb] = parseRGBVar("--terrain-bg", [5, 5, 5]);
      lineCol.setRGB(lr / 255, lg / 255, lb / 255);
      bgCol.setRGB(br / 255, bg / 255, bb / 255);
      for (let i = 0; i < N; i++) {
        const b = FADE[i];
        colors[i * 3] = bgCol.r + (lineCol.r - bgCol.r) * b;
        colors[i * 3 + 1] = bgCol.g + (lineCol.g - bgCol.g) * b;
        colors[i * 3 + 2] = bgCol.b + (lineCol.b - bgCol.b) * b;
      }
      (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      scene.fog = new THREE.FogExp2(bgCol.getHex(), 0.028);
    }
    applyTheme();
    window.addEventListener("aero-theme", applyTheme);

    const ptsMat = new THREE.PointsMaterial({
      size: 0.06, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.9, fog: true, depthWrite: false,
    });
    // Make the point sprites ROUND in the fragment shader (gl_PointCoord) rather
    // than relying on a texture map - some GPUs/drivers (ANGLE/SwiftShader) ignore
    // point-sprite textures and render plain squares. Also cap the on-screen size
    // so near-camera points can't balloon into big blocks.
    ptsMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\n\tgl_PointSize = min( gl_PointSize, 14.0 );"
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\n\tvec2 cxy = gl_PointCoord - vec2( 0.5 );\n\tif ( dot( cxy, cxy ) > 0.25 ) discard;"
      );
    };
    const points = new THREE.Points(geo, ptsMat);

    // faint web sharing buffers
    const idx = (geo.index as THREE.BufferAttribute).array;
    const seen = new Set<string>();
    const edges: number[] = [];
    const addEdge = (u: number, v: number) => {
      const k = u < v ? u + "_" + v : v + "_" + u;
      if (!seen.has(k)) { seen.add(k); edges.push(u, v); }
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      addEdge(a, b); addEdge(b, c); addEdge(c, a);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", geo.attributes.position);
    lineGeo.setAttribute("color", geo.attributes.color);
    lineGeo.setIndex(edges);
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, fog: true })
    );

    const world = new THREE.Group();
    world.add(lines);
    world.add(points);
    scene.add(world);

    // ── interaction + scroll state ──
    const mouse = { x: 0, y: 0 }, mt = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    let scrollProg = 0; // 0..1 across the flythrough
    const onScroll = () => {
      const max = window.innerHeight * FLY_VH;
      scrollProg = Math.min(Math.max(window.scrollY / max, 0), 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const pa = pos.array as Float32Array;
    let t = 0;
    let raf = 0;
    let intro = 0;
    const ease = (x: number) => x * x * (3 - 2 * x);
    function animate() {
      raf = requestAnimationFrame(animate);
      t += reduced ? 0 : 0.012;

      // rolling swell
      for (let i = 0; i < N; i++) {
        const w = Math.sin(t * 0.4 + AX[i] * 0.25 + AZ[i] * 0.18) * 0.18;
        pa[i * 3 + 1] = baseY[i] + w;
      }
      pos.needsUpdate = true;

      mt.x += (mouse.x - mt.x) * 0.05;
      mt.y += (mouse.y - mt.y) * 0.05;

      const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

      // ── Sequenced so the mesh stays out of the way until the title closes ──
      // Phase A (prog 0 → RISE_END): hero title scales up + fades. The mesh sits
      //   static at the overlook and only its OPACITY rises (faint → full).
      // Phase B (RISE_END → …): NOW the mesh starts its zoom/flythrough, then
      //   dissolves away as the next section takes over.
      const FLY_START = 0.12; // begin the descent early so it spreads out + feels slow
      const FLY_END = 0.58;   // mesh finishes its flythrough as it dissolves

      // FLYTHROUGH: spread across a long scroll range for a gradual, smooth descent.
      const fp = ease(clamp01((scrollProg - FLY_START) / (FLY_END - FLY_START)));
      world.position.z = fp * (D * 0.55);
      camera.position.set(mt.x * 2.2, 9 - fp * 6.0, 14 - fp * 2.0);
      const look = new THREE.Vector3(mt.x * 1.5, 2.2 - fp * 2.0 - mt.y * 1.2, -8);
      camera.lookAt(look);
      world.rotation.y = mt.x * 0.04 + Math.sin(t * 0.1) * 0.008;

      // OPACITY: faint at rest so the hero text is clearly readable, smoothly
      // rising to full as the title closes, then dissolving once it's flying.
      intro = Math.min(intro + 0.02, 1);
      const LOW = 0.22, FULL = 0.92;
      // Rise starts early but ramps gradually across the whole title push, so the
      // opacity change is slow + smooth (ends just before the mesh dissolves).
      const RISE_OPA_END = 0.42;
      const rise = LOW + (FULL - LOW) * ease(clamp01(scrollProg / RISE_OPA_END));
      const dissolve = scrollProg < 0.42 ? 1 : Math.max(0, 1 - (scrollProg - 0.42) / 0.16);
      canvas!.style.opacity = String(intro * rise * dissolve);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("aero-theme", applyTheme);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      geo.dispose();
      lineGeo.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="terrain-bg" aria-hidden />;
}
