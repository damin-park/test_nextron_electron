/**
 * Init Connect 윈도우 (tkinter init_connect_window.py 재현).
 *
 * 등록된 장비가 없을 때 표시되는 장비 등록 팝업.
 * 메인 렌더러 번들을 재사용하되 hash(`#/init-connect`)로 Init Connect UI 를 렌더링한다.
 * 등록이 완료(또는 취소)될 때까지 Main Window 는 생성/표시하지 않는다.
 */
import { BrowserWindow } from 'electron';
import path from 'node:path';

let initConnectWindow: BrowserWindow | undefined;

const INIT_CONNECT_HASH = 'init-connect';

export const createInitConnectWindow = (): BrowserWindow => {
  initConnectWindow = new BrowserWindow({
    width: 550,
    height: 594,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#121212',
    title: 'Add Device',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  initConnectWindow.setMenuBarVisibility(false);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void initConnectWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${INIT_CONNECT_HASH}`,
    );
  } else {
    void initConnectWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: `/${INIT_CONNECT_HASH}` },
    );
  }

  initConnectWindow.once('ready-to-show', () => {
    initConnectWindow?.show();
    initConnectWindow?.focus();
  });

  initConnectWindow.on('closed', () => {
    initConnectWindow = undefined;
  });

  return initConnectWindow;
};

export const closeInitConnectWindow = (): void => {
  if (initConnectWindow && !initConnectWindow.isDestroyed()) {
    initConnectWindow.close();
  }
  initConnectWindow = undefined;
};

export const getInitConnectWindow = (): BrowserWindow | undefined =>
  initConnectWindow;
