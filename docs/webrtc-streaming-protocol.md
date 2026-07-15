# Isaac Sim WebRTC streaming: protocol & client library

There is no single published spec for Isaac Sim's WebRTC streaming protocol —
it's assembled here from NVIDIA's own client library (ground truth, since we
downloaded and inspected it directly), NVIDIA's docs/sample repos, and
community bug reports, then confirmed against a live Isaac Sim instance in
this session. This doc records what's confirmed vs. inferred, and every
source used, so the reasoning can be re-checked later.

## Architecture

Isaac Sim's streaming server is a stack of Omniverse Kit extensions loaded by
the `isaacsim.exp.full.streaming` app:

| Extension | Role |
|---|---|
| `carb.livestream-rtc.plugin` | Native capture/encode pipeline (video, audio, input streams) and the actual WebRTC server. |
| `omni.kit.livestream.core` | Core livestream plumbing the other extensions build on. |
| `omni.kit.livestream.webrtc` | Wires the WebRTC server to Kit's rendering/input systems. |
| `omni.kit.livestream.messaging` | Custom app <-> client message bus (`{event_type, payload}` envelopes). |
| `omni.services.livestream.nvcf` | Cloud-function/session-oriented variant (not used for direct/local connections). |

Confirmed live (see [isaac-sim-version-support.md](./isaac-sim-version-support.md)):

- **TCP 49100** — signaling. The browser opens `ws://<server>:49100/sign_in?peer_id=<id>&version=2` — this exact path was captured on the wire in this session.
- **UDP 47998** — media (RTP/SRTP audio+video after ICE negotiation).

Both are flag-overridable at launch (`--/app/livestream/publicEndpointAddress=<PUBLIC_IP>` for remote reachability); confirm against the instance's own startup log if they were changed, since NVIDIA's docs show different defaults for other Kit/Isaac Sim versions (see the version doc).

## Client library

NVIDIA publishes the actual client-side implementation as an npm package —
this is what the official desktop "Isaac Sim WebRTC Streaming Client" and
NVIDIA's reference `web-viewer-sample` are both built on, and what this app
uses directly instead of re-implementing SDP/ICE exchange by hand.

```
@nvidia/omniverse-webrtc-streaming-library
```

Registry (public, no auth required — confirmed by fetching package metadata
directly): `https://edge.urm.nvidia.com/artifactory/api/npm/omniverse-client-npm/`

`AppStreamer` (all static methods) is the entry point:

- `AppStreamer.connect(props: StreamProps): Promise<StreamEvent>`
- `AppStreamer.sendMessage(message: ApplicationMessage): Promise<StreamEvent>`
- `AppStreamer.start()` / `.stop()` / `.terminate(terminateApp?)`
- `AppStreamer.resize(width, height)`, `.setFitStreamResolution(bool)`
- `AppStreamer.openStage(url)`, `.resetStage()`, `.setSelectedPrims(paths)`, `.getChildren(primPath)`, `.getStageLoadingState()`

`DirectConfig` (the local/direct-connection config type used by this app,
from `src/components/StreamViewer.tsx`) has, among others: `server`,
`signalingServer`, `signalingPort` (library default `48322` — **not** what
Isaac Sim uses; always set explicitly), `mediaServer`, `mediaPort`,
`signalingPath`, `forceWSS`, `width`/`height`/`fps`, `videoElementId` /
`audioElementId` (default `'remote-video'` / `'remote-audio'`),
`fitStreamResolution`, `nativeTouchEvents`, `onStart` / `onStop` /
`onUpdate` / `onTerminate` / `onStreamStats` / `onCustomEvent` callbacks.

Mouse/keyboard/touch input is captured and forwarded over the data channel
**internally by the library** once it's attached to the video element — this
app does no manual input plumbing.

This was all read directly out of the package's own `.d.ts` and `README.md`
(`@nvidia/omniverse-webrtc-streaming-library@5.18.2`, fetched and unpacked
during development) rather than from documentation — the doc pages for this
library (`docs.omniverse.nvidia.com/services/...`,
`docs.omniverse.nvidia.com/ov-web-sdk/...`) 403'd on every fetch attempt.

## What isn't standardized

- The `/sign_in` signaling handshake, its query params, and the JSON message
  framing are NVIDIA-internal and undocumented publicly — treat them as
  implementation details of the library, not a stable API to hand-roll
  against.
- Default ports and the extension set have already changed once between the
  versions surveyed here (see the version doc) — re-verify against the
  instance's startup log after any Isaac Sim/Kit upgrade.

## Sources

**Primary (ground truth — inspected directly, not just read about):**
- `@nvidia/omniverse-webrtc-streaming-library` package metadata, `README.md`, and `dist/omniverse-webrtc-streaming-library.d.ts`, fetched from `https://edge.urm.nvidia.com/artifactory/api/npm/omniverse-client-npm/`
- Isaac Sim's own Kit log for a live 5.1.0 instance (`omni.ext.plugin` / `carb.livestream-rtc.plugin` lines) and live network capture of the `/sign_in` WebSocket handshake, both from this session's test run

**NVIDIA documentation:**
- https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/manual_livestream_clients.html
- https://docs.isaacsim.omniverse.nvidia.com/4.2.0/installation/manual_livestream_clients.html
- https://docs.isaacsim.omniverse.nvidia.com/6.0.0/installation/manual_livestream_clients.html
- https://docs.isaacsim.omniverse.nvidia.com/6.0.0/common/license-isaac-sim-webrtc-streaming-client.html
- https://docs.omniverse.nvidia.com/kit/docs/omni.kit.livestream.webrtc/
- https://docs.omniverse.nvidia.com/kit/docs/kit-app-template/latest/docs/streaming.html
- https://docs.omniverse.nvidia.com/embedded-web-viewer/latest/create/overview.html

**NVIDIA sample/reference code:**
- https://github.com/NVIDIA-Omniverse/web-viewer-sample (archived; `AppStream.tsx`, `README.md` — the React+Vite+TS reference this app's structure follows)
- https://github.com/nvidia-omniverse/ovstream

**GitHub issues/discussions used to confirm ports, extension names, and known failure modes:**
- https://github.com/isaac-sim/IsaacSim/discussions/449
- https://github.com/isaac-sim/IsaacSim/discussions/597
- https://github.com/isaac-sim/IsaacSim/issues/219
- https://github.com/isaac-sim/IsaacSim/issues/330 (same "couldn't initialize capture device" failure class hit live in this session)
- https://github.com/isaac-sim/IsaacSim/issues/188
- https://github.com/isaac-sim/IsaacSim/discussions/413 (port/extension changes across 5.1.0 → 6.0)
- https://github.com/isaac-sim/IsaacLab/discussions/4361
- https://github.com/isaac-sim/IsaacLab/issues/70
- https://forums.developer.nvidia.com/t/specify-ports-when-running-on-a-remote-machine/342701
- https://forums.developer.nvidia.com/t/isaac-sim-5-0-0-unable-to-configure-turn-server-for-webrtc-tcp-only-setup-no-udp-allowed/347641

**Third-party writeups (used for corroboration only, not treated as authoritative):**
- https://medium.com/@BeingOttoman/scalable-streaming-nvidia-omniverse-applications-over-the-internet-using-webrtc-8946a574fef2
- https://www.pollux.ai/en/tech-blog/how-to-access-omniverse-via-webrtc-browser-client
- https://jedyang.com/post/omniverse-isaac-sim-study-notes-2024/
