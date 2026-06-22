import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  checkBackendHealth,
  getBackendConnection,
  getBackendInfo,
  getBackendStatus,
  getRegisteredDevicesSummary,
  setSystemEventListener,
  startPythonBackend,
  stopPythonBackend,
} from './python-backend';
import {
  closeSplashWindow,
  createSplashWindow,
  setSplashStatus,
} from './splash-window';
import {
  closeInitConnectWindow,
  createInitConnectWindow,
} from './init-connect-window';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow: BrowserWindow | undefined;

if (!gotSingleInstanceLock) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    useContentSize: true,
    minWidth: 1366,
    minHeight: 768,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#121212',
    title: 'Nextron Integrated Program',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // tkinter UI와 동일하게 앱 내부 메뉴바만 사용한다.
  mainWindow.setMenuBarVisibility(false);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  return mainWindow;
};

ipcMain.handle('backend:get-info', () => getBackendInfo());
ipcMain.handle('backend:health', () => checkBackendHealth());
ipcMain.handle('backend:get-connection', () => getBackendConnection());
ipcMain.handle('backend:get-status', () => getBackendStatus());
ipcMain.handle('app:request-shutdown', () => {
  app.quit();
});

const SPLASH_MIN_MS = 1500;

/**
 * 메인 윈도우를 생성하고, 콘텐츠 로드 완료 후 표시한다.
 * splashShownAt 이 주어지면 스플래시가 최소 시간 보이도록 보장한 뒤 닫는다.
 */
const showMainWindow = (splashShownAt?: number) => {
  const window = createWindow();
  window.once('ready-to-show', () => {
    const elapsed = splashShownAt ? Date.now() - splashShownAt : SPLASH_MIN_MS;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(() => {
      closeSplashWindow();
      window.show();
      window.focus();
    }, remaining);
  });
};

// Init Connect 완료: 팝업을 닫고 메인 윈도우를 표시한다.
ipcMain.handle('init-connect:complete', () => {
  closeInitConnectWindow();
  showMainWindow();
});

// Init Connect 취소/닫기: 등록 완료 전 Main GUI 를 띄우지 않고 앱을 종료한다.
// (tkinter 는 스킵 후 Main 진입이 가능했으나, 안전 규칙에 따라 종료로 처리 — 문서화된 차이)
ipcMain.handle('init-connect:cancel', () => {
  closeInitConnectWindow();
  app.quit();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // backend 상태 변경을 renderer 로 전달한다(아직 메인 윈도가 없으면 무시).
  setSystemEventListener((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:event', event);
    }
  });

  // 1. 스플래시 먼저 표시
  const splashShownAt = Date.now();
  createSplashWindow();

  // 2. 백엔드 로딩 (스플래시에 상태 표시)
  setSplashStatus('Starting backend...');
  await startPythonBackend();

  // 3. 등록된 장비 확인 → 흐름 분기
  setSplashStatus('Checking registered devices...');
  const summary = await getRegisteredDevicesSummary();

  if (summary.hasRegisteredDevices) {
    // 등록 장비 있음 → 바로 Main Window
    setSplashStatus('Loading Main Screen...');
    showMainWindow(splashShownAt);
    return;
  }

  // 등록 장비 없음 → 스플래시를 닫고 Init Connect 팝업 표시
  setSplashStatus('No registered devices. Opening device setup...');
  const elapsed = Date.now() - splashShownAt;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    closeSplashWindow();
    createInitConnectWindow();
  }, remaining);
});

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopPythonBackend();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const window = createWindow();
    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
