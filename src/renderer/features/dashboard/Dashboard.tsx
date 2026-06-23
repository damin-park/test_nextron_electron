/**
 * 대시보드 (dashboard_manager.py 재현).
 * Temperature 카드는 실시간 데이터 + 연결 액션을 제공한다.
 * 나머지 장비 패널(Humidity/MFC/Pressure/SMU)은 placeholder.
 */
import type { ReactElement } from 'react';
import { TemperatureCard } from './TemperatureCard';

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

const PLACEHOLDER_PANELS: DashboardPanelConfig[] = [
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
      {/* Temperature 카드 (실시간 + 연결 액션) */}
      <TemperatureCard />

      {/* 나머지 장비 패널 (placeholder) */}
      {PLACEHOLDER_PANELS.map((config) => (
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
