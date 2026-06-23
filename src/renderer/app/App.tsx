/**
 * 루트 컴포넌트.
 * 모드/SMU 상태를 관리하고 MainWindowShell 을 감싼다.
 * Settings 는 별도 팝업 윈도우(openSettings)로 연다.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { MainWindowShell } from '../components/layout/MainWindowShell';
import { createDefaultSideMenuItems } from '../components/layout/sideMenuPreset';
import { openSettings } from '../services/backendConnection';
import { RECIPE, type ControlMode } from '../shared/types/ui';

export function App(): ReactElement {
  const [currentMode, setCurrentMode] = useState<ControlMode>(RECIPE);
  const [ivEnabled] = useState(false);

  const sideMenuItems = createDefaultSideMenuItems({
    ivEnabled,
    onModeSelected: setCurrentMode,
    onResults: () => {
      /* TODO: Results 버튼 */
    },
    onSettings: () => {
      void openSettings();
    },
  });

  return (
    <MainWindowShell currentMode={currentMode} sideMenuItems={sideMenuItems} />
  );
}
