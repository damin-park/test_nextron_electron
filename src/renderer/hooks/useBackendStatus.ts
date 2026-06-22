/**
 * backend 연결/상태를 구독하는 hook.
 *
 * 동작:
 *  1) mount 시 preload 로 backend connection 정보를 가져온다.
 *  2) baseUrl 로 FastAPI health(`/health/live`, `/health/ready`)를 주기적으로 조회한다.
 *  3) main → renderer system event 를 구독해 상태 변화를 즉시 반영한다.
 *
 * backend 가 꺼져 있거나 조회 실패해도 crash 하지 않고
 * status='not-ready'/'failed', health.live=false 로 표시한다.
 */
import { useEffect, useRef, useState } from 'react';
import type {
  BackendConnectionInfo,
  BackendHealthStatus,
  BackendRuntimeStatus,
  SystemEvent,
} from '../../shared/backend';
import { checkBackendHealth } from '../services/backendApiClient';
import {
  getBackendConnection,
  onSystemEvent,
} from '../services/backendConnection';

const HEALTH_POLL_INTERVAL_MS = 5000;

export interface BackendStatusState {
  connection: BackendConnectionInfo | null;
  status: BackendRuntimeStatus;
  health: BackendHealthStatus | null;
}

const SYSTEM_EVENT_STATUS: Record<SystemEvent['type'], BackendRuntimeStatus> = {
  'backend.starting': 'starting',
  'backend.ready': 'ready',
  'backend.not-ready': 'not-ready',
  'backend.failed': 'failed',
  'backend.stopped': 'stopped',
};

export function useBackendStatus(): BackendStatusState {
  const [connection, setConnection] = useState<BackendConnectionInfo | null>(
    null,
  );
  const [status, setStatus] = useState<BackendRuntimeStatus>('unknown');
  const [health, setHealth] = useState<BackendHealthStatus | null>(null);
  const baseUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    const runHealthCheck = async () => {
      const result = await checkBackendHealth(baseUrlRef.current);
      if (!cancelled) {
        setHealth(result);
      }
    };

    const init = async () => {
      const info = await getBackendConnection();
      if (cancelled) {
        return;
      }
      setConnection(info);
      setStatus(info.status);
      baseUrlRef.current = info.baseUrl;
      await runHealthCheck();
    };

    init();

    const intervalId = window.setInterval(runHealthCheck, HEALTH_POLL_INTERVAL_MS);

    const unsubscribe = onSystemEvent((event) => {
      if (cancelled) {
        return;
      }
      setStatus(SYSTEM_EVENT_STATUS[event.type]);
      // 상태가 바뀌면 연결 정보(포트 등)와 health 를 다시 조회한다.
      getBackendConnection().then((info) => {
        if (cancelled) {
          return;
        }
        setConnection(info);
        baseUrlRef.current = info.baseUrl;
        runHealthCheck();
      });
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  return { connection, status, health };
}
