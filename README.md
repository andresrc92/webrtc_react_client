# Isaac Sim WebRTC Streaming Client

A self-hosted React web app that replaces the official Isaac Sim WebRTC
Streaming desktop client. It connects the browser directly to Isaac Sim's
built-in streaming server using NVIDIA's own client library
(`@nvidia/omniverse-webrtc-streaming-library`) — there's no custom signaling
protocol to reimplement and no application backend for the LAN case.

See `/home/andres/.claude/plans/golden-baking-deer.md` for the full research
and design writeup, and [`docs/`](./docs) for the WebRTC protocol reference
and Isaac Sim version support notes (with sources).

**Targets Isaac Sim 5.0.1 – 5.1.x** (shown in the app header too). See
[`docs/isaac-sim-version-support.md`](./docs/isaac-sim-version-support.md)
for what's confirmed live vs. inferred from docs, and for 6.0, which changes
the streaming extension/port layout and isn't supported yet.

## How it works

- Isaac Sim's streaming server (`omni.kit.livestream.webrtc` +
  `omni.kit.livestream.core`) listens on **TCP 49100** (signaling) and
  **UDP 47998** (media) by default in 5.0.1/5.1.x.
- The browser opens a WebRTC connection straight to those ports via
  `AppStreamer` (NVIDIA's own client library, same one their reference
  `web-viewer-sample` uses). Full protocol/library details:
  [`docs/webrtc-streaming-protocol.md`](./docs/webrtc-streaming-protocol.md).
- No backend for LAN/local access. A TURN relay (coturn) + TLS-terminating
  reverse proxy (Caddy) are only needed for the remote/internet deployment,
  and even those are just infra config, not application code.

## Local development

```bash
npm install
cp .env.example .env   # set VITE_ISAAC_SIM_SERVER to Isaac Sim's LAN IP
npm run dev
```

Open the printed `localhost:5555` URL, enter Isaac Sim's IP (or leave it
pre-filled from `.env`) and click **Connect**.

Or use the devcontainer (`.devcontainer/`) — it runs `npm install`
automatically on create and forwards port 5555.

## Operator side panel

The stream is the main view; a persistent right-hand rail adds operator
tooling ported from the frost operator console and the sim events server:

- **Facility map** with live Go2 poses overlaid (map overlay).
- **Inspection fleet** cards for each Go2 with Start/Cancel surveillance.
- **Go2 Camera** — the latest capture the surveillance dog reports.
- **Camera Control** — focus/follow/top-down/back buttons that drive the sim
  viewport camera.

Each panel keeps its own backend, reached through the Vite dev proxy
(configured in `vite.config.ts`) so the browser stays same-origin:

| Panel | Backend | Proxied paths |
| --- | --- | --- |
| Map, fleet cards, Go2 camera | frost console backend on **:8000** | `/api`, `/robots`, `/detections` |
| Camera control | `sim_events_server.py` on **:8227** | `/camera`, `/viewport` |

Override the proxy targets when they don't run on localhost:

```bash
BACKEND_PROXY_TARGET=http://<frost-host>:8000 \
SIM_EVENTS_PROXY_TARGET=http://<sim-host>:8227 \
npm run dev
```

The camera server (`sim_events_server.py`) sends no CORS headers, so the proxy
is required — the browser can't call it cross-origin directly.

### Starting Isaac Sim

```bash
# same machine / LAN
./isaac-sim.streaming.sh

# reachable from a different network
./isaac-sim.streaming.sh --/app/livestream/publicEndpointAddress=<PUBLIC_IP>
```

Confirm ports 49100/47998 from its startup log if in doubt — see
[`docs/isaac-sim-version-support.md`](./docs/isaac-sim-version-support.md)
for how to check and for a known "couldn't initialize capture device" server
error that's unrelated to this client (encoder/driver issue on the Isaac Sim
side, not a signaling/protocol problem).

## Troubleshooting

### Stream fails with `thread_init: already added for thread` in the Isaac Sim log

Symptom: the browser connects but the video never comes up, and the Isaac Sim
console shows `main: thread_init: already added for thread` (often alongside
benign `Invalid sync scope for buffer resource 'shared swapchain buffer'`
GPU warnings, which are unrelated noise).

Cause: NVIDIA's `AppStreamer` is a stateful singleton driving a single capture
thread on the Isaac Sim side, so `AppStreamer.connect()` must run exactly once
per mount. React's `StrictMode` double-invokes effects in development
(mount → unmount → mount), firing `connect → terminate → connect`. If the
second `connect` races ahead of the `terminate` teardown, Isaac Sim ends up
asked to start a capture thread while one already exists, and the stream
breaks. Production builds don't double-invoke, so this only bit `npm run dev`.

Two independent causes have produced this, both fixed here:

1. **React StrictMode double-invoke (dev only).** StrictMode double-invokes
   effects (mount → unmount → mount), firing `connect → terminate → connect`.
   Fix: the app does **not** wrap `<App />` in `React.StrictMode` (see
   [`src/main.tsx`](./src/main.tsx)), so the streaming effect and
   `AppStreamer.connect()` run once per mount in dev and prod alike.

2. **Auto-reconnect into a single-session server (the "breaks it for
   everyone" case).** Isaac Sim's livestream serves a single encoder/session.
   The streaming library defaults to `maxReconnects: 5` (retry every 2 s), and
   **every reconnect makes the sim re-initialize its capture device** — which
   it can't do while the encoder is held, so the retries wedge the stream for
   *all* clients, including NVIDIA's own client, until the sim is restarted.
   Fix: `maxReconnects` defaults to **0** (see [`src/config.ts`](./src/config.ts)
   and `VITE_MAX_RECONNECTS` in `.env.example`), so our client makes one clean
   attempt and never re-inits the sim encoder behind your back.

**Single-session caveat:** because the sim serves one session, you can't have
NVIDIA's client and this one connected at the same time — close one before
opening the other. If the encoder is already wedged (from an earlier bad
attempt or two simultaneous clients), restart Isaac Sim to recover; lower
`VITE_STREAM_WIDTH/HEIGHT/FPS` also eases a struggling encoder.

## Remote/internet deployment (demo)

```bash
cp .env.example .env
# set PUBLIC_HOSTNAME, ISAAC_SIM_HOST, TURN_USERNAME, TURN_PASSWORD
docker compose up --build
```

This starts three containers:

- `web` — the built React app, served internally on port 80.
- `proxy` — Caddy, terminates HTTPS on 80/443, serves `web`, and proxies the
  signaling WebSocket to Isaac Sim over `wss://<host>/ws/signaling` (avoids
  the browser blocking a plain `ws://` connection as mixed content).
- `coturn` — TURN relay for when a direct P2P media path fails through NAT.

Isaac Sim itself is **not** containerized here — it's expected to be running
separately on its own GPU box, reachable at `ISAAC_SIM_HOST`.

Unlike `npm run dev`, nginx does not proxy `/api`, `/robots`, `/detections`,
`/camera` or `/viewport` — there's no dev-server proxy config to fall back
on in a static build. So the side-panel backend URLs (frost console **:8000**,
`sim_events_server.py` **:8227**) are baked in at build time via `VITE_API_BASE`
/ `VITE_CAMERA_BASE`, which `docker-compose.yml` sets from `ISAAC_SIM_HOST` by
default. Set `BACKEND_HOST`/`SIM_EVENTS_HOST` (and `_PORT` variants) in `.env`
if those run somewhere other than the Isaac Sim box.

## Project layout

```
src/
  components/
    ConnectForm.tsx      server IP + advanced connection options
    StreamViewer.tsx     wraps AppStreamer.connect(), owns the <video>/<audio>
    StatusOverlay.tsx    connecting/streaming/error status UI
    SidePanel.tsx        right-hand operator rail (composes the panels below)
    MapView.tsx          facility map + live Go2 pose markers (:8000)
    FleetStrip.tsx       Go2 fleet cards + surveillance commands (:8000)
    Go2Icon.tsx          inline Go2 silhouette used by the fleet cards
    Go2ImagePanel.tsx    latest surveillance-dog capture (:8000)
    CameraControls.tsx   sim viewport camera buttons (:8227)
    Collapsible.tsx      shared collapsible panel header + hook
  config.ts              env-driven defaults (ports, resolution, proxy config)
  cameraApi.ts           camera-control calls to sim_events_server.py (:8227)
  api.ts / usePolling.ts frost backend calls + polling hooks (:8000)
  map/mapMeta.ts         map metadata + world↔pixel↔percent transforms
  sidePanel.css          styles for the operator rail (scoped under .side-panel)
  isaacSimCompat.ts       supported Isaac Sim version range, shown in the UI
docs/                     WebRTC protocol reference + Isaac Sim version support notes
docker/
  web/Dockerfile          multi-stage build → static nginx
  Caddyfile               TLS + signaling proxy for the remote deployment
docker-compose.yml        web + proxy + coturn (remote deployment only)
.devcontainer/             Node 20 dev environment
```
