export type BackendInfo = {
  host: string;
  port: number;
  url: string;
  pid?: number;
  running: boolean;
};

declare global {
  interface Window {
    backend: {
      getInfo: () => Promise<BackendInfo>;
      health: () => Promise<boolean>;
    };
  }
}
