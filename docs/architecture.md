# Architecture

This repo is the æro frontend. It is a self-contained Next.js application
that talks to a separate API service over REST and WebSocket.

## Stack
- Next.js (App Router) + React + TypeScript
- Tailwind CSS for styling, dark-only theme
- three.js for the landing terrain and meshes
- GSAP + Lenis for scroll and motion
- Zustand for client state

## Layout
- `app/` - routes: landing, dashboard, docs, legal
- `components/` - landing sections and dashboard widgets
- `lib/` - client state, API client, helpers
- `public/` - static assets

## Data flow
- REST calls hit same-origin `/api/...` and are proxied to the API service
  (configured via `BACKEND_URL`).
- Chat streaming uses a WebSocket connection opened directly from the client.
- No secrets live in the frontend; the API holds all credentials and data.

## Rendering
- Mostly client components for the interactive dashboard.
- The landing route is static and progressively enhanced; the 3D terrain is
  loaded lazily so it never blocks first paint.
