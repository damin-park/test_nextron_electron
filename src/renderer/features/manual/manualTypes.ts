import type { IconName } from '../../shared/icons/materialSymbols';

export type ManualDeviceId =
  | 'temp'
  | 'mfc'
  | 'humidity'
  | 'pressure'
  | 'measurement'
  | 'chiller';

export interface ManualDeviceConfig {
  id: ManualDeviceId;
  label: string;
  title: string;
  icon: IconName;
  enabled: boolean;
  connected: boolean;
  gap?: string;
}
