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

export function writeTemperatureSetpoint(
  deviceId: string,
  value: number,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.setpoint(deviceId), { value });
}

export function writeTemperatureRampingRate(
  deviceId: string,
  value: number,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.rampingRate(deviceId), { value });
}

export function setTemperatureRunMode(
  deviceId: string,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.run(deviceId));
}

export function setTemperatureStopMode(
  deviceId: string,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.stop(deviceId));
}

export interface TemperatureManualStartRequest {
  setValue: number;
  rampingRate: number;
}

export interface TemperatureCommandStepResult {
  action: string;
  ok: boolean;
  error?: string | null;
}

export interface TemperatureManualStartResponseData {
  action: string;
  steps: TemperatureCommandStepResult[];
  failedStep?: string | null;
  state?: Record<string, unknown> | null;
}

export function manualStartTemperature(
  deviceId: string,
  body: TemperatureManualStartRequest,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(tempPath.manualStart(deviceId), body);
}

export interface TemperatureRecipeStepStartRequest {
  recipeRunId?: string | null;
  cycleIndex: number;
  stepIndex: number;
  setValue: number;
  rampingRate: number;
}

export interface TemperatureRecipeStepStartResponseData {
  action: string;
  recipeRunId?: string | null;
  cycleIndex: number;
  stepIndex: number;
  steps: TemperatureCommandStepResult[];
  failedStep?: string | null;
  state?: Record<string, unknown> | null;
}

/**
 * Recipe step composite command.
 * Backend Actor가 write_setpoint → write_ramping_rate → set_run_mode를
 * 순차 실행한다. Frontend는 개별 endpoint를 조합하지 않는다.
 */
export function startTemperatureRecipeStep(
  deviceId: string,
  payload: TemperatureRecipeStepStartRequest,
): Promise<ApiCommandResponse> {
  return apiPost<ApiCommandResponse>(
    tempPath.recipeStepStart(deviceId),
    payload,
  );
}
