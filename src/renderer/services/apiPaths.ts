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
  setpoint: (id: string) => `${DEVICES_BASE}/temperature/${id}/setpoint`,
  rampingRate: (id: string) =>
    `${DEVICES_BASE}/temperature/${id}/ramping-rate`,
  run: (id: string) => `${DEVICES_BASE}/temperature/${id}/run`,
  stop: (id: string) => `${DEVICES_BASE}/temperature/${id}/stop`,
  manualStart: (id: string) => `${DEVICES_BASE}/temperature/${id}/manual/start`,
  recipeStepStart: (id: string) =>
    `${DEVICES_BASE}/temperature/${id}/recipe/step/start`,
  state: (id: string) => `${DEVICES_BASE}/temperature/${id}/state`,
};
