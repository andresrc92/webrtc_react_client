export interface DefaultStreamConfig {
  server: string;
  signalingPort: number;
  mediaPort: number;
  width: number;
  height: number;
  fps: number;
  /** Only set for the remote/proxied deployment (docker-compose + Caddy). */
  signalingServer?: string;
  signalingPath?: string;
  forceWSS: boolean;
}

const env = import.meta.env;

export const defaultStreamConfig: DefaultStreamConfig = {
  server: env.VITE_ISAAC_SIM_SERVER ?? '',
  // Isaac Sim 5.0.1's omni.kit.livestream.webrtc extension defaults to
  // TCP 49100 (signaling) / UDP 47998 (media) — confirm against the running
  // instance's startup log if these were overridden at launch.
  signalingPort: Number(env.VITE_ISAAC_SIM_SIGNAL_PORT ?? 49100),
  mediaPort: Number(env.VITE_ISAAC_SIM_MEDIA_PORT ?? 47998),
  width: Number(env.VITE_STREAM_WIDTH ?? 1920),
  height: Number(env.VITE_STREAM_HEIGHT ?? 1080),
  fps: Number(env.VITE_STREAM_FPS ?? 60),
  signalingServer: env.VITE_SIGNALING_SERVER || undefined,
  signalingPath: env.VITE_SIGNALING_PATH || undefined,
  forceWSS: env.VITE_FORCE_WSS === 'true',
};
