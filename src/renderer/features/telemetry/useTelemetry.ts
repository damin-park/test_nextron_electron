/**
 * Telemetry WebSocket 구독 훅.
 *
 * 지정한 temperature 장비의 최신 telemetry 상태와 WebSocket 연결 상태를 반환한다.
 * Dashboard 실시간 값 갱신의 primary 경로다(REST /state 반복 폴링 대체).
 */
import { useEffect, useState } from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import {
  telemetryClient,
  type TelemetryConnectionState,
} from '../../services/telemetryWebSocketClient';

export interface UseTemperatureTelemetryResult {
  /** WebSocket 으로 받은 최신 장비 상태 (없으면 null) */
  state: TemperatureDeviceState | null;
  /** WebSocket 연결 상태 */
  connection: TelemetryConnectionState;
}

export function useTemperatureTelemetry(
  deviceId: string,
): UseTemperatureTelemetryResult {
  const [state, setState] = useState<TemperatureDeviceState | null>(() =>
    telemetryClient.getTemperatureState(deviceId),
  );
  const [connection, setConnection] = useState<TelemetryConnectionState>(() =>
    telemetryClient.getConnectionState(),
  );

  useEffect(() => {
    // 구독 시점의 최신 캐시 반영
    setState(telemetryClient.getTemperatureState(deviceId));

    const unsubSnapshot = telemetryClient.subscribeSnapshot((message) => {
      const entry = message.devices?.temperature?.[deviceId];
      if (entry) {
        setState(entry as TemperatureDeviceState);
      }
    });

    const unsubConnection = telemetryClient.subscribeConnection((s) => {
      setConnection(s);
    });

    return () => {
      unsubSnapshot();
      unsubConnection();
    };
  }, [deviceId]);

  return { state, connection };
}
