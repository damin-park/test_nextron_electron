/**
 * Temperature 장비 연결 상태 / 액션 훅.
 *
 * 데이터 갱신 경로:
 *  - primary: WebSocket telemetry (useTemperatureTelemetry) — 실시간 값 갱신
 *  - 초기 표시: 마운트 시 REST /state 1회 조회
 *  - fallback: WebSocket 미연결 시에만 느린 REST /state 폴링
 *
 * REST 는 command(connect/disconnect/probe)와 초기/fallback 상태 조회에만 쓴다.
 * 2초 간격 반복 REST 폴링은 더 이상 사용하지 않는다.
 *
 * 장비 폴링(실제 FB100 read)은 backend 가 connect 시 자동 시작 / disconnect 시
 * 자동 정지한다 (Tkinter 동작 동일 — 사용자 polling start/stop 제어 없음).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemperatureDeviceConnectRequest, TemperatureDeviceState } from '../../services/deviceTypes';
import {
  connectTemperatureDevice,
  disconnectTemperatureDevice,
  getTemperatureState,
  probeTemperatureDevice,
} from '../../services/temperatureClient';
import { useTemperatureTelemetry } from '../telemetry/useTelemetry';

/** WebSocket 미연결 시에만 동작하는 fallback REST 폴링 간격 */
const FALLBACK_POLL_INTERVAL_MS = 10000;

export type ConnectionActionState = 'idle' | 'connecting' | 'disconnecting' | 'probing';

export interface UseTemperatureConnectionResult {
  /** 최신 장비 상태 (null = 아직 로딩 중이거나 조회 불가) */
  state: TemperatureDeviceState | null;
  /** 초기 로딩 여부 */
  loading: boolean;
  /** 진행 중인 액션 (connect/disconnect/probe) */
  actionState: ConnectionActionState;
  /** 마지막 에러 메시지 */
  error: string | null;
  /** 연결 */
  connect: (request?: TemperatureDeviceConnectRequest) => Promise<void>;
  /** 연결 해제 */
  disconnect: () => Promise<void>;
  /** 장비 탐색(Probe) */
  probe: () => Promise<void>;
  /** 상태 즉시 새로고침 (REST 1회) */
  refreshState: () => Promise<void>;
  /** 에러 초기화 */
  clearError: () => void;
}

export function useTemperatureConnection(
  deviceId: string,
): UseTemperatureConnectionResult {
  // REST 로 받은 초기/fallback snapshot
  const [restState, setRestState] = useState<TemperatureDeviceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ConnectionActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // primary: WebSocket telemetry
  const { state: telemetryState, connection } = useTemperatureTelemetry(deviceId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const resp = await getTemperatureState(deviceId);
      if (!mountedRef.current) return;
      if (resp.status === 'ok') {
        setRestState(resp.data as unknown as TemperatureDeviceState);
      }
    } catch {
      // backend 미준비 또는 네트워크 오류 - 조용히 무시
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [deviceId]);

  // 초기 1회 REST 조회 (WebSocket 연결 전 초기값 표시용)
  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  // telemetry 가 들어오면 더 이상 로딩 아님
  useEffect(() => {
    if (telemetryState && mountedRef.current) setLoading(false);
  }, [telemetryState]);

  // fallback: WebSocket 이 'open' 이 아닐 때만 느린 REST 폴링
  useEffect(() => {
    if (connection === 'open') return;
    const id = window.setInterval(
      () => void refreshState(),
      FALLBACK_POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [connection, refreshState]);

  const connect = useCallback(
    async (request?: TemperatureDeviceConnectRequest) => {
      setActionState('connecting');
      setError(null);
      try {
        const resp = await connectTemperatureDevice(deviceId, request);
        if (resp.status === 'error') {
          setError(resp.error ?? '연결 실패');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mountedRef.current) setActionState('idle');
        await refreshState();
      }
    },
    [deviceId, refreshState],
  );

  const disconnect = useCallback(async () => {
    setActionState('disconnecting');
    setError(null);
    try {
      const resp = await disconnectTemperatureDevice(deviceId);
      if (resp.status === 'error') {
        setError(resp.error ?? '연결 해제 실패');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setActionState('idle');
      await refreshState();
    }
  }, [deviceId, refreshState]);

  const probe = useCallback(async () => {
    setActionState('probing');
    setError(null);
    try {
      const resp = await probeTemperatureDevice(deviceId);
      if (resp.status === 'error') {
        setError(resp.error ?? '탐색 실패');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setActionState('idle');
      await refreshState();
    }
  }, [deviceId, refreshState]);

  const clearError = useCallback(() => setError(null), []);

  // telemetry(실시간) 우선, 없으면 REST snapshot(초기/fallback)
  const state = telemetryState ?? restState;

  return {
    state,
    loading,
    actionState,
    error,
    connect,
    disconnect,
    probe,
    refreshState,
    clearError,
  };
}
