# Robots-follow + camera-preset drawer

## Context

`webrtc_react_client` currently only renders the raw WebRTC video feed from a
remote Isaac Sim instance (`10.100.1.4`, project "frost", `/home/andres/iac/frost`).
The user wants a right-side drawer with two sections:

1. **Robots** — a short user-supplied list of simulated robots (by USD prim
   path). Clicking one makes the viewport camera **continuously follow** that
   robot's live position (server-side, not client polling), until another
   robot or a camera preset is chosen.
2. **Camera presets** — a short user-supplied list of named fixed viewpoints
   (eye/target pairs). Clicking one snaps the camera there once.

This was scoped after directly investigating the running "frost" stack over
SSH this session (not guessed): the WebRTC client library
(`@nvidia/omniverse-webrtc-streaming-library`) has **no camera/viewport API at
all** — only prim selection (`setSelectedPrims`) and a generic untyped
`sendMessage`/`onCustomEvent` bus with no existing server-side listener. The
sim project already has a proven, working alternative: a TCP "remote
scripting" socket (`isaacsim.code_editor.vscode`, `127.0.0.1:8226`) that runs
arbitrary Python inside the live Kit process, fronted by an HTTP bridge
(`sim_events_server.py`, port 8227) that several existing features (cracks,
characters, the welder robot) already use via the same pattern. This plan
extends that exact pattern rather than inventing a new mechanism.

**Critical finding, verified twice independently via the remote-scripting
socket:** the robots' root prims (`/World/Robots/go2_a`, `go2_b`) sit fixed at
their spawn pose forever — PhysX only writes live position to the **child**
`/World/Robots/{name}/base` prim (this is also why `FallMonitor` reads
`.../base`, not the root). Any robot entry must point at the `.../base` path
or the "follow" feature will silently lock onto the spawn point.

User decisions already made (not open questions):
- Follow-mode runs **server-side** (a per-frame step in the sim's own main
  loop), not via client-side polling.
- The HTTP bridge (`sim_events_server.py`) becomes a **new docker-compose
  service** in `iac/frost/compose.yml` so it starts with the rest of the stack.
- Camera presets are plain client-supplied `{eye, target}` coordinates — no
  server-side preset registry (keeps it symmetric with how robot `primPath`s
  already live in the client).

Out of scope: the separate frost fleet-orchestration backend
(`iac/frost/backend`, port 8000, MQTT/DynamoDB) — unrelated system, not touched.

---

## Part A — Sim repo (`/home/andres/iac/frost`, mounted at `/workspaces/frost`
in the `frost-isaac-ros2-1` container)

### A1. `sim/scripts/camera_kit/__init__.py` (new, empty)
Mirrors the existing empty `stand_kit/__init__.py` / `crack_kit/__init__.py`.

### A2. `sim/scripts/camera_kit/camera_follow.py` (new)
A small stateful class, same shape as `stand_kit/fall_monitor.py`'s
`FallMonitor` (`initialize()` once, `step()` every physics tick):

- `initialize()` — caches `omni.usd.get_context().get_stage()`.
- `start(prim_path, eye_offset=None, target_offset=None)` — validates the
  prim exists, stores it as the current follow target.
- `stop()` — clears the target.
- `status()` — returns `{following, eye_offset, target_offset}`.
- `step()` — no-op if nothing is being followed; otherwise reads the target
  prim's live world translate via `UsdGeom.Xformable(...).ComputeLocalToWorldTransform(0.0)`,
  adds a fixed world-space `eye_offset`/`target_offset`, and calls
  `isaacsim.core.utils.viewports.set_camera_view(eye=..., target=...)` — the
  same function `oil_plant.py` already uses for its startup camera shot.

Starting offsets (tune by eye once running, robots are low quadrupeds so this
needs to be much tighter than the wide establishing-shot constants):
`DEFAULT_EYE_OFFSET = (-3.0, -3.0, 2.2)`, `DEFAULT_TARGET_OFFSET = (0.0, 0.0, 0.5)`.
Offsets are fixed world-space vectors (not rotated with robot heading) — matches
the "translate read is enough" simplification; revisit only if the fixed
compass-direction chase feels wrong in practice.

### A3. Edit `sim/scripts/oil_plant.py`
Four small, additive edits, each mirroring an existing pattern already in this
file for `_fall_monitors`/`FallMonitor`:

1. Import, near the existing `from stand_kit.fall_monitor import FallMonitor` (~line 225):
   `from camera_kit.camera_follow import CameraFollow`
2. Module-level global, near the existing `_welder` global (~line 299), so
   remote-scripting calls on separate socket connections can reach the same
   live instance via `sys.modules["__main__"]._camera_follow` (exactly how
   `welder_services.py` already reaches `_welder`):
   `_camera_follow: CameraFollow = CameraFollow()`
   (Always constructed — unlike `_welder`, not gated behind a CLI flag.)
3. `_camera_follow.initialize()` right next to where `_fall_monitors` are
   initialized after `world.reset()` (~line 771-778).
4. `_camera_follow.step()` added into the existing per-tick callback that
   already calls `monitor.step()` for each `FallMonitor` (~line 798-803, the
   `"quadruped_policy"` physics callback) — no new callback registration
   needed, just one more line in the existing loop body.

### A4. `sim/scripts/code_editor_scripts/camera_follow_client.py` (new)
Thin wrappers around `move_prim_client.send_code()`, same shape as
`welder_services.py`:
- `start_camera_follow(prim_path, eye_offset=None, target_offset=None)`
- `stop_camera_follow()`
- `get_camera_follow_status()`
- `snap_camera_view(eye, target)` — **must call `cf.stop()` server-side
  before `set_camera_view()`**, otherwise an active follow overwrites the
  one-shot preset snap on the very next physics tick. This is the single most
  important interaction between the two features.

All four reach `sys.modules["__main__"]._camera_follow`, raising a clear
"is oil_plant.py running?" error if it's `None`.

### A5. Edit `sim/scripts/code_editor_scripts/sim_events_server.py`
Add import of the four functions from A4, two new pydantic models
(`RobotFollowRequest{prim_path, eye_offset?, target_offset?}`,
`CameraViewRequest{eye, target}`), and four endpoints, following the file's
existing `try → HTTPException(502, detail=...)` convention exactly:

- `PUT /robots/{robot_id}/follow` — body `{prim_path, eye_offset?, target_offset?}`.
  `robot_id` is label-only (REST symmetry with `/welder/{robot_id}/...`); the
  actual tracked prim comes from `prim_path` in the body. Calling this again
  with a different prim implicitly switches targets — no separate unfollow
  needed first.
- `POST /robots/{robot_id}/unfollow` — stops following (global single target,
  so `robot_id` is informational only).
- `GET /robots/follow` — read-only status.
- `PUT /camera/view` — body `{eye, target}`, one-shot snap, cancels any active
  follow server-side.

Also add CORS (nothing currently configured in this file):
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```
`allow_origins=["*"]` is fine for this internal LAN tool; tighten later if it's
ever exposed beyond the LAN.

### A6. New compose service in `/home/andres/iac/frost/compose.yml`
```yaml
  sim-events:
    image: frost/isaac-ros2:latest   # already has fastapi/uvicorn (Dockerfile:120) — no new image needed
    network_mode: host               # must reach 127.0.0.1:8226 in the host netns, same as isaac-ros2
    volumes:
      - .:/workspaces/frost
    working_dir: /workspaces/frost/sim/scripts/code_editor_scripts
    command: ["python3", "sim_events_server.py", "--host", "0.0.0.0", "--port", "8227"]
    depends_on:
      - isaac-ros2
    restart: unless-stopped
```
No GPU reservation block — this process never touches CUDA/Isaac directly, it
only makes a loopback TCP call. `depends_on` only waits for container start,
not for Isaac Sim to finish booting (no healthcheck exists on `isaac-ros2` to
key off) — fine, since `sim_events_server.py` doesn't touch the socket until a
request comes in, so early requests just 502 until Isaac Sim is actually up.

---

## Part B — Client repo (`/home/andres/webrtc_react_client`)

### B1. `src/config.ts`
Add `simEventsUrl: string` to `DefaultStreamConfig`, sourced from
`env.VITE_SIM_EVENTS_URL ?? ''`, following the exact pattern already used for
every other field in this file.

### B2. `.env` / `.env.example`
Add `VITE_SIM_EVENTS_URL=http://10.100.1.4:8227` (same host as the existing
`VITE_ISAAC_SIM_SERVER`).

### B3. `src/robots.ts` (new)
```ts
export interface RobotConfig {
  id: string;
  label: string;
  /** Must be the live-transform prim (e.g. ".../base"), not the robot's
   *  root Xform — confirmed via remote-scripting probe that the root stays
   *  fixed at spawn pose while PhysX only writes to the child prim. */
  primPath: string;
}

export const ROBOTS: RobotConfig[] = [
  { id: 'go2_a', label: 'Go2 A', primPath: '/World/Robots/go2_a/base' },
  { id: 'go2_b', label: 'Go2 B', primPath: '/World/Robots/go2_b/base' },
];
```

### B4. `src/cameraPresets.ts` (new)
```ts
export interface CameraPreset {
  id: string;
  label: string;
  eye: [number, number, number];
  target: [number, number, number];
}

// Capture real values by framing a shot in the GUI, then running
// sim/dds/_get_view_camera.py on the sim host (reads the live viewport
// eye/target over the remote-scripting socket) and pasting the numbers here.
export const CAMERA_PRESETS: CameraPreset[] = [];
```

### B5. `src/components/ControlDrawer.tsx` (new)
Right-side `<aside>` with two sections (Robots, Camera presets) plus a toggle
button. Named `ControlDrawer` (not `RobotsPanel`) since it holds both sections
and may grow. Follows existing conventions: named export, colocated
`ControlDrawerProps`, local `useState`/`useCallback` only, no external state
library.

- `handleFollow(robotId, primPath)` → `PUT {simEventsUrl}/robots/{robotId}/follow`
  with `{prim_path: primPath}`; on success also fires
  `AppStreamer.setSelectedPrims([primPath])` (imported directly from the
  library — it's a global static singleton, not scoped to `StreamViewer`) as a
  free visual bonus. That call is fire-and-forget: its failure must not
  surface as a follow failure.
- `handleUnfollow(robotId)` → `POST {simEventsUrl}/robots/{robotId}/unfollow`.
- `handlePreset(id, eye, target)` → `PUT {simEventsUrl}/camera/view` with
  `{eye, target}`; on success also clears local "currently followed" state,
  mirroring the server already cancelling follow-mode.
- Single-follow-at-a-time UX: clicking a different robot is an **implicit
  switch** (no explicit stop-first required) — matches both the natural
  "pick one from a list" mental model and how `CameraFollow.start()` already
  overwrites its single target.
- Errors surface as inline text (`.drawer-error`), matching how
  `StatusOverlay` already shows a `detail` string — no toast library.

### B6. Edit `src/App.tsx`
Add `drawerOpen` state and render `<ControlDrawer open={drawerOpen} onToggle={...} />`
in `.app-header`, next to the existing `Disconnect` button, gated on
`target && state === 'streaming'` (only useful once video is actually up).

### B7. New CSS in `src/App.css`
`.drawer-toggle`, `.control-drawer` (`position: absolute; top:0; right:0; bottom:0`,
relies on `.app-main` already being `position: relative`), `.drawer-section`,
`.drawer-row`, `.drawer-item` (+ `.active` state), `.drawer-error` — plain
kebab-case classes with hardcoded hex literals, matching the rest of the file
exactly (no new CSS-variable/token system).

### B8. Remote HTTPS (Caddy) deployment — only if that path is actually used
`docker-compose.yml` / `docker/web/Dockerfile` would need `VITE_SIM_EVENTS_URL`
threaded through as a build arg like the other `VITE_*` vars, and
`docker/Caddyfile` would need a reverse-proxy route (mirroring the existing
`/ws/signaling` handling) to avoid mixed-content blocking, since the bridge is
plain HTTP and that deployment serves the app over HTTPS. Skip entirely if
this feature is only ever used via `npm run dev` directly against the LAN IP
(current `.env` already points straight at `10.100.1.4`, plain HTTP end to end
— no mixed-content issue in that flow).

---

## Open items needing follow-up (not blockers, just things to tune after wiring it up)

1. Chase-cam offsets in `camera_follow.py` are a first guess — adjust by eye.
2. Camera preset coordinates in `cameraPresets.ts` start empty — capture with
   `sim/dds/_get_view_camera.py` (confirmed working: reads the live viewport
   eye/target over the remote-scripting socket).
3. Any robot added to `robots.ts` beyond `go2_a`/`go2_b` needs the same
   root-vs-`/base` check before trusting its `primPath`.

---

## Verification

**1. Sim-side logic in isolation (SSH, no HTTP layer yet):**
```bash
ssh larosalia 'docker exec frost-isaac-ros2-1 python3 -c "
import sys; sys.path.insert(0, \"/workspaces/frost/sim/scripts/code_editor_scripts\")
from camera_follow_client import start_camera_follow, get_camera_follow_status, stop_camera_follow
print(start_camera_follow(\"/World/Robots/go2_a/base\"))
print(get_camera_follow_status())
print(stop_camera_follow())
"'
```

**2. After `docker compose up -d sim-events`, exercise each endpoint directly:**
```bash
curl -X PUT http://10.100.1.4:8227/robots/go2_a/follow -H 'Content-Type: application/json' -d '{"prim_path": "/World/Robots/go2_a/base"}'
curl http://10.100.1.4:8227/robots/follow
curl -X PUT http://10.100.1.4:8227/robots/go2_b/follow -H 'Content-Type: application/json' -d '{"prim_path": "/World/Robots/go2_b/base"}'
curl -X POST http://10.100.1.4:8227/robots/go2_b/unfollow
curl -X PUT http://10.100.1.4:8227/camera/view -H 'Content-Type: application/json' -d '{"eye": [56.5423, 18.7609, 7.3655], "target": [46.9783, 20.2599, 4.8590]}'
```
Watch the actual viewport/stream while running these — camera should visibly
snap/track each time.

**3. CORS, from the browser console at the client's origin:**
```js
fetch('http://10.100.1.4:8227/robots/follow').then(r => r.json()).then(console.log)
```

**4. End-to-end in the browser:** connect the stream, open the drawer, click a
robot (confirm tracking + selection highlight), click the other robot (confirm
immediate switch), click Stop (confirm camera holds still, no snap-back),
click a preset (confirm one clean snap and that follow doesn't resume next
tick), then stop the `sim-events` service and click a robot again (confirm the
inline error text appears instead of a silent failure).

### Critical files
- `/home/andres/iac/frost/sim/scripts/camera_kit/camera_follow.py`
- `/home/andres/iac/frost/sim/scripts/oil_plant.py`
- `/home/andres/iac/frost/sim/scripts/code_editor_scripts/camera_follow_client.py`
- `/home/andres/iac/frost/sim/scripts/code_editor_scripts/sim_events_server.py`
- `/home/andres/iac/frost/compose.yml`
- `/home/andres/webrtc_react_client/src/robots.ts`
- `/home/andres/webrtc_react_client/src/cameraPresets.ts`
- `/home/andres/webrtc_react_client/src/components/ControlDrawer.tsx`
- `/home/andres/webrtc_react_client/src/App.tsx`
- `/home/andres/webrtc_react_client/src/config.ts`
