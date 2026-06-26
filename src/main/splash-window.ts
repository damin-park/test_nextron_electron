/**
 * 스플래시 윈도우 (tkinter frontend/ui/splash_screen.py 재현).
 *
 * - 프레임 없는 400×200 중앙 정렬 창
 * - 배경 #1A1C1E, 중앙 NEXTRON 로고, 우상단 버전, 중앙 상태 메시지,
 *   하단 진행 바 이미지와 카피라이트
 * - 백엔드 로딩 동안 표시되고, 메인 윈도우가 준비되면 닫힌다.
 */
import { BrowserWindow } from 'electron';
import { SPLASH_LOGO_DATA_URI } from './splash-assets';
import { APP_VERSION } from '../shared/app-version';

const COPYRIGHT = '\u00A9 2026 Nextron. All rights reserved.';

const buildSplashHtml = (): string => `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #1a1c1e;
        font-family: 'Roboto', 'Segoe UI', system-ui, sans-serif;
        user-select: none;
        -webkit-user-select: none;
      }
      .splash {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .splash__version {
        position: absolute;
        top: 14px;
        right: 15px;
        color: #c4c6d0;
        font-size: 13px;
      }
      .splash__center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .splash__logo {
        display: block;
        width: 300px;
        height: auto;
      }
      .splash__status {
        margin-top: 23px;
        color: #ffffff;
        font-size: 15px;
        font-weight: 500;
        text-align: center;
      }
      .splash__bar {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 33px;
        width: 100%;
        height: 6px;
        overflow: hidden;
        background:
          linear-gradient(
            90deg,
            #000000 0%,
            #e6231c 32%,
            #e6231c 50%,
            #000000 68%,
            #000000 100%
          );
        background-size: 220% 100%;
        animation: splash-bar-flow 2.8s linear infinite;
        box-shadow: 0 0 12px rgba(230, 35, 28, 0.45);
      }
      @keyframes splash-bar-flow {
        from {
          background-position: 220% 0;
        }
        to {
          background-position: 0 0;
        }
      }
      .splash__copyright {
        position: absolute;
        bottom: 8px;
        left: 0;
        right: 0;
        text-align: center;
        color: #c4c6d0;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="splash">
      <span class="splash__version">${APP_VERSION}</span>
      <div class="splash__center">
        <img class="splash__logo" src="${SPLASH_LOGO_DATA_URI}" alt="NEXTRON" />
        <span class="splash__status" id="status">Initializing...</span>
      </div>
      <div class="splash__bar" aria-hidden="true"></div>
      <span class="splash__copyright">${COPYRIGHT}</span>
    </div>
  </body>
</html>`;

let splashWindow: BrowserWindow | undefined;

export const createSplashWindow = (): BrowserWindow => {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 250,
    useContentSize: true,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#1a1c1e',
    title: 'Nextron Integrated Program',
    webPreferences: {},
  });

  const html = buildSplashHtml();
  void splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );

  splashWindow.on('closed', () => {
    splashWindow = undefined;
  });

  return splashWindow;
};

/** 스플래시 상태 메시지를 갱신한다 (tkinter change_status_message 대응). */
export const setSplashStatus = (text: string): void => {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }
  const safe = JSON.stringify(text);
  void splashWindow.webContents.executeJavaScript(
    `(() => { const el = document.getElementById('status'); if (el) el.textContent = ${safe}; })();`,
  );
};

export const closeSplashWindow = (): void => {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = undefined;
};
