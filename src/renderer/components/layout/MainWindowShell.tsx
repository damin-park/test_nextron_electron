/**
 * 메인 윈도우 셸 (main_window.py 의 MainWindow 레이아웃 재현).
 *
 * 레이아웃:
 *   [메뉴바]
 *   [사이드메뉴] [연결배너]
 *               [대시보드]
 *               [컨트롤패널 | 스플리터 | 그래프패널]
 *
 * Settings 는 별도 팝업 윈도우로 열린다(인라인 대체 아님).
 * 기존 vanilla DOM 구조(mainWindow.ts)와 동일한 계층/클래스를 유지한다.
 */
import type { ReactElement } from 'react';
import { APP_VERSION } from '../../../shared/app-version';
import { Dashboard } from '../../features/dashboard/Dashboard';
import { ControlPanel } from '../../features/control-panel/ControlPanel';
import { GraphPanel } from '../../features/graph/GraphPanel';
import type { ControlMode } from '../../shared/types/ui';
import { MenuBar } from './MenuBar';
import { SideMenu } from './SideMenu';
import type { SideMenuItemConfig } from './sideMenuPreset';
import { useSplitter } from './useSplitter';

export interface MainWindowShellProps {
  currentMode: ControlMode;
  /** 사이드 메뉴 항목 (preset 에서 생성하여 주입) */
  sideMenuItems: SideMenuItemConfig[];
}

export function MainWindowShell({
  currentMode,
  sideMenuItems,
}: MainWindowShellProps): ReactElement {
  const { controlPanelRef, workAreaRef, splitterRef, onPointerDown } = useSplitter();

  return (
    <div className="app-root">
      <MenuBar version={`${APP_VERSION} LAB`} />
      <div className="app-body">
        <SideMenu
          version={APP_VERSION}
          currentMode={currentMode}
          items={sideMenuItems}
        />
        <div className="main-content">
          <Dashboard />
          <div className="work-area" ref={workAreaRef}>
            <ControlPanel mode={currentMode} ref={controlPanelRef} />
            <div
              className="splitter"
              ref={splitterRef}
              onPointerDown={onPointerDown}
            />
            <GraphPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
