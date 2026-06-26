import {
  buildDisplaySeries,
  isFiniteNumber,
  normalizeGraphValue,
} from './graphDownsampling';
import { GRAPH_SERIES_CATALOG } from './graphSeriesCatalog';
import type {
  GraphDisplayData,
  GraphHistory,
  GraphSampleInput,
  GraphSeriesKey,
  GraphSeriesValue,
  GraphSeriesValues,
} from './graphTypes';

export const GRAPH_HISTORY_MAX_POINTS = 5_000_000;

const SAMPLE_INPUT_BY_SERIES: Record<
  GraphSeriesKey,
  keyof Omit<GraphSampleInput, 'elapsedSec'>
> = {
  temperature_pv: 'temperaturePv',
  temperature_sv: 'temperatureSv',
  temperature_hp: 'temperatureHotPower',
  temperature_cp: 'temperatureCoolPower',
  temperature_total_profile: 'temperatureTotalProfile',
};

export function createEmptyGraphHistory(): GraphHistory {
  const values = GRAPH_SERIES_CATALOG.reduce<GraphSeriesValues>((acc, series) => {
    acc[series.key] = [];
    return acc;
  }, {} as GraphSeriesValues);

  return {
    time: [],
    values,
  };
}

function hasValidGraphValue(sample: GraphSampleInput): boolean {
  return GRAPH_SERIES_CATALOG.some((series) =>
    isFiniteNumber(sample[SAMPLE_INPUT_BY_SERIES[series.key]]),
  );
}

export class GraphHistoryStore {
  private history = createEmptyGraphHistory();

  appendSample(sample: GraphSampleInput): boolean {
    if (!isFiniteNumber(sample.elapsedSec)) return false;
    if (!hasValidGraphValue(sample)) return false;

    const lastIndex = this.history.time.length - 1;
    const lastElapsed = this.history.time[lastIndex];
    const isSameElapsed =
      lastIndex >= 0 && Math.abs(lastElapsed - sample.elapsedSec) < 0.000001;

    if (isSameElapsed) {
      this.writeValuesAt(lastIndex, sample);
      return true;
    }

    this.history.time.push(sample.elapsedSec);
    for (const series of GRAPH_SERIES_CATALOG) {
      const inputKey = SAMPLE_INPUT_BY_SERIES[series.key];
      this.history.values[series.key].push(normalizeGraphValue(sample[inputKey]));
    }

    this.trimToMaxPoints();
    return true;
  }

  clear(): void {
    this.history = createEmptyGraphHistory();
  }

  getHistory(): GraphHistory {
    return this.history;
  }

  getPointCount(): number {
    return this.history.time.length;
  }

  getFullXRange(): { min: number | null; max: number | null } {
    const count = this.history.time.length;
    if (count === 0) return { min: null, max: null };
    return {
      min: this.history.time[0],
      max: this.history.time[count - 1],
    };
  }

  getDisplayData(
    seriesKeys: readonly GraphSeriesKey[],
    xMin: number | null | undefined,
    xMax: number | null | undefined,
    panelWidthPx: number,
  ): GraphDisplayData {
    if (seriesKeys.length === 0) return [[]];
    if (this.history.time.length === 0) {
      return [[], ...seriesKeys.map(() => [])];
    }

    const sampledSeries = seriesKeys.map((key) => ({
      key,
      data: buildDisplaySeries(
        this.history.time,
        this.history.values[key],
        xMin,
        xMax,
        panelWidthPx,
      ),
    }));

    const xSet = new Set<number>();
    for (const sampled of sampledSeries) {
      for (const x of sampled.data.x) xSet.add(x);
    }

    const alignedX = Array.from(xSet).sort((a, b) => a - b);
    const alignedY = sampledSeries.map((sampled) => {
      const valueByX = new Map<number, GraphSeriesValue>();
      sampled.data.x.forEach((x, index) => {
        valueByX.set(x, sampled.data.y[index]);
      });
      return alignedX.map((x) => valueByX.get(x) ?? null);
    });

    return [alignedX, ...alignedY];
  }

  private writeValuesAt(index: number, sample: GraphSampleInput): void {
    for (const series of GRAPH_SERIES_CATALOG) {
      const inputKey = SAMPLE_INPUT_BY_SERIES[series.key];
      const value = sample[inputKey];
      if (isFiniteNumber(value)) {
        this.history.values[series.key][index] = value;
      }
    }
  }

  private trimToMaxPoints(): void {
    const overflow = this.history.time.length - GRAPH_HISTORY_MAX_POINTS;
    if (overflow <= 0) return;

    this.history.time.splice(0, overflow);
    for (const series of GRAPH_SERIES_CATALOG) {
      this.history.values[series.key].splice(0, overflow);
    }
  }
}
