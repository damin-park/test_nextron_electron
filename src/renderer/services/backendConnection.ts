/**
 * Preload(`window.nextron`)를 감싸는 backend 연결 서비스.
 * Renderer 컴포넌트는 이 모듈만 사용하고 window 객체에 직접 접근하지 않는다.
 * preload 가 없는 환경(일반 브라우저)에서도 crash 하지 않도록 방어한다.
 */
import type {
  BackendConnectionInfo,
  BackendRuntimeStatus,
  SystemEvent,
} from '../../shared/backend';

const UNKNOWN_CONNECTION: BackendConnectionInfo = {
  baseUrl: '',
  wsUrl: '',
  host: '',
  port: 0,
  status: 'unknown',
};

const hasBridge = (): boolean =>
  typeof window !== 'undefined' && typeof window.nextron !== 'undefined';

export async function getBackendConnection(): Promise<BackendConnectionInfo> {
  if (!hasBridge()) {
    return UNKNOWN_CONNECTION;
  }
  return window.nextron.getBackendConnection();
}

export async function getBackendStatus(): Promise<BackendRuntimeStatus> {
  if (!hasBridge()) {
    return 'unknown';
  }
  return window.nextron.getBackendStatus();
}

export function onSystemEvent(
  callback: (event: SystemEvent) => void,
): () => void {
  if (!hasBridge()) {
    return () => undefined;
  }
  return window.nextron.onSystemEvent(callback);
}

export async function requestAppShutdown(): Promise<void> {
  if (!hasBridge()) {
    return;
  }
  return window.nextron.requestAppShutdown();
}
