/**
 * Temperature controller REST 클라이언트.
 * probe/read 는 read-only. setpoint write 는 호출하지 않는다.
 */
import { apiGet, apiPost } from './httpClient';
import type { ConnectionConfig, TemperatureReading } from './deviceTypes';

export interface TemperatureProbeRequest {
  connection: ConnectionConfig;
  model?: string;
}

export async function probeTemperature(
  request: TemperatureProbeRequest,
): Promise<boolean> {
  const result = await apiPost<{ ok: boolean }>(
    '/api/v1/devices/temperature/probe',
    request,
  );
  return result.ok;
}

export function readTemperature(): Promise<TemperatureReading> {
  return apiGet<TemperatureReading>('/api/v1/devices/temperature/read');
}
