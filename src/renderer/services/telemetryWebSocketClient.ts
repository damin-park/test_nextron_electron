/**
 * Telemetry WebSocket 클라이언트 (singleton).
 *
 * Backend 의 `/ws/telemetry` 에 연결하여 device.telemetry snapshot 을 수신한다.
 * Dashboard 등 여러 컴포넌트가 같은 연결을 공유하도록 모듈 단위 singleton 으로 둔다.
 *
 * 기능:
 *  - Backend ready(wsUrl 확보) 시 연결
 *  - 메시지 수신 → 최신 snapshot 보관 + 구독자 통지
 *  - 연결 끊김 시 지수 backoff 재연결
 *  - malformed 메시지 방어
 *
 * REST 폴링과 달리 이 경로가 Dashboard 실시간 값 갱신의 primary 경로다.
 */
import type {
  DeviceTelemetryMessage,
  TemperatureDeviceState,
} from './deviceTypes';
import { getBackendConnection } from './backendConnection';

/** Backend telemetry_router.TELEMETRY_WS_PATH 와 동일해야 한다. */
const TELEMETRY_WS_PATH = '/ws/telemetry';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;

export type TelemetryConnectionState = 'connecting' | 'open' | 'closed';

type SnapshotListener = (message: DeviceTelemetryMessage) => void;
type ConnectionListener = (state: TelemetryConnectionState) => void;

class TelemetryClient {
  private socket: WebSocket | null = null;
  private connectionState: TelemetryConnectionState = 'closed';
  private latest: DeviceTelemetryMessage | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private starting = false;
  private disposed = false;

  private snapshotListeners = new Set<SnapshotListener>();
  private connectionListeners = new Set<ConnectionListener>();

  /** 첫 구독 시 연결을 보장한다. */
  ensureStarted(): void {
    this.disposed = false;
    if (this.socket || this.starting) return;
    void this.openSocket();
  }

  getConnectionState(): TelemetryConnectionState {
    return this.connectionState;
  }

  getLatest(): DeviceTelemetryMessage | null {
    return this.latest;
  }

  /** 최신 temperature 장비 상태 조회 (없으면 null). */
  getTemperatureState(deviceId: string): TemperatureDeviceState | null {
    const entry = this.latest?.devices?.temperature?.[deviceId];
    return entry ? (entry as TemperatureDeviceState) : null;
  }

  subscribeSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    this.ensureStarted();
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    this.ensureStarted();
    // 현재 상태 즉시 통지
    listener(this.connectionState);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private setConnectionState(state: TelemetryConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.connectionListeners.forEach((l) => l(state));
  }

  private async openSocket(): Promise<void> {
    if (this.disposed) return;
    this.starting = true;
    this.setConnectionState('connecting');

    let wsUrl = '';
    try {
      const connection = await getBackendConnection();
      wsUrl = connection.wsUrl;
    } catch {
      wsUrl = '';
    }

    if (!wsUrl) {
      // Backend 정보 미확보 — 잠시 후 재시도
      this.starting = false;
      this.scheduleReconnect();
      return;
    }

    try {
      const socket = new WebSocket(`${wsUrl}${TELEMETRY_WS_PATH}`);
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.starting = false;
        this.setConnectionState('open');
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        // onclose 가 이어서 호출되므로 여기서는 상태 전환만 보조
      };

      socket.onclose = () => {
        this.socket = null;
        this.starting = false;
        this.setConnectionState('closed');
        if (!this.disposed) this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.starting = false;
      this.setConnectionState('closed');
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // malformed 방어
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { type?: unknown }).type !== 'device.telemetry'
    ) {
      return;
    }
    const message = parsed as DeviceTelemetryMessage;
    if (!message.devices || typeof message.devices !== 'object') return;
    this.latest = message;
    this.snapshotListeners.forEach((l) => l(message));
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }
}

/** 모듈 단위 singleton — 모든 구독자가 하나의 WebSocket 연결을 공유한다. */
export const telemetryClient = new TelemetryClient();
