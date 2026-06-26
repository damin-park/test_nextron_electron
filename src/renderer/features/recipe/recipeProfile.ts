import type {
  RecipeProfilePoint,
  TemperatureRecipePlanStep,
  TemperatureRecipeRow,
  TemperatureRecipeStep,
} from './recipeTypes';

export const DEFAULT_RECIPE_ROWS = 5;
export const MAX_RECIPE_ROWS = 100;

export function createRecipeRow(index: number): TemperatureRecipeRow {
  return {
    id: `recipe-row-${Date.now().toString(36)}-${index}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    tcSetValue: index === 0 ? '25.0' : '',
    tcRampingRate: index === 0 ? '30.0' : '',
    hour: '0',
    minute: index === 0 ? '1' : '0',
    second: '0',
  };
}

export function createInitialRecipeRows(): TemperatureRecipeRow[] {
  return Array.from({ length: DEFAULT_RECIPE_ROWS }, (_, index) =>
    createRecipeRow(index),
  );
}

export function parseNonNegativeInt(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

export function parseFiniteNumber(raw: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) return null;
  return value;
}

export function normalizeRecipeRows(
  rows: readonly TemperatureRecipeRow[],
): TemperatureRecipeStep[] {
  const steps: TemperatureRecipeStep[] = [];

  rows.forEach((row, index) => {
    const target = parseFiniteNumber(row.tcSetValue);
    if (target == null) return;

    const rampingRate =
      row.tcRampingRate.trim().length === 0
        ? 0
        : parseFiniteNumber(row.tcRampingRate);
    const hour = parseNonNegativeInt(row.hour);
    const minute = parseNonNegativeInt(row.minute);
    const second = parseNonNegativeInt(row.second);

    if (
      rampingRate == null ||
      rampingRate < 0 ||
      hour == null ||
      minute == null ||
      second == null ||
      minute > 59 ||
      second > 59
    ) {
      return;
    }

    const holdSec = hour * 3600 + minute * 60 + second;
    if (holdSec <= 0) return;

    steps.push({
      rowId: row.id,
      rowIndex: index,
      tcSetValue: target,
      tcRampingRate: rampingRate,
      holdSec,
    });
  });

  return steps;
}

export function buildTemperatureRecipePlan(
  steps: readonly TemperatureRecipeStep[],
  cycleCount: number,
  initialPv: number | null | undefined,
): {
  planSteps: TemperatureRecipePlanStep[];
  profile: RecipeProfilePoint[];
  totalSec: number;
} {
  const normalizedCycleCount = Math.max(1, Math.floor(cycleCount));
  const planSteps: TemperatureRecipePlanStep[] = [];
  const profile: RecipeProfilePoint[] = [];

  let startSec = 0;
  let previousValue =
    typeof initialPv === 'number' && Number.isFinite(initialPv)
      ? initialPv
      : steps[0]?.tcSetValue ?? 0;

  profile.push({ timeSec: 0, value: previousValue });

  for (let cycleIndex = 0; cycleIndex < normalizedCycleCount; cycleIndex += 1) {
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const step = steps[stepIndex];
      const rampSec =
        step.tcRampingRate > 0
          ? (Math.abs(step.tcSetValue - previousValue) / step.tcRampingRate) * 60
          : 0;
      const rampEndSec = startSec + rampSec;
      const endSec = rampEndSec + step.holdSec;

      profile.push({ timeSec: rampEndSec, value: step.tcSetValue });
      profile.push({ timeSec: endSec, value: step.tcSetValue });
      planSteps.push({
        ...step,
        cycleIndex,
        stepIndex,
        startSec,
        rampEndSec,
        endSec,
      });

      previousValue = step.tcSetValue;
      startSec = endSec;
    }
  }

  return {
    planSteps,
    profile: coalesceProfilePoints(profile),
    totalSec: startSec,
  };
}

function coalesceProfilePoints(
  points: readonly RecipeProfilePoint[],
): RecipeProfilePoint[] {
  const result: RecipeProfilePoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.timeSec - point.timeSec) < 0.000001 &&
      Math.abs(previous.value - point.value) < 0.000001
    ) {
      continue;
    }
    result.push(point);
  }
  return result;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(
    s,
  ).padStart(2, '0')}`;
}
