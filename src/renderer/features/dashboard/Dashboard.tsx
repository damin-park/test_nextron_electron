/**
 * 대시보드 (dashboard_manager.py 재현).
 * Temperature / Humidity / MFC / Pressure / SMU 등 장비 패널을 가로로 나열한다.
 * 맨 앞에는 backend 연결 상태 패널을 표시한다(기존 패널 layout/스타일 재사용).
 */
import type { ReactElement } from 'react';
import type {
  BackendConnectionInfo,
  BackendHealthStatus,
  BackendRuntimeStatus,
} from '../../../shared/backend';

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

export interface DashboardProps {
  backendStatus?: BackendRuntimeStatus;
  connection?: BackendConnectionInfo | null;
  health?: BackendHealthStatus | null;
}

const STATUS_TEXT: Record<BackendRuntimeStatus, string> = {
  starting: 'Starting',
  ready: 'Ready',
  'not-ready': 'Not Ready',
  failed: 'Failed',
  stopped: 'Stopped',
  unknown: 'Unknown',
};

const boolText = (value: boolean | undefined): string => {
  if (value === undefined) {
    return '--';
  }
  return value ? 'Yes' : 'No';
};

const formatCheckedAt = (checkedAt: string | undefined): string => {
  if (!checkedAt) {
    return '--';
  }
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleTimeString();
};

function BackendPanel({
  backendStatus,
  connection,
  health,
}: Required<DashboardProps>): ReactElement {
  const url = connection?.baseUrl ? connection.baseUrl : '--';

  return (
    <div className="dashboard__panel" data-id="backend">
      <div className="dashboard__badge">Backend</div>
      <div className="dashboard__readings">
        <div className="dashboard__row">
          <span className="dashboard__row-label">St</span>
          <span className="dashboard__row-value">
            {STATUS_TEXT[backendStatus]}
          </span>
        </div>
        <div className="dashboard__row">
          <span className="dashboard__row-label">Lv</span>
          <span className="dashboard__row-value">{boolText(health?.live)}</span>
          <span className="dashboard__row-label">Rd</span>
          <span className="dashboard__row-value">{boolText(health?.ready)}</span>
        </div>
        <div className="dashboard__row">
          <span className="dashboard__row-label">URL</span>
          <span className="dashboard__row-value">{url}</span>
        </div>
        <div className="dashboard__row">
          <span className="dashboard__row-label">Chk</span>
          <span className="dashboard__row-value">
            {formatCheckedAt(health?.checkedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({
  backendStatus = 'unknown',
  connection = null,
  health = null,
}: DashboardProps = {}): ReactElement {
  return (
    <div className="dashboard">
      <BackendPanel
        backendStatus={backendStatus}
        connection={connection}
        health={health}
      />
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
