import { useState, type ReactElement } from 'react';
import type { ApiCommandResponse } from '../../services/deviceTypes';
import {
  setTemperatureRunMode,
  setTemperatureStopMode,
  writeTemperatureRampingRate,
  writeTemperatureSetpoint,
} from '../../services/temperatureClient';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';

interface ManualTemperatureControlProps {
  connection: UseTemperatureConnectionResult;
}

export function ManualTemperatureControl({
  connection,
}: ManualTemperatureControlProps): ReactElement {
  const { state, refreshState } = connection;
  const [setValue, setSetValue] = useState('25.0');
  const [rampingRate, setRampingRate] = useState('30.0');
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const connected = state?.connected === true;
  const busy = pendingCommand != null;

  const runCommand = async (
    label: string,
    command: () => Promise<ApiCommandResponse>,
  ): Promise<boolean> => {
    if (!connected || busy) return false;
    setPendingCommand(label);
    setMessage(null);
    try {
      const response = await command();
      if (response.status === 'error') {
        setMessage(response.error ?? `${label} failed`);
        return false;
      }
      setMessage(`${label} OK`);
      await refreshState();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setPendingCommand(null);
    }
  };

  const parseInput = (raw: string, label: string): number | null => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setMessage(`${label} must be numeric`);
      return null;
    }
    return value;
  };

  const handleSetValue = (): Promise<boolean> => {
    const value = parseInput(setValue, 'Set Value');
    if (value == null) return Promise.resolve(false);
    return runCommand('Set Value', () =>
      writeTemperatureSetpoint('temperature-1', value),
    );
  };

  const handleRampingRate = (): Promise<boolean> => {
    const value = parseInput(rampingRate, 'Ramping Rate');
    if (value == null) return Promise.resolve(false);
    return runCommand('Ramping Rate', () =>
      writeTemperatureRampingRate('temperature-1', value),
    );
  };

  const handleRun = async (): Promise<void> => {
    const targetValue = parseInput(setValue, 'Set Value');
    if (targetValue == null) return;
    const rampValue = parseInput(rampingRate, 'Ramping Rate');
    if (rampValue == null) return;
    const setOk = await runCommand('Set Value', () =>
      writeTemperatureSetpoint('temperature-1', targetValue),
    );
    if (!setOk) return;
    const rampOk = await runCommand('Ramping Rate', () =>
      writeTemperatureRampingRate('temperature-1', rampValue),
    );
    if (!rampOk) return;
    await runCommand('On', () => setTemperatureRunMode('temperature-1'));
  };

  const handleStop = (): Promise<boolean> =>
    runCommand('Off', () => setTemperatureStopMode('temperature-1'));

  return (
    <section className="manual-device-panel">
      <header className="manual-device-panel__header">
        <div className="manual-device-panel__title">Temperature</div>
        <div
          className={`manual-device-panel__status${
            connected ? ' is-connected' : ''
          }`}
        >
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <div className="manual-form">
        <div className="manual-form__field">
          <label className="manual-form__label" htmlFor="manual-temp-set-value">
            Set Value [C]
          </label>
          <input
            id="manual-temp-set-value"
            className="manual-form__input"
            value={setValue}
            onChange={(event) => setSetValue(event.target.value)}
            disabled={!connected || busy}
            inputMode="decimal"
          />
          <button
            type="button"
            className="manual-form__button"
            onClick={() => void handleSetValue()}
            disabled={!connected || busy}
          >
            Set
          </button>
        </div>

        <div className="manual-form__field">
          <label className="manual-form__label" htmlFor="manual-temp-ramping">
            Ramping Rate [C/min]
          </label>
          <input
            id="manual-temp-ramping"
            className="manual-form__input"
            value={rampingRate}
            onChange={(event) => setRampingRate(event.target.value)}
            disabled={!connected || busy}
            inputMode="decimal"
          />
          <button
            type="button"
            className="manual-form__button"
            onClick={() => void handleRampingRate()}
            disabled={!connected || busy}
          >
            Set
          </button>
        </div>
      </div>

      <div className="manual-actions">
        <button
          type="button"
          className="manual-actions__button"
          disabled={!connected || busy}
          onClick={() => void handleRun()}
        >
          On
        </button>
        <button
          type="button"
          className="manual-actions__button"
          disabled={!connected || busy}
          onClick={() => void handleStop()}
        >
          Off
        </button>
      </div>

      {(message || pendingCommand || !connected) && (
        <div className={`manual-command-message${message?.endsWith('OK') ? ' is-ok' : ''}`}>
          {pendingCommand
            ? `${pendingCommand} pending`
            : message ?? 'Temperature is not connected'}
        </div>
      )}
    </section>
  );
}
