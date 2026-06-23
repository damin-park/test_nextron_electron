/**
 * Backend REST API 경로 상수.
 * 버전 prefix 없이 /api/devices/... 형태를 사용한다.
 */
export const DEVICES_BASE = '/api/devices';

/** Temperature 장비별 엔드포인트 경로 생성기 */
export const tempPath = {
  probe: (id: string) => `${DEVICES_BASE}/temperature/${id}/probe`,
  connect: (id: string) => `${DEVICES_BASE}/temperature/${id}/connect`,
  disconnect: (id: string) => `${DEVICES_BASE}/temperature/${id}/disconnect`,
  readCurrent: (id: string) => `${DEVICES_BASE}/temperature/${id}/read-current`,
  pollingStart: (id: string) =>
    `${DEVICES_BASE}/temperature/${id}/polling/start`,
  pollingStop: (id: string) => `${DEVICES_BASE}/temperature/${id}/polling/stop`,
  state: (id: string) => `${DEVICES_BASE}/temperature/${id}/state`,
};
