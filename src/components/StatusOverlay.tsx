import type { ConnectionState } from './StreamViewer';

const LABELS: Record<ConnectionState, string> = {
  connecting: 'Connecting to Isaac Sim…',
  streaming: 'Streaming',
  stopped: 'Stream stopped',
  error: 'Connection error',
};

interface StatusOverlayProps {
  state: ConnectionState;
  detail?: string;
}

export function StatusOverlay({ state, detail }: StatusOverlayProps) {
  return (
    <div className={`status-overlay status-${state}`}>
      <div className="status-label">{LABELS[state]}</div>
      {detail && <div className="status-detail">{detail}</div>}
    </div>
  );
}
