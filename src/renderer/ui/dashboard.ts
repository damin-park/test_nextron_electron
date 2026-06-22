/**
 * 대시보드 (dashboard_manager.py 재현).
 * Temperature / Humidity / MFC / Pressure / SMU 등 장비 패널을 가로로 나열한다.
 */

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

export function createDashboard(): HTMLElement {
  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard';

  for (const config of DEFAULT_PANELS) {
    const panel = document.createElement('div');
    panel.className = 'dashboard__panel';
    panel.dataset.id = config.id;

    const badge = document.createElement('div');
    badge.className = 'dashboard__badge';
    badge.textContent = config.badge;

    const readings = document.createElement('div');
    readings.className = 'dashboard__readings';

    for (const reading of config.readings) {
      const row = document.createElement('div');
      row.className = 'dashboard__row';
      row.innerHTML = `
        <span class="dashboard__row-label">${reading.label}</span>
        <span class="dashboard__row-value">${reading.value}</span>
        <span class="dashboard__row-unit">${reading.unit}</span>
      `;
      readings.appendChild(row);
    }

    panel.append(badge, readings);
    dashboard.appendChild(panel);
  }

  return dashboard;
}
