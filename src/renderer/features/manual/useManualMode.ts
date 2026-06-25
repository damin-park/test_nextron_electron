import { useMemo, useState } from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import type { ManualDeviceConfig, ManualDeviceId } from './manualTypes';

const BACKEND_GAPS: Record<Exclude<ManualDeviceId, 'temp'>, string> = {
  mfc: 'Backend endpoint missing',
  humidity: 'Backend endpoint missing',
  pressure: 'Backend endpoint missing',
  measurement: 'Backend endpoint missing',
  chiller: 'Backend endpoint missing',
};

interface UseManualModeResult {
  devices: ManualDeviceConfig[];
  selectedDeviceId: ManualDeviceId;
  setSelectedDeviceId: (id: ManualDeviceId) => void;
}

export function useManualMode(
  temperatureState: TemperatureDeviceState | null,
): UseManualModeResult {
  const temperatureConnected = temperatureState?.connected === true;

  const devices = useMemo<ManualDeviceConfig[]>(
    () => [
      {
        id: 'temp',
        label: 'Temp',
        title: 'Temperature',
        icon: 'thermostat',
        enabled: temperatureConnected,
        connected: temperatureConnected,
        gap: temperatureConnected ? undefined : 'Temperature is not connected',
      },
      {
        id: 'mfc',
        label: 'MFC',
        title: 'MFC',
        icon: 'switches',
        enabled: false,
        connected: false,
        gap: BACKEND_GAPS.mfc,
      },
      {
        id: 'humidity',
        label: 'Humid',
        title: 'Humidity',
        icon: 'switches',
        enabled: false,
        connected: false,
        gap: BACKEND_GAPS.humidity,
      },
      {
        id: 'pressure',
        label: 'Press',
        title: 'Pressure',
        icon: 'switches',
        enabled: false,
        connected: false,
        gap: BACKEND_GAPS.pressure,
      },
      {
        id: 'measurement',
        label: 'SMU',
        title: 'Measurement',
        icon: 'switches',
        enabled: false,
        connected: false,
        gap: BACKEND_GAPS.measurement,
      },
      {
        id: 'chiller',
        label: 'Chiller',
        title: 'Chiller',
        icon: 'switches',
        enabled: false,
        connected: false,
        gap: BACKEND_GAPS.chiller,
      },
    ],
    [temperatureConnected],
  );

  const [selectedDeviceId, setSelectedDeviceId] =
    useState<ManualDeviceId>('temp');

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
  };
}
