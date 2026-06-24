export type GraphSeriesKey =
  | 'temperature_pv'
  | 'temperature_sv'
  | 'temperature_hp'
  | 'temperature_cp';

export type GraphSeriesGroup = 'Temperature' | 'Power';

/** Line style options for a plotted series (matches Tkinter matplotlib styles) */
export type GraphLineStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot';

/** Per-series plot style override (color / line width / line style) */
export interface SeriesPlotStyle {
  color: string;
  width: number;
  style: GraphLineStyle;
}

/** Selectable line styles in the Plot setting UI (display label + value) */
export const LINE_STYLE_OPTIONS: ReadonlyArray<{
  value: GraphLineStyle;
  label: string;
}> = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashdot', label: 'Dashdot' },
];

/** Selectable line widths in the Plot setting UI */
export const LINE_WIDTH_OPTIONS: readonly number[] = [0.5, 1, 1.5, 2, 3, 4];

/** Default line width for a plotted series */
export const DEFAULT_LINE_WIDTH = 1.5;

/** Color palette for the Plot setting color picker (20 dark-mode colors, matches Tkinter) */
export const PLOT_COLOR_PALETTE: readonly string[] = [
  '#9E9E9E', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52D273',
  '#A9A9A9', '#9ED9D8', '#FFB347', '#A3D9FF', '#DDA0DD',
  '#87CEEB', '#F0E68C', '#E6A8D7', '#90EE90', '#FFD700',
];

export type GraphSeriesValue = number | null;

export interface GraphSeriesDefinition {
  key: GraphSeriesKey;
  label: string;
  group: GraphSeriesGroup;
  unitLabel: string;
  defaultVisible: boolean;
  color: string;
}

export type GraphSeriesValues = Record<GraphSeriesKey, GraphSeriesValue[]>;

export interface GraphHistory {
  time: number[];
  values: GraphSeriesValues;
}

export interface GraphSampleInput {
  elapsedSec: number;
  temperaturePv?: number | null;
  temperatureSv?: number | null;
  temperatureHotPower?: number | null;
  temperatureCoolPower?: number | null;
}

export type GraphDisplayData = [
  xValues: number[],
  ...yValues: GraphSeriesValue[][],
];

/**
 * Graph Tile Configuration
 * Represents a single graph tile in the layout
 */
export interface GraphTileConfig {
  /** Unique identifier for this tile (UUID or stable string) */
  id: string;
  /** Display title of the graph */
  title: string;
  /** X-axis type (currently only 'time' is supported) */
  xAxis: 'time';
  /** Selected series to display in this tile */
  selectedSeries: GraphSeriesKey[];
  /** Optional per-series style overrides (color / width / line style). Falls back to catalog defaults. */
  seriesStyles?: Partial<Record<GraphSeriesKey, SeriesPlotStyle>>;
}

/**
 * Graph Layout Configuration
 * Persisted state for the entire graph panel
 */
export interface GraphLayoutConfig {
  /** Array of tile configurations */
  tiles: GraphTileConfig[];
}

/**
 * Default graph layout: single tile with Temperature PV/SV
 * Matches Tkinter default from graph_config.json
 */
export const DEFAULT_GRAPH_LAYOUT: GraphLayoutConfig = {
  tiles: [
    {
      id: '1',
      title: 'Temperature',
      xAxis: 'time',
      selectedSeries: ['temperature_pv', 'temperature_sv'],
    },
  ],
};
