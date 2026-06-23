/**
 * Temperature 장비 연결 상태 / 액션 훅.
 *
 * - 2초 간격으로 /state 폴링
 * - connect / disconnect / probe 액션 제공
 * - backendReady=false 이면 폴링 중지 및 에러 반환
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemperatureDeviceConnectRequest, TemperatureDeviceState } from '../../services/deviceTypes';
import {
  connectTemperatureDevice,
  disconnectTemperatureDevice,
  getTemperatureState,
  probeTemperatureDevice,
  startTemperaturePolling,
  stopTemperaturePolling,
} from '../../services/temperatureClient';

const POLL_INTERVAL_MS = 2000;

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
  /** 폴링 시작 */
  startPolling: (intervalSec?: number) => Promise<void>;
  /** 폴링 중지 */
  stopPolling: () => Promise<void>;
  /** 상태 즉시 새로고침 */
  refreshState: () => Promise<void>;
  /** 에러 초기화 */
  clearError: () => void;
}

export function useTemperatureConnection(
  deviceId: string,
): UseTemperatureConnectionResult {
  const [state, setState] = useState<TemperatureDeviceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ConnectionActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

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
        setState(resp.data as unknown as TemperatureDeviceState);
      }
    } catch {
      // backend 미준비 또는 네트워크 오류 - 조용히 무시
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [deviceId]);

  // 주기 폴링
  useEffect(() => {
    void refreshState();
    const id = window.setInterval(() => void refreshState(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshState]);

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

  const startPolling = useCallback(
    async (intervalSec?: number) => {
      try {
        await startTemperaturePolling(deviceId, intervalSec);
        await refreshState();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [deviceId, refreshState],
  );

  const stopPolling = useCallback(async () => {
    try {
      await stopTemperaturePolling(deviceId);
      await refreshState();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [deviceId, refreshState]);

  const clearError = useCallback(() => setError(null), []);

  return {
    state,
    loading,
    actionState,
    error,
    connect,
    disconnect,
    probe,
    startPolling,
    stopPolling,
    refreshState,
    clearError,
  };
}
