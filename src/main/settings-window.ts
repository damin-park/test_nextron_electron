/**
 * Settings 윈도우 (tkinter settings.py 의 Toplevel 팝업 재현).
 *
 * 사이드 메뉴의 Settings 버튼 클릭 시 표시되는 설정 팝업.
 * 메인 렌더러 번들을 재사용하되 hash(`#/settings`)로 Settings UI 를 렌더링한다.
 */
import { BrowserWindow } from 'electron';
import path from 'node:path';

let settingsWindow: BrowserWindow | undefined;

const SETTINGS_HASH = 'settings';

export const createSettingsWindow = (
  parent?: BrowserWindow,
): BrowserWindow => {
  // 이미 열려 있으면 포커스만 준다.
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 720,
    height: 600,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    modal: Boolean(parent),
    parent,
    backgroundColor: '#121212',
    title: 'Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      settingsWindow?.close();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void settingsWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${SETTINGS_HASH}`,
    );
  } else {
    void settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: `/${SETTINGS_HASH}` },
    );
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = undefined;
  });

  return settingsWindow;
};

export const closeSettingsWindow = (): void => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  settingsWindow = undefined;
};

export const getSettingsWindow = (): BrowserWindow | undefined =>
  settingsWindow;
