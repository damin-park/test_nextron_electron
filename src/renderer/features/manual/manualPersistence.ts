const STORAGE_KEY = 'nextron_manual_temperature';

export interface ManualTemperatureInputs {
  setValue: string;
  rampingRate: string;
}

const DEFAULT_INPUTS: ManualTemperatureInputs = {
  setValue: '25.0',
  rampingRate: '30.0',
};

/** 마지막으로 입력한 manual 온도 값을 불러온다. 없으면 기본값. */
export function loadManualTemperatureInputs(): ManualTemperatureInputs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_INPUTS;
    const parsed = JSON.parse(stored) as unknown;
    if (parsed != null && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return {
        setValue:
          typeof record.setValue === 'string'
            ? record.setValue
            : DEFAULT_INPUTS.setValue,
        rampingRate:
          typeof record.rampingRate === 'string'
            ? record.rampingRate
            : DEFAULT_INPUTS.rampingRate,
      };
    }
  } catch (error) {
    console.error('Failed to load manual temperature inputs:', error);
  }
  return DEFAULT_INPUTS;
}

/** manual 온도 입력값을 저장한다. */
export function saveManualTemperatureInputs(
  inputs: ManualTemperatureInputs,
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (error) {
    console.error('Failed to save manual temperature inputs:', error);
  }
}
