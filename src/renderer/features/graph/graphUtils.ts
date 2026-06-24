import { GRAPH_SERIES_BY_KEY } from './graphSeriesCatalog';
import {
  DEFAULT_LINE_WIDTH,
  type GraphDisplayData,
  type GraphLineStyle,
  type GraphSeriesKey,
  type SeriesPlotStyle,
} from './graphTypes';

/**
 * Generate a unique tile ID
 * Format: timestamp-random hex string
 */
export function generateTileId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Get layout grid CSS class name based on tile count
 */
export function getLayoutGridClass(tileCount: number): string {
  if (tileCount === 0) return 'graph-panel__tiles--empty';
  if (tileCount === 1) return 'graph-panel__tiles--1x1';
  if (tileCount === 2) return 'graph-panel__tiles--1x2';
  if (tileCount <= 4) return 'graph-panel__tiles--2x2';
  return 'graph-panel__tiles--2x3';
}

/**
 * Get grid template columns for layout
 */
export function getGridTemplateColumns(tileCount: number): string {
  if (tileCount <= 1) return 'repeat(1, 1fr)';
  if (tileCount === 2) return 'repeat(2, 1fr)';
  if (tileCount <= 4) return 'repeat(2, 1fr)';
  return 'repeat(3, 1fr)';
}

/**
 * Get grid template rows for layout
 */
export function getGridTemplateRows(tileCount: number): string {
  if (tileCount <= 2) return 'repeat(1, 1fr)';
  if (tileCount <= 4) return 'repeat(2, 1fr)';
  return 'repeat(2, 1fr)';
}

/**
 * Convert a logical line style to a uPlot `dash` array.
 * Returns undefined for solid lines (no dash).
 */
export function lineStyleToDash(style: GraphLineStyle): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [10, 6];
    case 'dotted':
      return [2, 5];
    case 'dashdot':
      return [10, 5, 2, 5];
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * Resolve the effective plot style for a series, merging any per-tile override
 * with the catalog default color and the global default width/style.
 */
export function resolveSeriesStyle(
  key: GraphSeriesKey,
  overrides?: Partial<Record<GraphSeriesKey, SeriesPlotStyle>>,
): SeriesPlotStyle {
  const def = GRAPH_SERIES_BY_KEY[key];
  const override = overrides?.[key];
  return {
    color: override?.color ?? def?.color ?? '#9E9E9E',
    width: override?.width ?? DEFAULT_LINE_WIDTH,
    style: override?.style ?? 'solid',
  };
}

/**
 * Build synthetic preview data for the Graph Setting preview chart.
 * Generates smooth exponential-style curves (matches Tkinter preview behavior),
 * so the user can preview colors / widths / line styles without live data.
 */
export function buildPreviewData(seriesCount: number): GraphDisplayData {
  const xValues: number[] = [];
  const maxVal = 100;
  const fraction = 0.76;
  for (let x = 0; x <= 100; x += 1) {
    xValues.push(x);
  }
  const ySeries: number[][] = [];
  for (let i = 0; i < seriesCount; i += 1) {
    const offset = i * 8;
    const row = xValues.map(
      (x) => maxVal * fraction * (1 - Math.exp(-0.05 * (x + offset))),
    );
    ySeries.push(row);
  }
  return [xValues, ...ySeries];
}
