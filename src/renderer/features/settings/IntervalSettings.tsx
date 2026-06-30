import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  getIntervalSettings,
  setDataUpdateInterval,
  type IntervalSettings as IntervalSettingsData,
} from '../../services/systemSettingsClient';

const FALLBACK_SETTINGS: IntervalSettingsData = {
  dataUpdate: 1.0,
  minimum: 0.5,
  default: 1.0,
};

function formatInterval(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function IntervalSettings(): ReactElement {
  const [settings, setSettings] =
    useState<IntervalSettingsData>(FALLBACK_SETTINGS);
  const [value, setValue] = useState(formatInterval(FALLBACK_SETTINGS.dataUpdate));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getIntervalSettings();
      setSettings(next);
      setValue(formatInterval(next.dataUpdate));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(async () => {
    setError(null);
    setMessage(null);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Please provide a positive numeric value.');
      setValue(formatInterval(settings.dataUpdate));
      return;
    }
    if (parsed < settings.minimum) {
      setError(`The interval must be no less than ${settings.minimum} seconds.`);
      setValue(formatInterval(settings.dataUpdate));
      return;
    }

    setSaving(true);
    try {
      const next = await setDataUpdateInterval(parsed);
      setSettings(next);
      setValue(formatInterval(next.dataUpdate));
      setMessage(`Interval updated: ${next.dataUpdate} s`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [settings, value]);

  const resetToDefault = useCallback(() => {
    setValue(formatInterval(settings.default));
    setMessage(null);
    setError(null);
  }, [settings.default]);

  return (
    <div className="interval-settings">
      <div className="interval-settings__body">
        <div className="interval-settings__section">
          <div className="interval-settings__title">Interval Time</div>

          <div className="interval-settings__form">
            <div className="interval-settings__field">
              <label className="interval-settings__label" htmlFor="interval-data-update">
                Interval [s]
              </label>
              <input
                id="interval-data-update"
                className="interval-settings__input"
                type="number"
                min={settings.minimum}
                step="0.1"
                value={value}
                disabled={loading || saving}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void apply();
                }}
              />
            </div>
          </div>

          <div className="interval-settings__meta">
            Min {settings.minimum} s
          </div>

          <div className="interval-settings__actions">
            <button
              type="button"
              className="interval-settings__btn"
              disabled={loading || saving}
              onClick={resetToDefault}
            >
              Default
            </button>
            <button
              type="button"
              className="interval-settings__btn interval-settings__btn--primary"
              disabled={loading || saving}
              onClick={() => void apply()}
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>

          {message && <div className="interval-settings__message is-ok">{message}</div>}
          {error && <div className="interval-settings__message">{error}</div>}
        </div>
      </div>
    </div>
  );
}
