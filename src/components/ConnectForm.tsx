import { useState, type FormEvent } from 'react';
import { defaultStreamConfig } from '../config';
import { SUPPORTED_ISAAC_SIM_VERSIONS } from '../isaacSimCompat';
import type { StreamTarget } from './StreamViewer';

interface ConnectFormProps {
  disabled: boolean;
  onConnect: (target: StreamTarget) => void;
}

export function ConnectForm({ disabled, onConnect }: ConnectFormProps) {
  const [server, setServer] = useState(defaultStreamConfig.server);
  const [signalingPort, setSignalingPort] = useState(defaultStreamConfig.signalingPort);
  const [mediaPort, setMediaPort] = useState(defaultStreamConfig.mediaPort);
  const [width, setWidth] = useState(defaultStreamConfig.width);
  const [height, setHeight] = useState(defaultStreamConfig.height);
  const [fps, setFps] = useState(defaultStreamConfig.fps);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = server.trim();
    if (!trimmed) return;
    onConnect({ server: trimmed, signalingPort, mediaPort, width, height, fps });
  }

  function resetAdvanced() {
    setSignalingPort(defaultStreamConfig.signalingPort);
    setMediaPort(defaultStreamConfig.mediaPort);
    setWidth(defaultStreamConfig.width);
    setHeight(defaultStreamConfig.height);
    setFps(defaultStreamConfig.fps);
  }

  return (
    <form className="connect-form" onSubmit={handleSubmit}>
      <label>
        Isaac Sim server IP
        <input
          value={server}
          onChange={(event) => setServer(event.target.value)}
          placeholder="e.g. 192.168.1.50"
          disabled={disabled}
          required
        />
      </label>
      <p className="field-hint">Defaults assume Isaac Sim {SUPPORTED_ISAAC_SIM_VERSIONS}.</p>

      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        <span className={`advanced-toggle-chevron ${showAdvanced ? 'open' : ''}`}>▸</span>
        Advanced options
      </button>

      {showAdvanced && (
        <div className="advanced-panel">
          <fieldset className="field-group">
            <legend>Connection</legend>
            <div className="field-row">
              <label>
                Signaling port (TCP)
                <input
                  type="number"
                  value={signalingPort}
                  onChange={(event) => setSignalingPort(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
              <label>
                Media port (UDP)
                <input
                  type="number"
                  value={mediaPort}
                  onChange={(event) => setMediaPort(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="field-group">
            <legend>Video</legend>
            <div className="field-row field-row-3">
              <label>
                Width
                <input
                  type="number"
                  value={width}
                  onChange={(event) => setWidth(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
              <label>
                Height
                <input
                  type="number"
                  value={height}
                  onChange={(event) => setHeight(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
              <label>
                FPS
                <input
                  type="number"
                  value={fps}
                  onChange={(event) => setFps(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
            </div>
          </fieldset>

          <button type="button" className="link-button" onClick={resetAdvanced} disabled={disabled}>
            Reset to defaults
          </button>
        </div>
      )}

      <button type="submit" disabled={disabled || !server.trim()}>
        Connect
      </button>
    </form>
  );
}
