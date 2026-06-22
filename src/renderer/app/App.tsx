/**
 * ��猷⑦듃 而댄룷�뚰듃.
 * 紐⑤뱶/�ъ씠�쒕찓���곹깭瑜�愿由ы븯怨�MainWindowShell ���꾨떖�쒕떎.
 * backend �곌껐 �곹깭瑜�援щ룆��ConnectionBanner / Dashboard ���꾨떖�쒕떎.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { MainWindowShell } from '../components/layout/MainWindowShell';
import { RECIPE, type ControlMode } from '../shared/types/ui';

export function App(): ReactElement {
  const [currentMode, setCurrentMode] = useState<ControlMode>(RECIPE);

  // IV ��SMU �곌껐 �쒖뿉留��몄텧. 珥덇린�먮뒗 鍮꾪솢���곹깭瑜��좎���쒕떎.
  const [ivEnabled] = useState(false);

  return (
    <MainWindowShell
      currentMode={currentMode}
      ivEnabled={ivEnabled}
      onModeSelected={setCurrentMode}
      onResults={() => {
        /* TODO: Results 李�*/
      }}
      onSettings={() => {
        /* TODO: Settings 李�*/
      }}
    />
  );
}
