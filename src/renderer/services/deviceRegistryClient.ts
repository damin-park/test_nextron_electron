/**
 * Device registry REST 클라이언트.
 */
import { apiGet, apiPost } from './httpClient';
import type {
  RegisterDeviceRequest,
  RegisteredDevice,
  RegisteredDevicesSummary,
} from './deviceTypes';

export function getRegisteredSummary(): Promise<RegisteredDevicesSummary> {
  return apiGet<RegisteredDevicesSummary>('/api/v1/devices/registered/summary');
}

export function registerDevice(
  request: RegisterDeviceRequest,
): Promise<RegisteredDevice> {
  return apiPost<RegisteredDevice>('/api/v1/devices/register', request);
}
