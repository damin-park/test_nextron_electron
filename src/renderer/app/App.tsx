/**
 * 루트 컴포넌트.
 * 모드/SMU 상태를 관리하고 MainWindowShell 을 감싼다.
 * Settings 는 별도 팝업 윈도우(openSettings)로 연다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { MainWindowShell } from '../components/layout/MainWindowShell';
import { createDefaultSideMenuItems } from '../components/layout/sideMenuPreset';
import { openSettings, requestAppShutdown } from '../services/backendConnection';
import { getLabSettings, setLabEnabled } from '../services/systemSettingsClient';
import { APP_VERSION } from '../../shared/app-version';
import { RECIPE, type ControlMode } from '../shared/types/ui';
import { loadControlMode, saveControlMode } from './modePersistence';

const LAB_TOGGLE_CLICKS = 5;
const LAB_TOGGLE_TIMEOUT_MS = 3000;

export function App(): ReactElement {
  const [currentMode, setCurrentMode] = useState<ControlMode>(loadControlMode);
  const [recipeActive, setRecipeActive] = useState(false);
  const [ivEnabled] = useState(false);
  const [labEnabled, setLabEnabledState] = useState(false);
  const [labAvailable, setLabAvailable] = useState(true);
  const labClickCountRef = useRef(0);
  const labClickFirstAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    void getLabSettings()
      .then((settings) => {
        if (!active) return;
        setLabEnabledState(settings.enabled);
        setLabAvailable(settings.available);
      })
      .catch(() => {
        if (!active) return;
        setLabEnabledState(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSettings = useCallback(() => {
    void openSettings();
  }, []);

  const handleExit = useCallback(() => {
    void requestAppShutdown();
  }, []);

  const handleVersionClick = useCallback(() => {
    const now = Date.now();
    if (now - labClickFirstAtRef.current > LAB_TOGGLE_TIMEOUT_MS) {
      labClickCountRef.current = 0;
      labClickFirstAtRef.current = now;
    }

    labClickCountRef.current += 1;
    if (!labAvailable || labClickCountRef.current < LAB_TOGGLE_CLICKS) {
      return;
    }

    labClickCountRef.current = 0;
    labClickFirstAtRef.current = 0;
    const next = !labEnabled;
    setLabEnabledState(next);
    void setLabEnabled(next)
      .then((settings) => {
        setLabEnabledState(settings.enabled);
        setLabAvailable(settings.available);
      })
      .catch(() => {
        setLabEnabledState(!next);
      });
  }, [labAvailable, labEnabled]);

  const versionLabel = useMemo(
    () => (labEnabled ? `${APP_VERSION} LAB` : APP_VERSION),
    [labEnabled],
  );

  const handleModeSelected = useCallback(
    (mode: ControlMode): void => {
      if (recipeActive && mode !== RECIPE) {
        return;
      }
      setCurrentMode(mode);
      saveControlMode(mode);
    },
    [recipeActive],
  );

  const sideMenuItems = createDefaultSideMenuItems({
    ivEnabled,
    onModeSelected: handleModeSelected,
    onResults: () => {
      /* TODO: Results 버튼 */
    },
    onSettings: handleSettings,
  }).map((item) =>
    item.type === 'mode' && recipeActive && item.mode !== RECIPE
      ? { ...item, disabled: true }
      : item,
  );

  return (
    <MainWindowShell
      currentMode={currentMode}
      sideMenuItems={sideMenuItems}
      versionLabel={versionLabel}
      onSettings={handleSettings}
      onExit={handleExit}
      onVersionClick={handleVersionClick}
      onRecipeActiveChange={setRecipeActive}
    />
  );
}
