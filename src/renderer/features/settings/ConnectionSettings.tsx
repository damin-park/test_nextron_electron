/**
 * Settings > Connection 패널 (connection_setting.py 재현).
 *
 * Temperature 장비의 연결 설정(포트/모델)을 제공하고
 * Refresh / Connect / Disconnect / Find Device 버튼을 통해 장비를 제어한다.
 *
 * 기존 Tkinter Settings>Connection과 동일하게 baudrate/timeout은 사용자에게
 * 노출하지 않고 내부 고정값을 사용한다.
 *
 * SettingsApp(팝업 창) 내부의 detail 영역에 표시되는 패널 콘텐츠다.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { listSerialResources } from '../../services/resourceClient';
import type {
  SerialResource,
  TemperatureDeviceConnectRequest,
} from '../../services/deviceTypes';
import {
  useTemperatureConnection,
  type ConnectionActionState,
} from '../temperature/useTemperatureConnection';

const DEFAULT_DEVICE_ID = 'temperature-1';
const TEMPERATURE_MODELS = ['PT', 'PTH', 'CHL', 'CHH', 'CHU', 'LN'];
// 내부 고정값 (Tkinter와 동일하게 UI 미노출)
const FIXED_BAUDRATE = 9600;
const FIXED_TIMEOUT_SEC = 5.0;

/** 연결 상태 텍스트 및 색상 */
function statusDisplay(
  connected: boolean | undefined,
  action: ConnectionActionState,
): { text: string; color: string } {
  if (action === 'connecting') return { text: 'Connecting...', color: '#F1C40F' };
  if (action === 'disconnecting') return { text: 'Disconnecting...', color: '#F1C40F' };
  if (action === 'probing') return { text: 'Probing...', color: '#F1C40F' };
  if (connected === true) return { text: 'Connected', color: '#34C759' };
  if (connected === false) return { text: 'Disconnected', color: '#E6231C' };
  return { text: 'Unknown', color: '#888888' };
}

export function ConnectionSettings(): ReactElement {
  const { state, actionState, error, connect, disconnect, probe, clearError } =
    useTemperatureConnection(DEFAULT_DEVICE_ID);

  const [ports, setPorts] = useState<SerialResource[]>([]);
  const [port, setPort] = useState<string>('');
  const [model, setModel] = useState<string>(TEMPERATURE_MODELS[0]);
  const [portsLoading, setPortsLoading] = useState(false);

  const refreshPorts = useCallback(async () => {
    setPortsLoading(true);
    try {
      const resources = await listSerialResources();
      setPorts(resources);
      setPort((prev) => {
        if (prev && resources.some((r) => r.port === prev)) return prev;
        return resources[0]?.port ?? '';
      });
    } catch {
      setPorts([]);
    } finally {
      setPortsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPorts();
  }, [refreshPorts]);

  const handleConnect = useCallback(async () => {
    const request: TemperatureDeviceConnectRequest = {
      ...(port ? { port } : {}),
      baudrate: FIXED_BAUDRATE,
      timeoutSec: FIXED_TIMEOUT_SEC,
      model,
    };
    await connect(request);
  }, [connect, port, model]);

  const isBusy = actionState !== 'idle';
  const connected = state?.connected;
  const { text: statusText, color: statusColor } = statusDisplay(
    connected,
    actionState,
  );

  return (
    <div className="conn-settings">
      {/* ─── Temperature 섹션 ─── */}
      <div className="conn-settings__body">
        <div className="conn-settings__device-section">
          <div className="conn-settings__device-title">
            <span
              className="conn-settings__status-dot"
              style={{ background: statusColor }}
            />
            Temperature Controller
            <span
              className="conn-settings__status-text"
              style={{ color: statusColor }}
            >
              {statusText}
            </span>
          </div>

          <div className="conn-settings__device-id">
            Device ID: <code>{DEFAULT_DEVICE_ID}</code>
            {state?.model && (
              <span className="conn-settings__model-badge">{state.model}</span>
            )}
          </div>

          {/* ─── 폼 ─── */}
          <div className="conn-settings__form">
            {/* 포트 선택 */}
            <div className="conn-settings__field">
              <label className="conn-settings__label" htmlFor="cs-port">
                Serial Port
              </label>
              <div className="conn-settings__port-row">
                <select
                  id="cs-port"
                  className="conn-settings__select"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled={isBusy}
                >
                  {ports.length === 0 && (
                    <option value="">No ports found</option>
                  )}
                  {ports.map((r) => (
                    <option key={r.port} value={r.port}>
                      {r.description
                        ? `${r.port} — ${r.description}`
                        : r.port}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="conn-settings__btn"
                  onClick={() => void refreshPorts()}
                  disabled={portsLoading || isBusy}
                >
                  {portsLoading ? '...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* 모델 */}
            <div className="conn-settings__field">
              <label className="conn-settings__label" htmlFor="cs-model">
                Model
              </label>
              <select
                id="cs-model"
                className="conn-settings__select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={isBusy}
              >
                {TEMPERATURE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── 버튼 ─── */}
          <div className="conn-settings__actions">
            <button
              type="button"
              className="conn-settings__btn conn-settings__btn--ghost"
              disabled={isBusy}
              onClick={() => void probe()}
            >
              Find Device
            </button>
            <button
              type="button"
              className="conn-settings__btn conn-settings__btn--primary"
              disabled={isBusy || connected === true}
              onClick={() => void handleConnect()}
            >
              {actionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
            <button
              type="button"
              className="conn-settings__btn conn-settings__btn--danger"
              disabled={isBusy || connected !== true}
              onClick={() => void disconnect()}
            >
              {actionState === 'disconnecting' ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>

          {/* ─── 에러 ─── */}
          {error && (
            <div className="conn-settings__error">
              <span>{error}</span>
              <button
                type="button"
                className="conn-settings__error-close"
                onClick={clearError}
                aria-label="에러 닫기"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
