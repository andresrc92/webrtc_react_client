# Isaac Sim version support

**This client targets Isaac Sim 5.0.1 – 5.1.x.** That's also shown in the
app's header UI (`src/isaacSimCompat.ts`) so it's visible without reading
docs. Isaac Sim 6.0 changes the streaming extension layout (see below) and
hasn't been tested against this client.

## What's confirmed vs. inferred

| | 5.0.1 | 5.1.0 | 6.0 |
|---|---|---|---|
| Status | Original target (docs only) | **Live-tested this session** | Not tested |
| Signaling port | TCP 49100 (docs/GitHub issue logs) | TCP 49100 (confirmed: `omni.kit.livestream.webrtc-7.0.0` bound and reachable) | TCP 49101 by default (NVIDIA docs) |
| Media port | UDP 47998 (docs/GitHub issue logs) | UDP 47998 (confirmed reachable) | UDP 47991 by default (NVIDIA docs) |
| Streaming extensions | `omni.kit.livestream.webrtc` + `omni.kit.livestream.core` | Same, versions `omni.kit.livestream.webrtc-7.0.0` / `omni.kit.livestream.core-7.5.0` (from live Kit log) | `omni.services.livestream.webrtc` reported unsupported; different extension/port config (isaac-sim/IsaacSim#413) |
| Signaling handshake | Assumed same library | **Confirmed**: browser reached `ws://<host>:49100/sign_in?peer_id=...&version=2` and Isaac Sim accepted the connection | Unknown |
| Media flow (actual video/audio) | Not tested | **Not confirmed** — see known issue below | Unknown |

If you move to a different Isaac Sim version, re-verify by grepping its Kit
startup log:

```bash
grep -iE "livestream|carb.livestream-rtc" <path-to-kit_*.log>
```

Look for the `omni.kit.livestream.webrtc-X.Y.Z` version line and any
`Stream Server:` lines from `carb.livestream-rtc.plugin` — those confirm
which ports/extensions are actually in play, since they're flag-overridable
and have already changed once between 5.1 and 6.0.

## Known issue: capture device init failure (not a client bug)

In this session's live test, Isaac Sim 5.1.0's own log showed the streaming
server's capture/encode pipeline failing to initialize, independent of any
client connection attempt:

```
[carb.livestream-rtc.plugin] Stream Server: starting the server failed, 0x800B1002
[carb.livestream-rtc.plugin] Could not initialize streaming components
[carb.livestream-rtc.plugin] Couldn't initialize the capture device.
```

This happened ~11s into extension startup, before the client ever connected.
The client-side signaling handshake still succeeded (Isaac Sim accepted the
`/sign_in` WebSocket connection), but no video/audio ever flowed, because the
server never had a working encoder to feed it. This would fail identically
with NVIDIA's own official desktop client — it's not specific to this app.

Same failure class as a community report:
https://github.com/isaac-sim/IsaacSim/issues/330 ("Couldn't initialize
capture devices", different hex code, same root cause category).

Likely causes to check if this recurs: an NVENC/driver issue on the GPU, or
resource contention with another process already holding an encoder session
(e.g. a concurrent desktop compositor/session using the same GPU). Restarting
the streaming app and checking `nvidia-smi` for other encoder users is the
first thing to try.
