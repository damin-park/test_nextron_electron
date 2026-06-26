export interface TemperatureRecipeRow {
  id: string;
  tcSetValue: string;
  tcRampingRate: string;
  hour: string;
  minute: string;
  second: string;
}

export interface TemperatureRecipeStep {
  rowId: string;
  rowIndex: number;
  tcSetValue: number;
  tcRampingRate: number;
  holdSec: number;
}

export interface TemperatureRecipePlanStep extends TemperatureRecipeStep {
  cycleIndex: number;
  stepIndex: number;
  startSec: number;
  rampEndSec: number;
  endSec: number;
}

export interface RecipeProfilePoint {
  timeSec: number;
  value: number;
}

export type RecipeProfileKind =
  | 'temperature'
  | 'mfc'
  | 'humidity'
  | 'pressure'
  | 'chiller';

export interface RecipeProfileTabConfig {
  kind: RecipeProfileKind;
  label: string;
  unitLabel: string;
  enabled: boolean;
}

export interface RecipeGraphState {
  profile: RecipeProfilePoint[];
  elapsedSec: number | null;
  running: boolean;
}

export interface RecipeRunState {
  running: boolean;
  currentCycle: number;
  currentStepIndex: number;
  elapsedSec: number;
  startedAt: number | null;
}
