import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import type {
  BackendConnectionInfo,
  BackendInfo,
  BackendRuntimeStatus,
  SystemEvent,
} from '../shared/backend';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8765;
const DEFAULT_CONDA_ENV = 'nextron-electron-backend';
const BACKEND_READY_TIMEOUT_MS = 15000;
const BACKEND_HEALTH_INTERVAL_MS = 250;

let backendProcess: ChildProcessWithoutNullStreams | undefined;
let activeBackendPort: number | undefined;
let usingExternalBackend = false;
let backendStatus: BackendRuntimeStatus = 'unknown';
let systemEventListener: ((event: SystemEvent) => void) | undefined;

/** backend 상태가 바뀔 때 호출될 listener 를 등록한다(main → renderer 브로드캐스트용). */
export const setSystemEventListener = (
  listener: ((event: SystemEvent) => void) | undefined,
) => {
  systemEventListener = listener;
};

const STATUS_EVENT: Record<BackendRuntimeStatus, SystemEvent | undefined> = {
  starting: { type: 'backend.starting' },
  ready: { type: 'backend.ready' },
  'not-ready': { type: 'backend.not-ready' },
  failed: { type: 'backend.failed' },
  stopped: { type: 'backend.stopped' },
  unknown: undefined,
};

const setBackendStatus = (status: BackendRuntimeStatus, message?: string) => {
  if (backendStatus === status) {
    return;
  }

  backendStatus = status;

  const event = STATUS_EVENT[status];
  if (!event || !systemEventListener) {
    return;
  }

  if (event.type === 'backend.failed') {
    systemEventListener({ type: 'backend.failed', message });
    return;
  }

  systemEventListener(event);
};

export const getBackendStatus = (): BackendRuntimeStatus => backendStatus;

const getBackendHost = () => process.env.NEXTRON_BACKEND_HOST || DEFAULT_HOST;

const getBackendPort = () => {
  const configuredPort = Number(process.env.NEXTRON_BACKEND_PORT);
  return Number.isInteger(configuredPort) && configuredPort > 0
    ? configuredPort
    : DEFAULT_PORT;
};

const getBackendUrl = (host: string, port: number) => `http://${host}:${port}`;

const getBackendDirectory = () => {
  if (app.isPackaged) {
    return process.resourcesPath;
  }

  return app.getAppPath();
};

const getPythonCommand = (): { command: string; args: string[] } => {
  if (process.env.NEXTRON_PYTHON) {
    return {
      command: process.env.NEXTRON_PYTHON,
      args: [],
    };
  }

  const condaCommand = process.env.NEXTRON_CONDA_EXE || 'conda';
  const condaEnv = process.env.NEXTRON_CONDA_ENV || DEFAULT_CONDA_ENV;

  return {
    command: condaCommand,
    args: ['run', '--no-capture-output', '-n', condaEnv, 'python'],
  };
};

export const getBackendInfo = (): BackendInfo => {
  const host = getBackendHost();
  const port = activeBackendPort || getBackendPort();

  return {
    host,
    port,
    url: getBackendUrl(host, port),
    pid: backendProcess?.pid,
    running: usingExternalBackend || Boolean(backendProcess && !backendProcess.killed),
  };
};

/**
 * Renderer 가 URL 을 하드코딩하지 않도록 backend 접속 정보를 반환한다.
 * 포트는 dynamic port 로 확장 가능하도록 activeBackendPort 기준으로 계산한다.
 */
export const getBackendConnection = (): BackendConnectionInfo => {
  const host = getBackendHost();
  const port = activeBackendPort || getBackendPort();

  return {
    baseUrl: getBackendUrl(host, port),
    wsUrl: `ws://${host}:${port}`,
    host,
    port,
    status: backendStatus,
  };
};

const checkHealthAt = (url: string) => new Promise<boolean>((resolve) => {
  const request = http.get(`${url}/health`, (response) => {
    response.resume();
    resolve(response.statusCode === 200);
  });

  request.on('error', () => {
    resolve(false);
  });

  request.setTimeout(1000, () => {
    request.destroy();
    resolve(false);
  });
});

const sleep = (milliseconds: number) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const waitForBackendReady = async (url: string, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await checkHealthAt(url)) {
      return true;
    }

    await sleep(BACKEND_HEALTH_INTERVAL_MS);
  }

  return false;
};

const canBindPort = (host: string, port: number) => new Promise<boolean>((resolve) => {
  const server = net.createServer();

  server.once('error', () => {
    resolve(false);
  });

  server.once('listening', () => {
    server.close(() => {
      resolve(true);
    });
  });

  server.listen(port, host);
});

const findAvailableBackendPort = async (host: string, preferredPort: number) => {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await canBindPort(host, port)) {
      return port;
    }
  }

  throw new Error(`No available backend port found from ${preferredPort} to ${preferredPort + 19}`);
};

export const startPythonBackend = async () => {
  if (backendProcess && !backendProcess.killed) {
    return getBackendInfo();
  }

  setBackendStatus('starting');

  const host = getBackendHost();
  const preferredPort = getBackendPort();
  const preferredUrl = getBackendUrl(host, preferredPort);

  if (await checkHealthAt(preferredUrl)) {
    activeBackendPort = preferredPort;
    usingExternalBackend = true;
    setBackendStatus('ready');
    return getBackendInfo();
  }

  const port = await findAvailableBackendPort(host, preferredPort);
  const backendDirectory = getBackendDirectory();
  const { command, args } = getPythonCommand();

  activeBackendPort = port;
  usingExternalBackend = false;

  backendProcess = spawn(
    command,
    [
      ...args,
      '-m',
      'uvicorn',
      'backend.backend_main:app',
      '--host',
      host,
      '--port',
      String(port),
    ],
    {
      cwd: backendDirectory,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        // Backend 가 등록 장비 설정 파일을 저장할 위치(개발 PC 경로 하드코딩 방지).
        NEXTRON_DATA_DIR: process.env.NEXTRON_DATA_DIR || app.getPath('userData'),
        // Electron main PID — backend watchdog 이 이 프로세스 종료 시 스스로 종료한다.
        NEXTRON_PARENT_PID: String(process.pid),
      },
      windowsHide: true,
    },
  );

  backendProcess.stdout.on('data', (chunk: Buffer) => {
    console.log(`[python] ${chunk.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (chunk: Buffer) => {
    console.error(`[python] ${chunk.toString().trim()}`);
  });

  backendProcess.on('error', (error) => {
    console.error('Failed to start Python backend:', error);
    activeBackendPort = undefined;
    setBackendStatus('failed', error.message);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Python backend exited: code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    backendProcess = undefined;
    activeBackendPort = undefined;
    setBackendStatus('stopped');
  });

  const isReady = await waitForBackendReady(getBackendUrl(host, port), BACKEND_READY_TIMEOUT_MS);

  if (!isReady) {
    console.error(`Python backend did not become ready within ${BACKEND_READY_TIMEOUT_MS}ms`);
    setBackendStatus('not-ready');
  } else {
    setBackendStatus('ready');
  }

  return getBackendInfo();
};

export const stopPythonBackend = () => {
  if (usingExternalBackend) {
    usingExternalBackend = false;
    activeBackendPort = undefined;
    setBackendStatus('stopped');
    return;
  }

  if (!backendProcess || backendProcess.killed) {
    return;
  }

  if (process.platform === 'win32' && backendProcess.pid) {
    spawn('taskkill', ['/pid', String(backendProcess.pid), '/t', '/f'], {
      windowsHide: true,
    });
    return;
  }

  backendProcess.kill();
};

export const checkBackendHealth = () => {
  const { url } = getBackendInfo();
  return checkHealthAt(url);
};

const httpGetJson = <T>(url: string): Promise<T | undefined> =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        resolve(undefined);
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
        } catch {
          resolve(undefined);
        }
      });
    });

    request.on('error', () => resolve(undefined));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(undefined);
    });
  });

interface RegisteredDevicesSummary {
  hasRegisteredDevices: boolean;
  count: number;
  devices: Array<{ id: string; type: string; displayName: string; enabled: boolean }>;
}

/**
 * 등록된 장비 요약을 backend 에서 조회한다(시작 흐름 분기용).
 * 실패 시 안전하게 "등록 장비 없음"으로 간주한다.
 */
export const getRegisteredDevicesSummary =
  async (): Promise<RegisteredDevicesSummary> => {
    const { url } = getBackendInfo();
    const summary = await httpGetJson<RegisteredDevicesSummary>(
      `${url}/api/devices/registered/summary`,
    );

    return summary ?? { hasRegisteredDevices: false, count: 0, devices: [] };
  };
