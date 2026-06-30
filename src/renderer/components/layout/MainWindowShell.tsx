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
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { ConnectionBanner, type BannerKind } from '../status/ConnectionBanner';
import { Dashboard } from '../../features/dashboard/Dashboard';
import { ControlPanel } from '../../features/control-panel/ControlPanel';
import { GraphPanel } from '../../features/graph/GraphPanel';
import type { RecipeGraphState } from '../../features/recipe/recipeTypes';
import { useTemperatureConnection } from '../../features/temperature/useTemperatureConnection';
import type { ControlMode } from '../../shared/types/ui';
import { MenuBar } from './MenuBar';
import { SideMenu } from './SideMenu';
import type { SideMenuItemConfig } from './sideMenuPreset';
import { useSplitter } from './useSplitter';

export interface MainWindowShellProps {
  currentMode: ControlMode;
  /** 사이드 메뉴 항목 (preset 에서 생성하여 주입) */
  sideMenuItems: SideMenuItemConfig[];
  versionLabel: string;
  onSettings?: () => void;
  onVersionClick?: () => void;
  onRecipeActiveChange: (active: boolean) => void;
}

export function MainWindowShell({
  currentMode,
  sideMenuItems,
  versionLabel,
  onSettings,
  onVersionClick,
  onRecipeActiveChange,
}: MainWindowShellProps): ReactElement {
  const { controlPanelRef, workAreaRef, splitterRef, onPointerDown } = useSplitter();
  const backend = useBackendStatus();
  const temperatureConnection = useTemperatureConnection('temperature-1');
  const [recipeGraphState, setRecipeGraphState] = useState<RecipeGraphState>({
    profile: [],
    elapsedSec: null,
    running: false,
  });
  const [graphResetToken, setGraphResetToken] = useState(0);
  const [dismissedBannerMessage, setDismissedBannerMessage] = useState<string | null>(
    null,
  );
  const handleRecipeGraphStateChange = useCallback(
    (state: RecipeGraphState) => setRecipeGraphState(state),
    [],
  );
  const handleRecipeStart = useCallback(
    () => setGraphResetToken((current) => current + 1),
    [],
  );
  const topBanner = useMemo((): { kind: BannerKind; message: string; dismissible: boolean } => {
    const tempState = temperatureConnection.state;
    const safeStopping = tempState?.safeStopping === true;
    if (safeStopping) {
      const target = tempState.safeStopTarget;
      const targetText =
        typeof target === 'number' && Number.isFinite(target)
          ? ` ${target.toFixed(1)} °C`
          : ' a safe level';
      return {
        kind: 'safe-stop',
        message: `Temperature Controller is performing a safe stop. Please wait until the temperature reaches${targetText}.`,
        dismissible: false,
      };
    }

    const chamberConnected = tempState?.chamber ?? tempState?.Chamber;
    if (chamberConnected === false) {
      return {
        kind: 'warning',
        message:
          'The chamber is not connected. Please check the connection. Temperature control will be stopped.',
        dismissible: true,
      };
    }

    const temperatureError = temperatureConnection.error ?? tempState?.error ?? null;
    if (temperatureError) {
      return {
        kind: 'warning',
        message: `Temperature Controller: ${temperatureError}`,
        dismissible: true,
      };
    }

    if (backend.status === 'starting') {
      return {
        kind: 'connection',
        message: 'Backend is starting. Device data may be temporarily unavailable.',
        dismissible: false,
      };
    }

    if (
      backend.status === 'not-ready' ||
      backend.status === 'failed' ||
      backend.status === 'stopped' ||
      backend.health?.live === false ||
      backend.health?.ready === false
    ) {
      const detail = backend.health?.message ? ` ${backend.health.message}` : '';
      return {
        kind: 'connection',
        message: `Backend connection is unstable. Attempting to recover...${detail}`,
        dismissible: false,
      };
    }

    return { kind: 'idle', message: '', dismissible: false };
  }, [
    backend.health?.live,
    backend.health?.message,
    backend.health?.ready,
    backend.status,
    temperatureConnection.error,
    temperatureConnection.state,
  ]);

  const bannerHiddenByUser =
    topBanner.dismissible && topBanner.message === dismissedBannerMessage;
  const visibleTopBanner = bannerHiddenByUser
    ? { kind: 'idle' as BannerKind, message: '', dismissible: false }
    : topBanner;

  return (
    <div className="app-root">
      <MenuBar onSettings={onSettings} />
      <div className="app-body">
        <SideMenu
          version={versionLabel}
          currentMode={currentMode}
          items={sideMenuItems}
          onVersionClick={onVersionClick}
        />
        <div className="main-content">
          <ConnectionBanner
            kind={visibleTopBanner.kind}
            message={visibleTopBanner.message}
            onDismiss={
              visibleTopBanner.dismissible
                ? () => setDismissedBannerMessage(visibleTopBanner.message)
                : undefined
            }
          />
          <Dashboard temperatureConnection={temperatureConnection} />
          <div className="work-area" ref={workAreaRef}>
            <ControlPanel
              mode={currentMode}
              temperatureConnection={temperatureConnection}
              onRecipeGraphStateChange={handleRecipeGraphStateChange}
              onRecipeStart={handleRecipeStart}
              onRecipeActiveChange={onRecipeActiveChange}
              ref={controlPanelRef}
            />
            <div
              className="splitter"
              ref={splitterRef}
              onPointerDown={onPointerDown}
            />
            <GraphPanel
              currentMode={currentMode}
              temperatureState={temperatureConnection.state}
              recipeGraphState={recipeGraphState}
              resetToken={graphResetToken}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
