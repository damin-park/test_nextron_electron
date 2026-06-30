import { contextBridge, ipcRenderer } from 'electron';
import type {
  BackendConnectionInfo,
  BackendInfo,
  BackendRuntimeStatus,
  SystemEvent,
} from '../shared/backend';

const SYSTEM_EVENT_CHANNEL = 'system:event';

/**
 * Renderer 에 노출하는 전용 API.
 * 범용 invoke/send 는 노출하지 않고, 의미 있는 backend 연결 API 만 제공한다.
 */
contextBridge.exposeInMainWorld('nextron', {
  getBackendInfo: (): Promise<BackendInfo> =>
    ipcRenderer.invoke('backend:get-info'),
  getBackendConnection: (): Promise<BackendConnectionInfo> =>
    ipcRenderer.invoke('backend:get-connection'),
  getBackendStatus: (): Promise<BackendRuntimeStatus> =>
    ipcRenderer.invoke('backend:get-status'),
  requestAppShutdown: (): Promise<void> =>
    ipcRenderer.invoke('app:request-shutdown'),
  getSafeStopStatus: (): Promise<unknown> =>
    ipcRenderer.invoke('safe-stop:get-status'),
  forceSafeStopShutdown: (): Promise<unknown> =>
    ipcRenderer.invoke('safe-stop:force-quit'),
  completeSafeStopShutdown: (): Promise<void> =>
    ipcRenderer.invoke('safe-stop:complete'),
  // Settings 팝업 lifecycle.
  savePngImage: (payload: {
    dataUrl: string;
    defaultFileName?: string;
  }): Promise<{ canceled: boolean; filePath?: string }> =>
    ipcRenderer.invoke('graph:save-png', payload),
  openSettings: (): Promise<void> => ipcRenderer.invoke('settings:open'),
  closeSettings: (): Promise<void> => ipcRenderer.invoke('settings:close'),
  // Init Connect 윈도우 lifecycle (REST 호출은 renderer service 계층에서 baseUrl 로 수행).
  completeInitConnect: (): Promise<void> =>
    ipcRenderer.invoke('init-connect:complete'),
  cancelInitConnect: (): Promise<void> =>
    ipcRenderer.invoke('init-connect:cancel'),
  onSystemEvent: (callback: (event: SystemEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: SystemEvent) => {
      callback(payload);
    };
    ipcRenderer.on(SYSTEM_EVENT_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(SYSTEM_EVENT_CHANNEL, listener);
    };
  },
});
