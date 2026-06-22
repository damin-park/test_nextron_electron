/**
 * Resource discovery REST 클라이언트 (serial / visa).
 */
import { apiGet } from './httpClient';
import type { SerialResource, VisaResource } from './deviceTypes';

export async function listSerialResources(): Promise<SerialResource[]> {
  const result = await apiGet<{ resources: SerialResource[] }>(
    '/api/v1/resources/serial',
  );
  return result.resources;
}

export async function listVisaResources(): Promise<VisaResource[]> {
  const result = await apiGet<{ resources: VisaResource[] }>(
    '/api/v1/resources/visa',
  );
  return result.resources;
}
