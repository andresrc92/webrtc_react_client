// Camera control calls to the sim events server (sim_events_server.py).
//
// That server is FastAPI on :8227 with NO CORS headers, so we can't hit it
// cross-origin from the browser. In dev, Vite proxies /camera and /viewport
// -> http://127.0.0.1:8227 (see vite.config.ts). Override the target with
// SIM_EVENTS_PROXY_TARGET at dev-server start, or VITE_CAMERA_BASE at build
// time for a same-origin deployment behind a reverse proxy.
const CAMERA_BASE = import.meta.env.VITE_CAMERA_BASE ?? "";

// Prim paths + framing distances mirror the built-in panel in sim_events_server.py.
export const CAMERA_TARGETS = {
  go2a: { primPath: "/World/Robots/go2_a", distance: 5 },
  go2b: { primPath: "/World/Robots/go2_b", distance: 5 },
  welder: { primPath: "/World/Robots/crx_welder", distance: 18 },
  crack: { primPath: "/World/SpawnedPrims/crack", distance: 6 },
} as const;

async function send(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${CAMERA_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

// One-shot aim: frame the camera on a prim. Omit distance to auto-fit its bbox.
export function focusPrim(primPath: string, distance?: number): Promise<unknown> {
  return send("PUT", "/camera/focus", distance === undefined ? { prim_path: primPath } : { prim_path: primPath, distance });
}

// Attach a smoothed chase cam to a prim (defaults live server-side).
export function followPrim(primPath: string): Promise<unknown> {
  return send("PUT", "/camera/follow", { prim_path: primPath });
}

// Detach the chase cam.
export function stopFollow(): Promise<unknown> {
  return send("DELETE", "/camera/follow");
}

// Bird's-eye top-down view of the whole plant.
export function topView(): Promise<unknown> {
  return send("PUT", "/camera/top");
}

// Undo the last camera move.
export function cameraBack(): Promise<unknown> {
  return send("PUT", "/camera/back");
}
