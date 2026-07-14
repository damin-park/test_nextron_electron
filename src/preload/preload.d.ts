import type {
  BackendConnectionInfo,
  BackendInfo,
  BackendRuntimeStatus,
  SystemEvent,
} from '../shared/backend';

declare global {
  interface Window {
    nextron: {
      getBackendInfo: () => Promise<BackendInfo>;
      getBackendConnection: () => Promise<BackendConnectionInfo>;
      getBackendStatus: () => Promise<BackendRuntimeStatus>;
      requestAppShutdown: () => Promise<void>;
      minimizeWindow: () => Promise<void>;
      toggleMaximizeWindow: () => Promise<boolean>;
      isWindowMaximized: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      onWindowMaximizeChange: (
        callback: (maximized: boolean) => void,
      ) => () => void;
      getSafeStopStatus: () => Promise<unknown>;
      forceSafeStopShutdown: () => Promise<unknown>;
      completeSafeStopShutdown: () => Promise<void>;
      savePngImage: (payload: {
        dataUrl: string;
        defaultFileName?: string;
      }) => Promise<{ canceled: boolean; filePath?: string }>;
      openSettings: () => Promise<void>;
      closeSettings: () => Promise<void>;
      completeInitConnect: () => Promise<void>;
      cancelInitConnect: () => Promise<void>;
      onSystemEvent: (callback: (event: SystemEvent) => void) => () => void;
    };
  }
}

export {};
