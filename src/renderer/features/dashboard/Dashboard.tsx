/**
 * 대시보드 (dashboard_manager.py 재현).
 * Temperature / Humidity / MFC / Pressure / SMU 등 장비 패널을 가로로 나열한다.
 */
import type { ReactElement } from 'react';

interface Reading {
  label: string;
  value: string;
  unit: string;
}

interface DashboardPanelConfig {
  id: string;
  badge: string;
  readings: Reading[];
}

const DEFAULT_PANELS: DashboardPanelConfig[] = [
  {
    id: 'temperature',
    badge: 'Temp',
    readings: [
      { label: 'SV', value: '--', unit: '°C' },
      { label: 'PV', value: '--', unit: '°C' },
    ],
  },
  {
    id: 'humidity',
    badge: 'Humid',
    readings: [
      { label: 'SV', value: '--', unit: '%RH' },
      { label: 'PV', value: '--', unit: '%RH' },
    ],
  },
  {
    id: 'mfc',
    badge: 'MFC',
    readings: [
      { label: 'SV', value: '--', unit: 'sccm' },
      { label: 'PV', value: '--', unit: 'sccm' },
    ],
  },
  {
    id: 'pressure',
    badge: 'Press',
    readings: [
      { label: 'SV', value: '--', unit: 'mTorr' },
      { label: 'PV', value: '--', unit: 'mTorr' },
    ],
  },
  {
    id: 'smu',
    badge: 'SMU',
    readings: [
      { label: 'V', value: '--', unit: 'V' },
      { label: 'I', value: '--', unit: 'A' },
    ],
  },
];

export function Dashboard(): ReactElement {
  return (
    <div className="dashboard">
      {DEFAULT_PANELS.map((config) => (
        <div key={config.id} className="dashboard__panel" data-id={config.id}>
          <div className="dashboard__badge">{config.badge}</div>
          <div className="dashboard__readings">
            {config.readings.map((reading, index) => (
              <div key={`${reading.label}-${index}`} className="dashboard__row">
                <span className="dashboard__row-label">{reading.label}</span>
                <span className="dashboard__row-value">{reading.value}</span>
                <span className="dashboard__row-unit">{reading.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
