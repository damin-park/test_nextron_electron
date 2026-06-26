import { MAX_RECIPE_ROWS, createInitialRecipeRows } from './recipeProfile';
import type { TemperatureRecipeRow } from './recipeTypes';

const STORAGE_KEY = 'nextron_recipe_table';

export interface RecipeTablePersistenceState {
  rows: TemperatureRecipeRow[];
  cycleCount: string;
}

export function loadRecipeTableState(): RecipeTablePersistenceState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createDefaultRecipeTableState();
    }

    const parsed = JSON.parse(stored) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.rows)) {
      return createDefaultRecipeTableState();
    }

    const seenIds = new Set<string>();
    const rows = parsed.rows
      .slice(0, MAX_RECIPE_ROWS)
      .map((row, index) => coerceRecipeRow(row, index, seenIds))
      .filter((row): row is TemperatureRecipeRow => row !== null);

    return {
      rows: rows.length > 0 ? rows : createInitialRecipeRows(),
      cycleCount:
        typeof parsed.cycleCount === 'string' ? parsed.cycleCount : '1',
    };
  } catch (error) {
    console.error('Failed to load recipe table state:', error);
    return createDefaultRecipeTableState();
  }
}

export function saveRecipeTableState(
  state: RecipeTablePersistenceState,
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rows: state.rows.slice(0, MAX_RECIPE_ROWS),
        cycleCount: state.cycleCount,
      }),
    );
  } catch (error) {
    console.error('Failed to save recipe table state:', error);
  }
}

function createDefaultRecipeTableState(): RecipeTablePersistenceState {
  return {
    rows: createInitialRecipeRows(),
    cycleCount: '1',
  };
}

function coerceRecipeRow(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
): TemperatureRecipeRow | null {
  if (!isRecord(raw)) return null;

  const rawId = typeof raw.id === 'string' ? raw.id.trim() : '';
  const id =
    rawId.length > 0 && !seenIds.has(rawId)
      ? rawId
      : `recipe-row-persisted-${index}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
  seenIds.add(id);

  return {
    id,
    tcSetValue: coerceString(raw.tcSetValue),
    tcRampingRate: coerceString(raw.tcRampingRate),
    hour: coerceString(raw.hour),
    minute: coerceString(raw.minute),
    second: coerceString(raw.second),
  };
}

function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
