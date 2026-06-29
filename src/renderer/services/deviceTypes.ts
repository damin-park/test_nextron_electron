/**
 * Init Connect / device registry 관련 renderer 측 타입.
 * backend pydantic 스키마와 형태를 맞춘다.
 */

export type DeviceType =
  | 'temperature'
  | 'mfc'
  | 'humidity'
  | 'pressure'
  | 'measurement'
  | 'vacuum'
  | 'chiller';

export interface ConnectionConfig {
  kind: 'serial' | 'visa';
  port: string;
  baudrate: number;
  bytesize: number;
  parity: string;
  stopbits: number;
  timeoutMs: number;
  writeTermination: string;
  readTermination: string;
}

export interface DeviceSummary {
  id: string;
  type: DeviceType;
  displayName: string;
  enabled: boolean;
}

export interface RegisteredDevicesSummary {
  hasRegisteredDevices: boolean;
  count: number;
  devices: DeviceSummary[];
}

export interface RegisterDeviceRequest {
  type: DeviceType;
  displayName?: string;
  enabled?: boolean;
  connection: ConnectionConfig;
  model?: string;
}

export interface RegisteredDevice {
  id: string;
  type: DeviceType;
  displayName: string;
  enabled: boolean;
  model?: string | null;
  connection: ConnectionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface SerialResource {
  kind: 'serial';
  port: string;
  description: string;
}

export interface VisaResource {
  kind: 'visa';
  resource: string;
  description: string;
}

export interface TemperatureReading {
  connected: boolean;
  currentTemperature: number | null;
  setpoint: number | null;
  unit: string;
  lastUpdated: string;
}

export const DEFAULT_SERIAL_CONNECTION: Omit<ConnectionConfig, 'port'> = {
  kind: 'serial',
  baudrate: 9600,
  bytesize: 8,
  parity: 'N',
  stopbits: 1,
  timeoutMs: 1000,
  writeTermination: '\r\n',
  readTermination: '\r\n',
};

/** Backend Actor 기반 커맨드 API 응답 */
export interface ApiCommandResponse {
  status: 'ok' | 'error' | 'accepted';
  commandId: string;
  deviceId: string | null;
  data: Record<string, unknown>;
  error: string | null;
}

/** Temperature 장비 상태 (/state 엔드포인트 응답의 data 필드) */
export interface TemperatureDeviceState {
  deviceId: string;
  deviceType?: string;
  model?: string;
  connected?: boolean;
  polling?: boolean;
  /** Dashboard primary 필드 (FB100 PV=M1 / SV=MS / Hot=O1% / Cool=O2%) */
  sv?: number | null;
  pv?: number | null;
  hotPower?: number | null;
  coolPower?: number | null;
  rampingRate?: number | null;
  rampingRateUnit?: string | null;
  temperatureRunMode?: boolean | null;
  runMode?: boolean | null;
  safeStopping?: boolean | null;
  safeStopTarget?: number | null;
  /** 구코드 호환 alias */
  currentTemperature?: number | null;
  targetSetpoint?: number | null;
  unit?: string | null;
  lastUpdated?: string | null;
  lastCommandId?: string | null;
  error?: string | null;
}

/** Temperature 장비 연결 요청 (커맨드 기반) */
export interface TemperatureDeviceConnectRequest {
  port?: string;
  baudrate?: number;
  timeoutSec?: number;
  model?: string;
}

/**
 * Telemetry WebSocket 메시지 (Backend → Frontend push).
 * Backend TelemetryBroadcaster 가 StateManager snapshot 을 device.telemetry
 * 형식으로 보낸다.
 */
export interface DeviceTelemetryMessage {
  type: 'device.telemetry';
  timestamp: string;
  devices: {
    temperature?: Record<string, TemperatureDeviceState>;
    [deviceType: string]: Record<string, unknown> | undefined;
  };
}
