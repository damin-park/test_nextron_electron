import { apiGet, apiPost } from './httpClient';
import type { ApiCommandResponse } from './deviceTypes';

export interface IntervalSettings {
  dataUpdate: number;
  minimum: number;
  default: number;
}

export interface LabSettings {
  enabled: boolean;
  unitTimeSec: number;
  available: boolean;
}

export async function getIntervalSettings(): Promise<IntervalSettings> {
  const response = await apiGet<ApiCommandResponse>('/api/system/settings/intervals');
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Failed to load interval settings');
  }
  return response.data as unknown as IntervalSettings;
}

export async function setDataUpdateInterval(
  intervalSec: number,
): Promise<IntervalSettings> {
  const response = await apiPost<ApiCommandResponse>(
    '/api/system/settings/intervals/data-update',
    { intervalSec },
  );
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Failed to update interval settings');
  }
  return response.data as unknown as IntervalSettings;
}

export async function getLabSettings(): Promise<LabSettings> {
  const response = await apiGet<ApiCommandResponse>('/api/system/settings/lab');
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Failed to load lab settings');
  }
  return response.data as unknown as LabSettings;
}

export async function setLabEnabled(enabled: boolean): Promise<LabSettings> {
  const response = await apiPost<ApiCommandResponse>(
    '/api/system/settings/lab/enabled',
    { enabled },
  );
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Failed to update lab settings');
  }
  return response.data as unknown as LabSettings;
}

export async function setLabUnitTime(unitTimeSec: number): Promise<LabSettings> {
  const response = await apiPost<ApiCommandResponse>(
    '/api/system/settings/lab/unit-time',
    { unitTimeSec },
  );
  if (response.status === 'error') {
    throw new Error(response.error ?? 'Failed to update lab unit time');
  }
  return response.data as unknown as LabSettings;
}
