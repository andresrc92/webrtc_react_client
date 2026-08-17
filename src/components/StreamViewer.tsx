import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppStreamer,
  eStatus,
  LogLevel,
  StreamType,
  type DirectConfig,
  type StreamEvent,
  type StreamProps,
} from '@nvidia/omniverse-webrtc-streaming-library';
import { defaultStreamConfig } from '../config';
import { StatusOverlay } from './StatusOverlay';

export type ConnectionState = 'connecting' | 'streaming' | 'stopped' | 'error';

export interface StreamTarget {
  server: string;
  signalingPort: number;
  mediaPort: number;
  width: number;
  height: number;
  fps: number;
}

interface StreamViewerProps {
  target: StreamTarget;
  onStateChange?: (state: ConnectionState, detail?: string) => void;
}

function describe(message: StreamEvent): string {
  if (typeof message.info === 'string' && message.info) return message.info;
  return `${message.action}: ${message.status}`;
}

export function StreamViewer({ target, onStateChange }: StreamViewerProps) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [detail, setDetail] = useState<string | undefined>();

  // onStateChange is only used to notify the parent; it isn't a dependency
  // we want re-running the connect effect for.
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const updateState = useCallback((next: ConnectionState, msg?: string) => {
    setState(next);
    setDetail(msg);
    onStateChangeRef.current?.(next, msg);
  }, []);

  useEffect(() => {
    let cancelled = false;
    updateState('connecting');

    const streamConfig: DirectConfig = {
      server: target.server,
      signalingPort: target.signalingPort,
      mediaPort: target.mediaPort,
      signalingServer: defaultStreamConfig.signalingServer,
      signalingPath: defaultStreamConfig.signalingPath,
      forceWSS: defaultStreamConfig.forceWSS,
      // Isaac Sim livestream is single-session: auto-reconnects make it re-init
      // its capture device and wedge the stream for ALL clients. Default 0 so
      // we make one clean attempt. See config.ts / README troubleshooting.
      maxReconnects: defaultStreamConfig.maxReconnects,
      width: target.width,
      height: target.height,
      fps: target.fps,
      videoElementId: 'remote-video',
      audioElementId: 'remote-audio',
      autoLaunch: true,
      fitStreamResolution: true,
      onStart: (message: StreamEvent) => {
        if (cancelled) return;
        if (message.status === eStatus.success) {
          updateState('streaming');
        } else if (message.status === eStatus.warning) {
          updateState('streaming', describe(message));
        } else {
          updateState('error', describe(message));
        }
      },
      onStop: (message: StreamEvent) => {
        if (cancelled) return;
        updateState(message.status === eStatus.error ? 'error' : 'stopped', describe(message));
      },
      onUpdate: (message: StreamEvent) => {
        if (cancelled) return;
        setDetail(describe(message));
      },
    };

    const props: StreamProps = {
      streamSource: StreamType.DIRECT,
      logLevel: LogLevel.WARN,
      streamConfig,
    };

    // NOTE: AppStreamer is a stateful singleton driving a single capture thread
    // on the Isaac Sim side, so connect() must run exactly once per mount. This
    // is why the app does not use React.StrictMode — see src/main.tsx.
    AppStreamer.connect(props).catch((err: StreamEvent) => {
      if (cancelled) return;
      updateState('error', describe(err));
    });

    return () => {
      cancelled = true;
      AppStreamer.terminate().catch(() => {
        // Nothing to do if the stream was never fully established.
      });
    };
  }, [target, updateState]);

  return (
    <div className="stream-viewer">
      <video id="remote-video" autoPlay muted playsInline />
      <audio id="remote-audio" autoPlay />
      {state !== 'streaming' && (
        <div className="stream-overlay">
          <StatusOverlay state={state} detail={detail} />
        </div>
      )}
    </div>
  );
}
