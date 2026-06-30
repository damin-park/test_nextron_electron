import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  getTemperatureSettings,
  writeTemperatureDecimalPoint,
  writeTemperaturePidSettings,
  type TemperaturePidValues,
  type TemperatureSettingsData,
} from '../../services/temperatureClient';
import {
  getLabSettings,
  setLabUnitTime,
  type LabSettings,
} from '../../services/systemSettingsClient';
import { useTemperatureConnection } from '../temperature/useTemperatureConnection';

const DEFAULT_DEVICE_ID = 'temperature-1';
const DEFAULT_PID: TemperaturePidValues = { p: 25, i: 8, d: 0 };
const DEFAULT_LAB_UNIT_TIME = 60;

type PidSection = 'heat' | 'cool';
type PidField = keyof TemperaturePidValues;

function toInputValues(values?: TemperaturePidValues | null): Record<PidField, string> {
  const source = values ?? DEFAULT_PID;
  return {
    p: String(source.p),
    i: String(source.i),
    d: String(source.d),
  };
}

function parsePid(values: Record<PidField, string>): TemperaturePidValues {
  return {
    p: Number(values.p),
    i: Number(values.i),
    d: Number(values.d),
  };
}

function validPid(values: TemperaturePidValues): boolean {
  return Object.values(values).every((value) => Number.isFinite(value) && value >= 0);
}

export function TemperatureSettings(): ReactElement {
  const { state } = useTemperatureConnection(DEFAULT_DEVICE_ID);
  const [heat, setHeat] = useState(toInputValues(DEFAULT_PID));
  const [cool, setCool] = useState(toInputValues(DEFAULT_PID));
  const [decimalPoint, setDecimalPoint] = useState('0');
  const [lab, setLab] = useState<LabSettings>({
    enabled: false,
    unitTimeSec: DEFAULT_LAB_UNIT_TIME,
    available: true,
  });
  const [unitTime, setUnitTime] = useState(String(DEFAULT_LAB_UNIT_TIME));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsResp, labSettings] = await Promise.all([
        getTemperatureSettings(DEFAULT_DEVICE_ID),
        getLabSettings(),
      ]);

      if (settingsResp.status === 'ok') {
        const data = settingsResp.data as unknown as TemperatureSettingsData;
        setHeat(toInputValues(data.heat));
        setCool(toInputValues(data.cool));
        setDecimalPoint(String(data.decimalPoint ?? 0));
      } else {
        setError(settingsResp.error ?? 'Failed to load temperature settings');
      }

      setLab(labSettings);
      setUnitTime(String(labSettings.unitTimeSec ?? DEFAULT_LAB_UNIT_TIME));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setPidValue = useCallback(
    (section: PidSection, field: PidField, value: string) => {
      const setter = section === 'heat' ? setHeat : setCool;
      setter((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const resetDefaults = useCallback(() => {
    setHeat(toInputValues(DEFAULT_PID));
    setCool(toInputValues(DEFAULT_PID));
    setDecimalPoint('0');
    setUnitTime(String(DEFAULT_LAB_UNIT_TIME));
    setMessage(null);
    setError(null);
  }, []);

  const apply = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const heatValues = parsePid(heat);
      const coolValues = parsePid(cool);
      if (!validPid(heatValues) || !validPid(coolValues)) {
        throw new Error('PID values must be numeric values greater than or equal to 0.');
      }

      const decimalValue = Number(decimalPoint);
      if (![0, 1].includes(decimalValue)) {
        throw new Error('Decimal Point must be 0 or 1.');
      }

      const pidResp = await writeTemperaturePidSettings(DEFAULT_DEVICE_ID, {
        heat: heatValues,
        cool: coolValues,
      });
      if (pidResp.status === 'error') {
        throw new Error(pidResp.error ?? 'Failed to apply PID settings');
      }

      const decimalResp = await writeTemperatureDecimalPoint(
        DEFAULT_DEVICE_ID,
        decimalValue,
      );
      if (decimalResp.status === 'error') {
        throw new Error(decimalResp.error ?? 'Failed to apply decimal point');
      }

      if (lab.enabled) {
        const parsedUnitTime = Number(unitTime);
        if (!Number.isInteger(parsedUnitTime) || parsedUnitTime <= 0) {
          throw new Error('Unit Time must be a positive integer.');
        }
        const nextLab = await setLabUnitTime(parsedUnitTime);
        setLab(nextLab);
        setUnitTime(String(nextLab.unitTimeSec));
      }

      setMessage('Temperature settings applied.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [cool, decimalPoint, heat, lab.enabled, unitTime]);

  const decimalDisabled = state?.runMode === true || state?.temperatureRunMode === true;

  return (
    <div className="temp-settings-panel">
      <div className="temp-settings-panel__body">
        <PidEditor
          title="Heat PID Setting"
          values={heat}
          disabled={loading || saving}
          onChange={(field, value) => setPidValue('heat', field, value)}
        />
        <PidEditor
          title="Cool PID Setting"
          values={cool}
          disabled={loading || saving}
          onChange={(field, value) => setPidValue('cool', field, value)}
        />

        <section className="temp-settings-panel__section">
          <div className="temp-settings-panel__title">Display Format</div>
          <label className="temp-settings-panel__row">
            <span className="temp-settings-panel__label">Decimal Point:</span>
            <select
              className="temp-settings-panel__select"
              value={decimalPoint}
              disabled={loading || saving || decimalDisabled}
              title={
                decimalDisabled
                  ? 'Cannot change while temperature control is running.'
                  : undefined
              }
              onChange={(e) => setDecimalPoint(e.target.value)}
            >
              <option value="0">Integer (0)</option>
              <option value="1">One Decimal (0.0)</option>
            </select>
          </label>
          {lab.enabled && (
            <label className="temp-settings-panel__row">
              <span className="temp-settings-panel__label">Unit Time [s]:</span>
              <input
                className="temp-settings-panel__input"
                type="number"
                min="1"
                step="1"
                value={unitTime}
                disabled={loading || saving}
                onChange={(e) => setUnitTime(e.target.value)}
              />
            </label>
          )}
        </section>

        <div className="temp-settings-panel__actions">
          <button
            type="button"
            className="temp-settings-panel__btn"
            disabled={loading || saving}
            onClick={resetDefaults}
          >
            Default
          </button>
          <button
            type="button"
            className="temp-settings-panel__btn temp-settings-panel__btn--primary"
            disabled={loading || saving}
            onClick={() => void apply()}
          >
            {saving ? 'Applying...' : 'Apply'}
          </button>
        </div>

        {message && <div className="temp-settings-panel__message is-ok">{message}</div>}
        {error && <div className="temp-settings-panel__message">{error}</div>}
      </div>
    </div>
  );
}

function PidEditor({
  title,
  values,
  disabled,
  onChange,
}: {
  title: string;
  values: Record<PidField, string>;
  disabled: boolean;
  onChange: (field: PidField, value: string) => void;
}): ReactElement {
  return (
    <section className="temp-settings-panel__section">
      <div className="temp-settings-panel__title">{title}</div>
      <div className="temp-settings-panel__pid-grid">
        {([
          ['p', 'P Value'],
          ['i', 'I Value'],
          ['d', 'D Value'],
        ] as Array<[PidField, string]>).map(([field, label]) => (
          <label key={field} className="temp-settings-panel__pid-cell">
            <span className="temp-settings-panel__label">{label}</span>
            <input
              className="temp-settings-panel__input"
              type="number"
              min="0"
              step={field === 'p' ? '0.1' : '1'}
              value={values[field]}
              disabled={disabled}
              onChange={(e) => onChange(field, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
