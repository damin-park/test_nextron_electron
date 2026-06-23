/**
 * Resource discovery REST 클라이언트 (serial / visa).
 */
import { apiGet } from './httpClient';
import type { SerialResource, VisaResource } from './deviceTypes';

export async function listSerialResources(): Promise<SerialResource[]> {
  const result = await apiGet<
    SerialResource[] | { resources: SerialResource[] }
  >('/api/resources/serial');
  // backend 는 bare 배열을 반환한다. (구버전 호환을 위해 {resources} 형태도 허용)
  return Array.isArray(result) ? result : (result.resources ?? []);
}

export async function listVisaResources(): Promise<VisaResource[]> {
  const result = await apiGet<VisaResource[] | { resources: VisaResource[] }>(
    '/api/resources/visa',
  );
  return Array.isArray(result) ? result : (result.resources ?? []);
}
