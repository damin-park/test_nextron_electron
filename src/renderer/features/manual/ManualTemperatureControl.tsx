import {
  useEffect,
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
import {
  loadManualTemperatureInputs,
  saveManualTemperatureInputs,
} from './manualPersistence';

interface ManualTemperatureControlProps {
  connection: UseTemperatureConnectionResult;
}

export function ManualTemperatureControl({
  connection,
}: ManualTemperatureControlProps): ReactElement {
  const { state, refreshState } = connection;
  const initialInputs = loadManualTemperatureInputs();
  const [setValue, setSetValue] = useState(initialInputs.setValue);
  const [rampingRate, setRampingRate] = useState(initialInputs.rampingRate);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [optimisticRunMode, setOptimisticRunMode] = useState<boolean | null>(null);
  const lastSubmittedSetValueRef = useRef(setValue);
  const lastSubmittedRampingRateRef = useRef(rampingRate);

  useEffect(() => {
    saveManualTemperatureInputs({ setValue, rampingRate });
  }, [setValue, rampingRate]);

  const connected = state?.connected === true;
  const actualRunModeOn = Boolean(state?.temperatureRunMode ?? state?.runMode);
  // 낙관적 표시값: 명령 전송 직후 즉시 UI 반영, 실제 상태가 갱신되면 동기화된다.
  const runModeOn = optimisticRunMode ?? actualRunModeOn;
  const safeStopping = Boolean(state?.safeStopping);
  const busy = pendingCommand != null || safeStopping;

  // 실제 telemetry 상태가 낙관적 값과 일치하면 override 해제.
  useEffect(() => {
    if (optimisticRunMode != null && actualRunModeOn === optimisticRunMode) {
      setOptimisticRunMode(null);
    }
  }, [actualRunModeOn, optimisticRunMode]);

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
      setMessage(
        response.data.safeStopping === true ? 'Safe stop started' : `${label} OK`,
      );
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

  const handleRun = (): void => {
    const targetValue = parseInput(setValue, 'Set Value');
    if (targetValue == null) return;
    const rampValue = parseInput(rampingRate, 'Ramping Rate');
    if (rampValue == null) return;
    if (!connected) return;

    // 낙관적 ON: 응답을 기다리지 않고 즉시 UI 반영 (tkinter fire-and-forget 방식).
    setOptimisticRunMode(true);
    lastSubmittedSetValueRef.current = setValue.trim();
    lastSubmittedRampingRateRef.current = rampingRate.trim();
    setMessage('Temperature control started');

    void (async () => {
      try {
        const response = await manualStartTemperature('temperature-1', {
          setValue: targetValue,
          rampingRate: rampValue,
        });
        if (response.status === 'error') {
          const detail = response.data as unknown as
            | TemperatureManualStartResponseData
            | undefined;
          const failedStep = detail?.failedStep;
          const errMsg = response.error ?? 'manual start failed';
          setMessage(failedStep ? `Failed at ${failedStep}: ${errMsg}` : errMsg);
          setOptimisticRunMode(null); // 실패 시 실제 상태로 되돌림
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        setOptimisticRunMode(null);
      } finally {
        void refreshState();
      }
    })();
  };

  const handleStop = (): void => {
    if (!connected) return;

    // 낙관적 OFF: 즉시 UI 반영 후 명령 전송.
    setOptimisticRunMode(false);
    setMessage('Off');

    void (async () => {
      try {
        const response = await setTemperatureStopMode('temperature-1');
        if (response.status === 'error') {
          setMessage(response.error ?? 'Off failed');
          setOptimisticRunMode(null);
        } else if (response.data.safeStopping === true) {
          setMessage('Safe stop started');
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        setOptimisticRunMode(null);
      } finally {
        void refreshState();
      }
    })();
  };

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
          disabled={!connected || safeStopping}
          onClick={handleRun}
        >
          On
        </button>
        <button
          type="button"
          className={`manual-actions__button${
            !runModeOn ? ' manual-actions__button--off-active' : ''
          }`}
          disabled={!connected || safeStopping}
          onClick={handleStop}
        >
          Off
        </button>
      </div>

      {(message || pendingCommand || safeStopping || !connected) && (
        <div className={`manual-command-message${message?.endsWith('OK') ? ' is-ok' : ''}`}>
          {pendingCommand
            ? `${pendingCommand} pending`
            : safeStopping
              ? 'Temperature safe stop is in progress'
            : message ?? 'Temperature is not connected'}
        </div>
      )}
    </section>
  );
}
