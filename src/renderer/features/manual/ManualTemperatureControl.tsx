import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import type { ApiCommandResponse } from '../../services/deviceTypes';
import {
  manualStartTemperature,
  setTemperatureStopMode,
  writeTemperatureRampingRate,
  writeTemperatureSetpoint,
  type TemperatureManualStartResponseData,
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
  const lastSubmittedSetValueRef = useRef(setValue);
  const lastSubmittedRampingRateRef = useRef(rampingRate);

  const connected = state?.connected === true;
  const runModeOn = Boolean(state?.temperatureRunMode ?? state?.runMode);
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
    const normalized = raw.trim();
    const value = Number(normalized);
    if (normalized.length === 0) {
      setMessage(`${label} must be numeric`);
      return null;
    }
    if (!Number.isFinite(value)) {
      setMessage(`${label} must be numeric`);
      return null;
    }
    return value;
  };

  const commitSetValue = async (force = false): Promise<boolean> => {
    const raw = setValue.trim();
    if (!force && (!runModeOn || raw === lastSubmittedSetValueRef.current)) {
      return false;
    }
    const value = parseInput(raw, 'Set Value');
    if (value == null) return Promise.resolve(false);
    const ok = await runCommand('Set Value', () =>
      writeTemperatureSetpoint('temperature-1', value),
    );
    if (ok) lastSubmittedSetValueRef.current = raw;
    return ok;
  };

  const commitRampingRate = async (force = false): Promise<boolean> => {
    const raw = rampingRate.trim();
    if (!force && (!runModeOn || raw === lastSubmittedRampingRateRef.current)) {
      return false;
    }
    const value = parseInput(raw, 'Ramping Rate');
    if (value == null) return Promise.resolve(false);
    const ok = await runCommand('Ramping Rate', () =>
      writeTemperatureRampingRate('temperature-1', value),
    );
    if (ok) lastSubmittedRampingRateRef.current = raw;
    return ok;
  };

  const handleEntryKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    commit: () => Promise<boolean>,
  ): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void commit();
  };

  const handleRun = async (): Promise<void> => {
    const targetValue = parseInput(setValue, 'Set Value');
    if (targetValue == null) return;
    const rampValue = parseInput(rampingRate, 'Ramping Rate');
    if (rampValue == null) return;

    if (!connected || busy) return;
    setPendingCommand('On');
    setMessage(null);
    try {
      const response = await manualStartTemperature('temperature-1', {
        setValue: targetValue,
        rampingRate: rampValue,
      });
      if (response.status === 'error') {
        const detail = (response.data as TemperatureManualStartResponseData | undefined);
        const failedStep = detail?.failedStep;
        const errMsg = response.error ?? 'manual start failed';
        setMessage(failedStep ? `Failed at ${failedStep}: ${errMsg}` : errMsg);
      } else {
        lastSubmittedSetValueRef.current = setValue.trim();
        lastSubmittedRampingRateRef.current = rampingRate.trim();
        setMessage('Temperature control started');
        await refreshState();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingCommand(null);
    }
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
            Set Value [°C]
          </label>
          <input
            id="manual-temp-set-value"
            className="manual-form__input"
            value={setValue}
            onChange={(event) => setSetValue(event.target.value)}
            onBlur={() => void commitSetValue()}
            onKeyDown={(event) => handleEntryKeyDown(event, commitSetValue)}
            disabled={!connected || busy}
            inputMode="decimal"
          />
        </div>

        <div className="manual-form__field">
          <label className="manual-form__label" htmlFor="manual-temp-ramping">
            Ramping Rate [°C/min]
          </label>
          <input
            id="manual-temp-ramping"
            className="manual-form__input"
            value={rampingRate}
            onChange={(event) => setRampingRate(event.target.value)}
            onBlur={() => void commitRampingRate()}
            onKeyDown={(event) => handleEntryKeyDown(event, commitRampingRate)}
            disabled={!connected || busy}
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="manual-actions">
        <button
          type="button"
          className={`manual-actions__button${
            runModeOn ? ' manual-actions__button--on-active' : ''
          }`}
          disabled={!connected || busy}
          onClick={() => void handleRun()}
        >
          On
        </button>
        <button
          type="button"
          className={`manual-actions__button${
            !runModeOn ? ' manual-actions__button--off-active' : ''
          }`}
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
