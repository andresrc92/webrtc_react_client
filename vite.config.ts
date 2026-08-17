import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backends we proxy in dev so the browser talks same-origin (no CORS surprises):
//   - frost operator-console backend on :8000 -> /api, /robots, /detections
//     (map overlay, Go2 fleet cards, Go2 capture images)
//   - sim events server (sim_events_server.py) on :8227 -> /camera, /viewport
//     (camera control buttons). This one sends NO CORS headers, so the proxy
//     is required, not just convenient.
const frostBackendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://127.0.0.1:8000';
const simEventsTarget = process.env.SIM_EVENTS_PROXY_TARGET ?? 'http://127.0.0.1:8227';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5555,
    proxy: {
      '/api': { target: frostBackendTarget, changeOrigin: true },
      '/robots': { target: frostBackendTarget, changeOrigin: true },
      '/detections': { target: frostBackendTarget, changeOrigin: true },
      '/camera': { target: simEventsTarget, changeOrigin: true },
      '/viewport': { target: simEventsTarget, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 5555,
  },
});
