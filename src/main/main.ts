import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  checkBackendHealth,
  getBackendInfo,
  startPythonBackend,
  stopPythonBackend,
} from './python-backend';

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
};

ipcMain.handle('backend:get-info', () => getBackendInfo());
ipcMain.handle('backend:health', () => checkBackendHealth());

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await startPythonBackend();
  createWindow();
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
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
