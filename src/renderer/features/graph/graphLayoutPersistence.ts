import type { GraphLayoutConfig } from './graphTypes';
import { DEFAULT_GRAPH_LAYOUT } from './graphTypes';

const STORAGE_KEY = 'nextron_graph_layout';

/**
 * Load graph layout from localStorage
 * Returns null if not found or parsing fails
 */
export function loadGraphLayout(): GraphLayoutConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as GraphLayoutConfig;
    // Validate structure
    if (!parsed.tiles || !Array.isArray(parsed.tiles)) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load graph layout:', err);
    return null;
  }
}

/**
 * Save graph layout to localStorage
 */
export function saveGraphLayout(layout: GraphLayoutConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.error('Failed to save graph layout:', err);
  }
}

/**
 * Reset to default layout
 */
export function resetGraphLayout(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GRAPH_LAYOUT));
  } catch (err) {
    console.error('Failed to reset graph layout:', err);
  }
}

/**
 * Clear all stored layout data
 */
export function clearGraphLayout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear graph layout:', err);
  }
}
