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

Open the printed `localhost:5173` URL, enter Isaac Sim's IP (or leave it
pre-filled from `.env`) and click **Connect**.

Or use the devcontainer (`.devcontainer/`) — it runs `npm install`
automatically on create and forwards port 5173.

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

## Project layout

```
src/
  components/
    ConnectForm.tsx      server IP + advanced connection options
    StreamViewer.tsx     wraps AppStreamer.connect(), owns the <video>/<audio>
    StatusOverlay.tsx    connecting/streaming/error status UI
  config.ts              env-driven defaults (ports, resolution, proxy config)
  isaacSimCompat.ts       supported Isaac Sim version range, shown in the UI
docs/                     WebRTC protocol reference + Isaac Sim version support notes
docker/
  web/Dockerfile          multi-stage build → static nginx
  Caddyfile               TLS + signaling proxy for the remote deployment
docker-compose.yml        web + proxy + coturn (remote deployment only)
.devcontainer/             Node 20 dev environment
```
