export type GraphSeriesKey =
  | 'temperature_pv'
  | 'temperature_sv'
  | 'temperature_hp'
  | 'temperature_cp';

export type GraphSeriesGroup = 'Temperature' | 'Power';

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
