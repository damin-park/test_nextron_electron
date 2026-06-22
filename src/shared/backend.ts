export type BackendRuntimeStatus =
  | 'starting'
  | 'ready'
  | 'not-ready'
  | 'failed'
  | 'stopped'
  | 'unknown';

export type BackendInfo = {
  host: string;
  port: number;
  url: string;
  pid?: number;
  running: boolean;
};

export type BackendConnectionInfo = {
  baseUrl: string;
  wsUrl: string;
  host: string;
  port: number;
  status: BackendRuntimeStatus;
};

export type BackendHealthStatus = {
  live: boolean;
  ready: boolean;
  message?: string;
  checkedAt: string;
};

export type SystemEvent =
  | { type: 'backend.starting' }
  | { type: 'backend.ready' }
  | { type: 'backend.not-ready' }
  | { type: 'backend.failed'; message?: string }
  | { type: 'backend.stopped' };
