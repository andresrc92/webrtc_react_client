import { useCallback, useState } from 'react';
import { ConnectForm } from './components/ConnectForm';
import { StreamViewer, type ConnectionState, type StreamTarget } from './components/StreamViewer';
import { SidePanel } from './components/SidePanel';
import { defaultStreamConfig } from './config';
import { SUPPORTED_ISAAC_SIM_VERSIONS } from './isaacSimCompat';
import './App.css';
import './sidePanel.css';

// Deep-linkable connect (?server=...&signalingPort=...&mediaPort=...) so a
// target can be scripted/bookmarked instead of always going through the form.
function targetFromSearchParams(): StreamTarget | null {
  const params = new URLSearchParams(window.location.search);
  const server = params.get('server');
  if (!server) return null;
  return {
    server,
    signalingPort: Number(params.get('signalingPort') ?? defaultStreamConfig.signalingPort),
    mediaPort: Number(params.get('mediaPort') ?? defaultStreamConfig.mediaPort),
    width: Number(params.get('width') ?? defaultStreamConfig.width),
    height: Number(params.get('height') ?? defaultStreamConfig.height),
    fps: Number(params.get('fps') ?? defaultStreamConfig.fps),
  };
}

// VITE_ISAAC_SIM_SERVER (docker-compose bakes this in from ISAAC_SIM_HOST) is
// a known, fixed deployment target, so default straight to it instead of
// making the operator retype an IP the build already knows. Still
// overridable via the ?server= deep link above, and via Disconnect ->
// ConnectForm for a one-off different target.
function targetFromDefaultConfig(): StreamTarget | null {
  if (!defaultStreamConfig.server) return null;
  return {
    server: defaultStreamConfig.server,
    signalingPort: defaultStreamConfig.signalingPort,
    mediaPort: defaultStreamConfig.mediaPort,
    width: defaultStreamConfig.width,
    height: defaultStreamConfig.height,
    fps: defaultStreamConfig.fps,
  };
}

function initialTarget(): StreamTarget | null {
  return targetFromSearchParams() ?? targetFromDefaultConfig();
}

function App() {
  const [target, setTarget] = useState<StreamTarget | null>(initialTarget);
  const [state, setState] = useState<ConnectionState>('stopped');

  const handleConnect = useCallback((next: StreamTarget) => setTarget(next), []);
  const handleDisconnect = useCallback(() => setTarget(null), []);
  const handleStateChange = useCallback((next: ConnectionState) => setState(next), []);

  const busy = target !== null && state !== 'error' && state !== 'stopped';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
          <h1>Isaac Sim Streaming Client</h1>
          <span className="app-header-subtitle">For Isaac Sim {SUPPORTED_ISAAC_SIM_VERSIONS}</span>
        </div>
        {target && (
          <button className="disconnect-button" onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </header>
      <main className="app-main">
        <div className="app-main__content">
          {target ? (
            <StreamViewer target={target} onStateChange={handleStateChange} />
          ) : (
            <ConnectForm disabled={busy} onConnect={handleConnect} />
          )}
        </div>
        <SidePanel />
      </main>
    </div>
  );
}

export default App;
