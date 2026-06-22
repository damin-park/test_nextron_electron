/**
 * ��猷⑦듃 而댄룷�뚰듃.
 * 紐⑤뱶/�ъ씠�쒕찓���곹깭瑜�愿由ы븯怨�MainWindowShell ���꾨떖�쒕떎.
 * backend �곌껐 �곹깭瑜�援щ룆��ConnectionBanner / Dashboard ���꾨떖�쒕떎.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { MainWindowShell } from '../components/layout/MainWindowShell';
import type { BannerKind } from '../components/status/ConnectionBanner';
import { useBackendStatus } from '../hooks/useBackendStatus';
import type { BackendRuntimeStatus } from '../../shared/backend';
import { RECIPE, type ControlMode } from '../shared/types/ui';

const BANNER_BY_STATUS: Record<
  BackendRuntimeStatus,
  { kind: BannerKind; message: string }
> = {
  starting: { kind: 'connection', message: 'Backend: Starting...' },
  ready: { kind: 'success', message: 'Backend: Ready' },
  'not-ready': { kind: 'warning', message: 'Backend: Not Ready' },
  failed: { kind: 'warning', message: 'Backend: Failed' },
  stopped: { kind: 'warning', message: 'Backend: Stopped' },
  unknown: { kind: 'idle', message: '' },
};

export function App(): ReactElement {
  const [currentMode, setCurrentMode] = useState<ControlMode>(RECIPE);

  // IV ��SMU �곌껐 �쒖뿉留��몄텧. 珥덇린�먮뒗 鍮꾪솢���곹깭瑜��좎���쒕떎.
  const [ivEnabled] = useState(false);

  const { connection, status, health } = useBackendStatus();
  const banner = BANNER_BY_STATUS[status];

  return (
    <MainWindowShell
      currentMode={currentMode}
      ivEnabled={ivEnabled}
      bannerKind={banner.kind}
      bannerMessage={banner.message}
      backendStatus={status}
      backendConnection={connection}
      backendHealth={health}
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
