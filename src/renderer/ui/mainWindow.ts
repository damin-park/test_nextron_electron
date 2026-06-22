/**
 * 메인 윈도우 (main_window.py 의 MainWindow 재현).
 *
 * 레이아웃:
 *   [메뉴바]
 *   [사이드메뉴] [연결배너]
 *               [대시보드]
 *               [컨트롤패널 | 스플리터 | 그래프패널]
 *
 * 사이드메뉴로 RECIPE / MANUAL / IV 모드를 전환하고,
 * 스플리터 드래그로 컨트롤 패널 폭을 조절한다.
 */
import { createMenuBar } from './menuBar';
import { createSideMenu } from './sideMenu';
import { createConnectionBanner } from './connectionBanner';
import { createDashboard } from './dashboard';
import { createControlPanel } from './controlPanel';
import { createGraphPanel } from './graphPanel';
import { RECIPE, type ControlMode } from './types';

const APP_VERSION = 'v1.0.0';

// main_window.py 의 폭 제약
const MIN_CONTROL_WIDTH = 260;
const MIN_GRAPH_WIDTH = 420;
const SPLITTER_WIDTH = 4;

export function createMainWindow(): HTMLElement {
  let currentMode: ControlMode = RECIPE;

  const root = document.createElement('div');
  root.className = 'app-root';

  // ── 상단 메뉴바 ──
  const menuBar = createMenuBar(`${APP_VERSION} LAB`);

  // ── 본문 ──
  const body = document.createElement('div');
  body.className = 'app-body';

  const controlPanel = createControlPanel(currentMode);

  const sideMenu = createSideMenu(APP_VERSION, currentMode, {
    onModeSelected: (mode) => {
      currentMode = mode;
      sideMenu.setMode(mode);
      controlPanel.setMode(mode);
    },
    onResults: () => {
      /* TODO: Results 창 */
    },
    onSettings: () => {
      /* TODO: Settings 창 */
    },
  });

  // IV 는 SMU 연결 시에만 노출 (초기엔 비활성)
  sideMenu.setItemEnabled('iv', false);

  const mainContent = document.createElement('div');
  mainContent.className = 'main-content';

  const banner = createConnectionBanner();
  const dashboard = createDashboard();

  const workArea = document.createElement('div');
  workArea.className = 'work-area';

  const splitter = document.createElement('div');
  splitter.className = 'splitter';

  const graphPanel = createGraphPanel();

  workArea.append(controlPanel.element, splitter, graphPanel);
  mainContent.append(banner.element, dashboard, workArea);
  body.append(sideMenu.element, mainContent);
  root.append(menuBar, body);

  setupSplitter(splitter, controlPanel.element, workArea);

  return root;
}

/** 스플리터 드래그로 컨트롤 패널 폭을 조절한다. */
function setupSplitter(
  splitter: HTMLElement,
  controlPanel: HTMLElement,
  workArea: HTMLElement,
): void {
  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    const delta = event.clientX - startX;
    const maxWidth = workArea.clientWidth - SPLITTER_WIDTH - MIN_GRAPH_WIDTH;
    const next = Math.max(MIN_CONTROL_WIDTH, Math.min(startWidth + delta, maxWidth));
    controlPanel.style.flexBasis = `${next}px`;
    controlPanel.style.width = `${next}px`;
  };

  const stopDrag = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    splitter.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  };

  splitter.addEventListener('pointerdown', (event) => {
    dragging = true;
    startX = event.clientX;
    startWidth = controlPanel.getBoundingClientRect().width;
    splitter.classList.add('is-dragging');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
  });
}
