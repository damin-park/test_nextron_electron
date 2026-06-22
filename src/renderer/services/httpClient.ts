/**
 * Backend REST 호출 공통 헬퍼.
 * baseUrl 은 항상 preload(`getBackendConnection().baseUrl`)에서 얻는다.
 * URL 을 하드코딩하지 않는다.
 */
import { getBackendConnection } from './backendConnection';

export async function getBaseUrl(): Promise<string> {
  const connection = await getBackendConnection();
  return connection.baseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await getBaseUrl();
  if (!baseUrl) {
    throw new Error('Backend 연결 정보를 사용할 수 없습니다.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`요청 실패 (${response.status})`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
