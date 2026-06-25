import { forwardRef } from 'react';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';
import type { ControlMode } from '../../shared/types/ui';
import { ManualPanel } from '../manual/ManualPanel';

interface ModeView {
  title: string;
  placeholder: string;
}

const MODE_VIEWS: Record<ControlMode, ModeView> = {
  recipe: {
    title: 'Recipe',
    placeholder:
      'Recipe file selection\nProfile preview (Temperature / MFC / Humidity)\nStart / Stop / Pause\nStep list',
  },
  manual: {
    title: 'Manual',
    placeholder:
      'Temperature / MFC / Humidity / Pressure / Measurement tabs\nManual controls\nRealtime readings',
  },
  iv: {
    title: 'IV',
    placeholder:
      'IV curve measurement\nManual override\nMeasurement / temperature controls',
  },
};

const MODE_ORDER: ControlMode[] = ['recipe', 'manual', 'iv'];

export interface ControlPanelProps {
  mode: ControlMode;
  temperatureConnection: UseTemperatureConnectionResult;
}

export const ControlPanel = forwardRef<HTMLDivElement, ControlPanelProps>(
  function ControlPanel({ mode, temperatureConnection }, ref) {
    return (
      <div className="control-panel" ref={ref}>
        <div className="control-panel__header">{MODE_VIEWS[mode].title}</div>
        {MODE_ORDER.map((key) => (
          <div
            key={key}
            className={`control-panel__mode${key === mode ? ' is-active' : ''}`}
            data-mode={key}
          >
            {key === 'manual' ? (
              <ManualPanel temperatureConnection={temperatureConnection} />
            ) : (
              <div className="control-panel__placeholder">
                {MODE_VIEWS[key].placeholder}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
);
