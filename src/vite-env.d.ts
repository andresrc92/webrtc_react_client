/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ISAAC_SIM_SERVER?: string;
  readonly VITE_ISAAC_SIM_SIGNAL_PORT?: string;
  readonly VITE_ISAAC_SIM_MEDIA_PORT?: string;
  readonly VITE_STREAM_WIDTH?: string;
  readonly VITE_STREAM_HEIGHT?: string;
  readonly VITE_STREAM_FPS?: string;
  readonly VITE_SIGNALING_SERVER?: string;
  readonly VITE_SIGNALING_PATH?: string;
  readonly VITE_FORCE_WSS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
