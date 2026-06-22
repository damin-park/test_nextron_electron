/**
 * Init Connect 화면 (tkinter init_connect_window.py 재현).
 *
 * 등록된 장비가 없을 때 표시되는 장비 등록 팝업의 renderer UI.
 * 이번 단계에서는 Temperature Controller 만 실제 등록 가능하며,
 * 나머지 장비 타입은 placeholder(disabled)로 표시한다.
 *
 * REST 호출은 모두 services 계층(baseUrl 사용)을 통해 수행하고,
 * 윈도우 lifecycle(완료/취소)만 preload(window.nextron)로 처리한다.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  cancelInitConnect,
  completeInitConnect,
} from '../../services/backendConnection';
import {
  getRegisteredSummary,
  registerDevice,
} from '../../services/deviceRegistryClient';
import { listSerialResources } from '../../services/resourceClient';
import { probeTemperature } from '../../services/temperatureClient';
import {
  DEFAULT_SERIAL_CONNECTION,
  type DeviceType,
  type SerialResource,
} from '../../services/deviceTypes';

interface DeviceTypeOption {
  type: DeviceType;
  label: string;
  enabled: boolean;
}

const DEVICE_TYPES: DeviceTypeOption[] = [
  { type: 'temperature', label: 'Temperature', enabled: true },
  { type: 'mfc', label: 'Mass Flow', enabled: false },
  { type: 'humidity', label: 'Humidity', enabled: false },
  { type: 'pressure', label: 'Pressure', enabled: false },
  { type: 'measurement', label: 'SMU', enabled: false },
  { type: 'chiller', label: 'Chiller', enabled: false },
];

const TEMPERATURE_MODELS = ['PT', 'PTH', 'CHL', 'CHH', 'CHU', 'LN'];

type TestState = 'idle' | 'testing' | 'success' | 'fail';

const STATUS_COLOR: Record<TestState, string> = {
  idle: '#C7C7C7',
  testing: '#FFAA00',
  success: '#34C759',
  fail: '#E6231C',
};

export function InitConnectApp(): JSX.Element {
  const [selectedType, setSelectedType] = useState<DeviceType>('temperature');
  const [model, setModel] = useState<string>(TEMPERATURE_MODELS[0]);
  const [ports, setPorts] = useState<SerialResource[]>([]);
  const [port, setPort] = useState<string>('');
  const [testState, setTestState] = useState<TestState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>(
    'Select a port and run a connection test.',
  );
  const [registering, setRegistering] = useState<boolean>(false);

  const refreshPorts = useCallback(async () => {
    try {
      const resources = await listSerialResources();
      setPorts(resources);
      setPort((current) => {
        if (current && resources.some((r) => r.port === current)) {
          return current;
        }
        return resources[0]?.port ?? '';
      });
    } catch {
      setPorts([]);
      setStatusMessage('Failed to load serial ports.');
    }
  }, []);

  useEffect(() => {
    void refreshPorts();
  }, [refreshPorts]);

  const buildConnection = useCallback(
    () => ({ ...DEFAULT_SERIAL_CONNECTION, port }),
    [port],
  );

  const handleTest = useCallback(async () => {
    if (!port) {
      setTestState('fail');
      setStatusMessage('Please select a port.');
      return;
    }

    setTestState('testing');
    setStatusMessage('Testing connection...');

    try {
      const ok = await probeTemperature({ connection: buildConnection(), model });
      if (ok) {
        setTestState('success');
        setStatusMessage('Connection successful.');
      } else {
        setTestState('fail');
        setStatusMessage('Connection failed. Check the port and device.');
      }
    } catch {
      setTestState('fail');
      setStatusMessage('Connection test error.');
    }
  }, [buildConnection, model, port]);

  const handleAdd = useCallback(async () => {
    if (testState !== 'success') {
      return;
    }

    setRegistering(true);
    setStatusMessage('Registering device...');

    try {
      await registerDevice({
        type: 'temperature',
        displayName: 'Temperature Controller',
        enabled: true,
        connection: buildConnection(),
        model,
      });

      const summary = await getRegisteredSummary();
      if (!summary.hasRegisteredDevices) {
        setRegistering(false);
        setStatusMessage('Registration could not be verified.');
        return;
      }

      await completeInitConnect();
    } catch {
      setRegistering(false);
      setStatusMessage('Failed to register device.');
    }
  }, [buildConnection, model, testState]);

  const handleClose = useCallback(() => {
    void cancelInitConnect();
  }, []);

  const addEnabled = testState === 'success' && !registering;

  return (
    <div className="init-connect">
      <header className="init-connect__header">
        <h1 className="init-connect__title">Add a device</h1>
        <p className="init-connect__subtitle">
          Select the type of device you want to connect.
        </p>
      </header>

      <div className="init-connect__body">
        <nav className="init-connect__types" aria-label="Device types">
          {DEVICE_TYPES.map((option) => {
            const selected = option.type === selectedType;
            return (
              <button
                key={option.type}
                type="button"
                className={[
                  'init-connect__type',
                  selected ? 'is-selected' : '',
                  option.enabled ? '' : 'is-disabled',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!option.enabled}
                onClick={() => option.enabled && setSelectedType(option.type)}
              >
                {option.label}
                {!option.enabled && (
                  <span className="init-connect__type-badge">Soon</span>
                )}
              </button>
            );
          })}
        </nav>

        <section className="init-connect__form">
          <label className="init-connect__field">
            <span className="init-connect__label">Model</span>
            <select
              className="init-connect__select"
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setTestState('idle');
              }}
            >
              {TEMPERATURE_MODELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="init-connect__field">
            <span className="init-connect__label">Port</span>
            <div className="init-connect__port-row">
              <select
                className="init-connect__select"
                value={port}
                onChange={(event) => {
                  setPort(event.target.value);
                  setTestState('idle');
                }}
              >
                {ports.length === 0 && <option value="">No ports found</option>}
                {ports.map((resource) => (
                  <option key={resource.port} value={resource.port}>
                    {resource.description
                      ? `${resource.port} — ${resource.description}`
                      : resource.port}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="init-connect__button init-connect__button--ghost"
                onClick={() => void refreshPorts()}
              >
                Refresh
              </button>
            </div>
          </label>

          <button
            type="button"
            className="init-connect__button init-connect__button--ghost"
            onClick={() => void handleTest()}
            disabled={testState === 'testing' || !port}
          >
            Connection Test
          </button>

          <p
            className="init-connect__status"
            style={{ color: STATUS_COLOR[testState] }}
          >
            {statusMessage}
          </p>
        </section>
      </div>

      <footer className="init-connect__footer">
        <button
          type="button"
          className="init-connect__button init-connect__button--ghost"
          onClick={handleClose}
        >
          Close
        </button>
        <button
          type="button"
          className="init-connect__button init-connect__button--primary"
          onClick={() => void handleAdd()}
          disabled={!addEnabled}
        >
          {registering ? 'Adding...' : 'Add Device'}
        </button>
      </footer>
    </div>
  );
}
