/**
 * Temperature controller REST 클라이언트.
 *
 * - probe/read (init-connect 용, 레거시): device_id 없는 구버전 엔드포인트
 * - connect/disconnect/state 등 (커맨드 기반): device_id 포함 신규 엔드포인트
 */
import { apiGet, apiPost } from './httpClient';
import type {
  ApiCommandResponse,
  ConnectionConfig,
  TemperatureDeviceConnectRequest,
  TemperatureReading,
} from './deviceTypes';
import { tempPath } from './apiPaths';

// ── Init-Connect 레거시 API (InitConnectApp 전용) ──────────────────────────

export interface TemperatureProbeRequest {
  connection: ConnectionConfig;
  model?: string;
}

export async function probeTemperature(
  request: TemperatureProbeRequest,
): Promise<boolean> {
  const result = await apiPost<{ ok: boolean }>(
    '/api/devices/temperature/probe',
    request,
  );
  return result.ok;
}

export function readTemperature(): Promise<TemperatureReading> {
  return apiGet<TemperatureReading>('/api/devices/temperature/read');
}

// ── 커맨드 기반 API (등록된 장비 관리용) ─────────────────────────────────

/** 장비 현재 상태 조회 */
export function getTemperatureState(deviceId: string): Promise<ApiCommandResponse> {
  return apiGet<ApiCommandResponse>(tempPath.state(deviceId));
}

/** 장비 연결 */
export function connectTemperatureDevice(
  deviceId: string,
  body?: TemperatureDeviceConnectRequest,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.connect(deviceId), body ?? {});
}

/** 장비 연결 해제 */
export function disconnectTemperatureDevice(
  deviceId: string,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.disconnect(deviceId));
}

/** 장비 연결 탐색(Probe) */
export function probeTemperatureDevice(
  deviceId: string,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.probe(deviceId));
}

/**
 * 폴링 시작 (내부용).
 * 폴링은 connect 시 backend가 자동 시작하므로 UI에서 직접 호출하지 않는다.
 * 진단/유지보수 목적의 내부 API로만 유지한다.
 */
export function startTemperaturePolling(
  deviceId: string,
  intervalSec?: number,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.pollingStart(deviceId), {
    intervalSec: intervalSec ?? 1.0,
  });
}

/**
 * 폴링 중지 (내부용).
 * 폴링은 disconnect 시 backend가 자동 중지하므로 UI에서 직접 호출하지 않는다.
 */
export function stopTemperaturePolling(
  deviceId: string,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.pollingStop(deviceId));
}
