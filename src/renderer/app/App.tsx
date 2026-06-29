/**
 * 루트 컴포넌트.
 * 모드/SMU 상태를 관리하고 MainWindowShell 을 감싼다.
 * Settings 는 별도 팝업 윈도우(openSettings)로 연다.
 */
import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';
import { MainWindowShell } from '../components/layout/MainWindowShell';
import { createDefaultSideMenuItems } from '../components/layout/sideMenuPreset';
import { openSettings } from '../services/backendConnection';
import { RECIPE, type ControlMode } from '../shared/types/ui';

export function App(): ReactElement {
  const [currentMode, setCurrentMode] = useState<ControlMode>(RECIPE);
  const [recipeActive, setRecipeActive] = useState(false);
  const [ivEnabled] = useState(false);

  const handleModeSelected = useCallback(
    (mode: ControlMode): void => {
      if (recipeActive && mode !== RECIPE) {
        return;
      }
      setCurrentMode(mode);
    },
    [recipeActive],
  );

  const sideMenuItems = createDefaultSideMenuItems({
    ivEnabled,
    onModeSelected: handleModeSelected,
    onResults: () => {
      /* TODO: Results 버튼 */
    },
    onSettings: () => {
      void openSettings();
    },
  }).map((item) =>
    item.type === 'mode' && recipeActive && item.mode !== RECIPE
      ? { ...item, disabled: true }
      : item,
  );

  return (
    <MainWindowShell
      currentMode={currentMode}
      sideMenuItems={sideMenuItems}
      onRecipeActiveChange={setRecipeActive}
    />
  );
}
