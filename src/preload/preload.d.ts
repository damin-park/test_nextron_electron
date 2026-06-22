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
      completeInitConnect: () => Promise<void>;
      cancelInitConnect: () => Promise<void>;
      onSystemEvent: (callback: (event: SystemEvent) => void) => () => void;
    };
  }
}

export {};
