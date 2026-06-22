import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8765;
const DEFAULT_CONDA_ENV = 'nextron-electron-backend';
const BACKEND_READY_TIMEOUT_MS = 15000;
const BACKEND_HEALTH_INTERVAL_MS = 250;

let backendProcess: ChildProcessWithoutNullStreams | undefined;
let activeBackendPort: number | undefined;
let usingExternalBackend = false;

export type BackendInfo = {
  host: string;
  port: number;
  url: string;
  pid?: number;
  running: boolean;
};

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
    return path.join(process.resourcesPath, 'backend');
  }

  return path.join(app.getAppPath(), 'backend');
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

  const host = getBackendHost();
  const preferredPort = getBackendPort();
  const preferredUrl = getBackendUrl(host, preferredPort);

  if (await checkHealthAt(preferredUrl)) {
    activeBackendPort = preferredPort;
    usingExternalBackend = true;
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
      'app.main:app',
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
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Python backend exited: code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    backendProcess = undefined;
    activeBackendPort = undefined;
  });

  const isReady = await waitForBackendReady(getBackendUrl(host, port), BACKEND_READY_TIMEOUT_MS);

  if (!isReady) {
    console.error(`Python backend did not become ready within ${BACKEND_READY_TIMEOUT_MS}ms`);
  }

  return getBackendInfo();
};

export const stopPythonBackend = () => {
  if (usingExternalBackend) {
    usingExternalBackend = false;
    activeBackendPort = undefined;
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
