import { RECIPE, type ControlMode } from '../shared/types/ui';

const STORAGE_KEY = 'nextron_control_mode';
const VALID_MODES: ControlMode[] = ['recipe', 'manual', 'iv'];

/** 마지막으로 선택된 mode 를 불러온다. 없으면 RECIPE. */
export function loadControlMode(): ControlMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && VALID_MODES.includes(stored as ControlMode)) {
      return stored as ControlMode;
    }
  } catch (error) {
    console.error('Failed to load control mode:', error);
  }
  return RECIPE;
}

/** 현재 mode 를 저장한다. */
export function saveControlMode(mode: ControlMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    console.error('Failed to save control mode:', error);
  }
}
