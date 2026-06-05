"use client";

/**
 * CtaMesh - the same wireframe terrain used in the hero, but self-contained as a
 * background for the CTA: fills its section, drifts gently (no scroll
 * flythrough), reacts a little to the mouse, and is theme-aware via CSS vars.
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

export default function CtaMesh({
  className = "cta-mesh",
  maxOpacity = 0.5,
  speed = 1,
}: {
  className?: string;
  maxOpacity?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Bail before touching THREE.WebGLRenderer when WebGL is unavailable - its
    // constructor console.errors AND throws, so feature-detect first.
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
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 100);

    const W = 140, D = 72, SX = 320, SZ = 170; // wide so the terrain reaches the screen edges
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
      scene.fog = new THREE.FogExp2(bgCol.getHex(), 0.03);
    }
    applyTheme();
    window.addEventListener("aero-theme", applyTheme);

    const ptsMat = new THREE.PointsMaterial({
      size: 0.06, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.9, fog: true, depthWrite: false,
    });
    // Round point sprites via the fragment shader (gl_PointCoord) + a size cap -
    // texture-mapped sprites render as squares on some GPUs. See TerrainBackground.
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

    const idx = (geo.index as THREE.BufferAttribute).array;
    const seen = new Set<string>();
    const edges: number[] = [];
    const addEdge = (u: number, v: number) => {
      const k = u < v ? u + "_" + v : v + "_" + u;
      if (!seen.has(k)) { seen.add(k); edges.push(u, v); }
    };
    for (let i = 0; i < idx.length; i += 3) {
      addEdge(idx[i], idx[i + 1]); addEdge(idx[i + 1], idx[i + 2]); addEdge(idx[i + 2], idx[i]);
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
    world.position.y = -2.4; // sit the terrain a little lower in frame
    scene.add(world);

    const mouse = { x: 0, y: 0 }, mt = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    function resize() {
      const w = canvas!.clientWidth || canvas!.offsetWidth;
      const h = canvas!.clientHeight || canvas!.offsetHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pa = pos.array as Float32Array;
    let t = 0, raf = 0, intro = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      t += (reduced ? 0 : 0.01) * speed;

      for (let i = 0; i < N; i++) {
        const w = Math.sin(t * 0.4 + AX[i] * 0.25 + AZ[i] * 0.18) * 0.18;
        pa[i * 3 + 1] = baseY[i] + w;
      }
      pos.needsUpdate = true;

      mt.x += (mouse.x - mt.x) * 0.04;
      mt.y += (mouse.y - mt.y) * 0.04;

      // gentle fixed overlook with a slow drift + mouse parallax
      camera.position.set(mt.x * 2.0, 8.2 - mt.y * 1.0, 14);
      camera.lookAt(new THREE.Vector3(mt.x * 1.2, 1.6, -10));
      world.rotation.y = mt.x * 0.04 + Math.sin(t * 0.08) * 0.02;

      intro = Math.min(intro + 0.015, 1);
      canvas!.style.opacity = String(intro * maxOpacity);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("aero-theme", applyTheme);
      window.removeEventListener("mousemove", onMove);
      renderer.dispose();
      geo.dispose();
      lineGeo.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
