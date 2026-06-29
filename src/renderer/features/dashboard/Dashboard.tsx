/**
 * 대시보드 (dashboard_manager.py 재현).
 * Temperature 카드는 실시간 데이터 + 연결 액션을 제공한다.
 * 나머지 장비 패널(Chiller/Humidity/MFC/Pressure/SMU)은 placeholder.
 */
import type { ReactElement } from 'react';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';
import { getIconGlyph, type IconName } from '../../shared/icons/materialSymbols';
import { TemperatureCard } from './TemperatureCard';

interface Reading {
  label: string;
  value: string;
  unit: string;
}

interface DashboardPanelConfig {
  id: string;
  icon: IconName;
  title: string;
  readings: Reading[];
}

const PLACEHOLDER_PANELS: DashboardPanelConfig[] = [
  {
    id: 'chiller',
    icon: 'cool',
    title: 'Chiller',
    readings: [
      { label: 'SV', value: '--', unit: '\u00B0C' },
      { label: 'PV', value: '--', unit: '\u00B0C' },
    ],
  },
  {
    id: 'humidity',
    icon: 'humidity',
    title: 'Humid',
    readings: [
      { label: 'SV', value: '--', unit: '%RH' },
      { label: 'PV', value: '--', unit: '%RH' },
    ],
  },
  {
    id: 'mfc',
    icon: 'mfc',
    title: 'MFC',
    readings: [
      { label: 'SV', value: '--', unit: 'sccm' },
      { label: 'PV', value: '--', unit: 'sccm' },
    ],
  },
  {
    id: 'pressure',
    icon: 'pressure',
    title: 'Press',
    readings: [
      { label: 'SV', value: '--', unit: 'mTorr' },
      { label: 'PV', value: '--', unit: 'mTorr' },
    ],
  },
  {
    id: 'smu',
    icon: 'measurement',
    title: 'SMU',
    readings: [
      { label: 'V', value: '--', unit: 'V' },
      { label: 'I', value: '--', unit: 'A' },
      { label: 'R', value: '--', unit: '\u03A9' },
    ],
  },
];

interface DashboardProps {
  temperatureConnection: UseTemperatureConnectionResult;
}

export function Dashboard({
  temperatureConnection,
}: DashboardProps): ReactElement {
  return (
    <div className="dashboard">
      {/* Temperature 카드 (실시간 + 연결 액션) */}
      <TemperatureCard connection={temperatureConnection} />

      {/* 나머지 장비 패널 (placeholder, 미연결 dim 처리) */}
      {PLACEHOLDER_PANELS.map((config) => (
        <div key={config.id} className="temp-card is-dimmed" data-id={config.id}>
          <div className="temp-card__header">
            <div className="temp-card__title-group">
              <span className="material-symbols-outlined temp-card__title-icon">
                {getIconGlyph(config.icon)}
              </span>
              <span className="temp-card__title">{config.title}</span>
            </div>
          </div>
          <div className="temp-card__body">
            <div className="temp-card__left">
              {config.readings.map((reading, index) => (
                <div key={`${reading.label}-${index}`} className="temp-card__row">
                  <span className="temp-card__label">{reading.label}</span>
                  <span className="temp-card__value">{reading.value}</span>
                  <span className="temp-card__unit">{reading.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
