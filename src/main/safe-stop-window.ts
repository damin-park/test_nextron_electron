import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import type { BackendShutdownStatus } from './python-backend';

type SafeStopResult = 'completed' | 'forced';

interface SafeStopIpcHandlers {
  getStatus: () => Promise<BackendShutdownStatus>;
  forceStop: () => Promise<BackendShutdownStatus>;
}

let handlersRegistered = false;
let ipcHandlers: SafeStopIpcHandlers | undefined;
let activeWindow: BrowserWindow | undefined;
let activeResolve: ((result: SafeStopResult) => void) | undefined;

export const registerSafeStopIpc = (handlers: SafeStopIpcHandlers): void => {
  ipcHandlers = handlers;
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('safe-stop:get-status', async () => {
    return ipcHandlers?.getStatus();
  });

  ipcMain.handle('safe-stop:force-quit', async () => {
    const status = await ipcHandlers?.forceStop();
    activeResolve?.('forced');
    closeSafeStopWindow();
    return status;
  });

  ipcMain.handle('safe-stop:complete', () => {
    activeResolve?.('completed');
    closeSafeStopWindow();
  });
};

export const showSafeStopWindow = (
  parent: BrowserWindow | undefined,
  initialStatus: BackendShutdownStatus,
): Promise<SafeStopResult> => {
  if (activeWindow && !activeWindow.isDestroyed()) {
    activeWindow.focus();
    return new Promise((resolve) => {
      activeResolve = resolve;
    });
  }

  activeWindow = new BrowserWindow({
    width: 520,
    height: 380,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    modal: parent != null,
    parent,
    title: 'Safe Stop',
    backgroundColor: '#161616',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  activeWindow.setMenuBarVisibility(false);
  activeWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(renderSafeStopHtml(initialStatus))}`,
  );
  activeWindow.once('closed', () => {
    activeWindow = undefined;
  });

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
};

const closeSafeStopWindow = (): void => {
  const win = activeWindow;
  activeResolve = undefined;
  activeWindow = undefined;
  if (win && !win.isDestroyed()) {
    win.setClosable(true);
    win.close();
  }
};

const renderSafeStopHtml = (initialStatus: BackendShutdownStatus): string => {
  const serialized = JSON.stringify(initialStatus).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Safe Stop</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #161616;
      color: #f2f4f8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      background: #161616;
      overflow: hidden;
    }
    .safe-stop {
      height: 100%;
      display: flex;
      flex-direction: column;
      border: 1px solid #454545;
      background: #171717;
    }
    .header {
      padding: 18px 22px 14px;
      border-bottom: 1px solid #333;
      background: #202020;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 17px;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: #f5c542;
      box-shadow: 0 0 0 5px rgba(245, 197, 66, 0.12);
    }
    .subtitle {
      margin-top: 8px;
      color: #c7c7c7;
      font-size: 12px;
      line-height: 1.45;
    }
    .content {
      flex: 1;
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .target {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      border: 1px solid #3b3b3b;
      background: #1e1e1e;
      border-radius: 6px;
    }
    .target span:first-child {
      color: #b5b5b5;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .target span:last-child {
      font-size: 24px;
      font-weight: 800;
      color: #ffdf70;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .metric {
      border: 1px solid #363636;
      background: #141414;
      border-radius: 6px;
      padding: 12px 14px;
      min-height: 72px;
    }
    .metric-label {
      color: #9a9a9a;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .metric-value {
      font-size: 22px;
      font-weight: 800;
      color: #f6f7f9;
      white-space: nowrap;
    }
    .progress {
      height: 4px;
      width: 100%;
      background: #2c2c2c;
      overflow: hidden;
      border-radius: 999px;
    }
    .progress::before {
      content: "";
      display: block;
      width: 42%;
      height: 100%;
      background: #e6231c;
      animation: slide 1.2s infinite ease-in-out;
      border-radius: inherit;
    }
    @keyframes slide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(260%); }
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 22px 18px;
      border-top: 1px solid #333;
      background: #202020;
    }
    .waiting {
      color: #bdbdbd;
      font-size: 12px;
    }
    button {
      border: 1px solid #6c3030;
      background: #401414;
      color: #ffb8b8;
      border-radius: 5px;
      padding: 9px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: #551d1d; }
    button:disabled {
      opacity: 0.55;
      cursor: default;
    }
  </style>
</head>
<body>
  <div class="safe-stop">
    <div class="header">
      <div class="title-row"><span class="status-dot"></span><span>Temperature Safe Stop</span></div>
      <div class="subtitle">The program is waiting for the temperature controller to reach a safe stop condition before shutdown.</div>
    </div>
    <div class="content">
      <div class="target"><span>Target</span><span id="target">--</span></div>
      <div class="grid">
        <div class="metric"><div class="metric-label">PV</div><div class="metric-value" id="pv">--</div></div>
        <div class="metric"><div class="metric-label">Hot Power</div><div class="metric-value" id="hot">--</div></div>
        <div class="metric"><div class="metric-label">Cool Power</div><div class="metric-value" id="cool">--</div></div>
      </div>
      <div class="progress"></div>
    </div>
    <div class="footer">
      <div class="waiting" id="message">Safe stop in progress...</div>
      <button type="button" id="force">Force Quit</button>
    </div>
  </div>
  <script>
    const initialStatus = ${serialized};
    const format = (value, unit = '') => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
      return Number(value).toFixed(1) + unit;
    };
    const tempInfo = (status) => (status.safeStopInfo && status.safeStopInfo.TEMPERATURE) || {};
    const update = (status) => {
      const info = tempInfo(status);
      const unit = info.unit || 'C';
      document.getElementById('target').textContent = format(info.target, ' ' + unit);
      document.getElementById('pv').textContent = format(info.pv, ' ' + unit);
      document.getElementById('hot').textContent = format(info.hotPower, ' %');
      document.getElementById('cool').textContent = format(info.coolPower, ' %');
    };
    const poll = async () => {
      const status = await window.nextron.getSafeStopStatus();
      update(status);
      if (!status.safeStopRequired) {
        document.getElementById('message').textContent = 'Safe stop completed.';
        await window.nextron.completeSafeStopShutdown();
        return;
      }
      setTimeout(poll, 1000);
    };
    document.getElementById('force').addEventListener('click', async () => {
      const button = document.getElementById('force');
      button.disabled = true;
      document.getElementById('message').textContent = 'Forcing stop...';
      await window.nextron.forceSafeStopShutdown();
    });
    update(initialStatus);
    setTimeout(poll, 500);
  </script>
</body>
</html>`;
};
