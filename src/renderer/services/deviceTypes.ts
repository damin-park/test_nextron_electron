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
