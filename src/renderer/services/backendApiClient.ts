/**
 * FastAPI health endpoint 호출 client.
 * baseUrl 은 preload 가 제공한 backend connection 정보에서 받는다(하드코딩 금지).
 * 네트워크 실패 시 throw 하지 않고 live/ready=false 로 반환한다.
 */
import type { BackendHealthStatus } from '../../shared/backend';

const REQUEST_TIMEOUT_MS = 2000;

async function fetchOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `/health/live` 와 `/health/ready` 를 조회한다.
 * live 가 false 면 ready 조회는 생략한다.
 */
export async function checkBackendHealth(
  baseUrl: string,
): Promise<BackendHealthStatus> {
  const checkedAt = new Date().toISOString();

  if (!baseUrl) {
    return {
      live: false,
      ready: false,
      message: 'No backend connection',
      checkedAt,
    };
  }

  const live = await fetchOk(`${baseUrl}/health/live`);
  const ready = live ? await fetchOk(`${baseUrl}/health/ready`) : false;

  let message: string | undefined;
  if (!live) {
    message = 'Backend not reachable';
  } else if (!ready) {
    message = 'Backend not ready';
  }

  return { live, ready, message, checkedAt };
}
