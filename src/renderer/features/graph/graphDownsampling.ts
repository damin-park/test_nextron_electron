import type { GraphSeriesValue } from './graphTypes';

export interface VisibleRangeSeries {
  x: number[];
  y: GraphSeriesValue[];
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeGraphValue(value: unknown): GraphSeriesValue {
  return isFiniteNumber(value) ? value : null;
}

export function computeMaxDisplayPoints(panelWidthPx: number): number {
  if (!isFiniteNumber(panelWidthPx) || panelWidthPx <= 0) return 1000;
  return Math.max(1000, Math.floor(panelWidthPx * 3));
}

function lowerBound(values: readonly number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(values: readonly number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function selectVisibleRange(
  x: readonly number[],
  y: readonly (number | null | undefined)[],
  xMin?: number | null,
  xMax?: number | null,
): VisibleRangeSeries {
  const count = Math.min(x.length, y.length);
  if (count === 0) return { x: [], y: [] };

  const hasMin = isFiniteNumber(xMin);
  const hasMax = isFiniteNumber(xMax);
  let start = hasMin ? lowerBound(x, xMin) : 0;
  let end = hasMax ? upperBound(x, xMax) : count;

  // Keep one edge point outside the viewport where possible for line continuity.
  if (start > 0) start -= 1;
  if (end < count) end += 1;

  const rangeX: number[] = [];
  const rangeY: GraphSeriesValue[] = [];
  for (let index = start; index < end && index < count; index += 1) {
    const nextX = x[index];
    if (!isFiniteNumber(nextX)) continue;
    rangeX.push(nextX);
    rangeY.push(normalizeGraphValue(y[index]));
  }

  return { x: rangeX, y: rangeY };
}

function addIndex(indexes: Set<number>, index: number, length: number): void {
  if (index >= 0 && index < length) indexes.add(index);
}

export function downsampleM4(
  x: readonly number[],
  y: readonly (number | null | undefined)[],
  maxPoints: number,
): VisibleRangeSeries {
  const count = Math.min(x.length, y.length);
  if (count === 0) return { x: [], y: [] };
  if (count <= maxPoints) {
    return {
      x: x.slice(0, count),
      y: y.slice(0, count).map(normalizeGraphValue),
    };
  }

  const bucketCount = Math.max(1, Math.floor(maxPoints / 4));
  const bucketSize = count / bucketCount;
  const keptIndexes = new Set<number>();

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor(bucket * bucketSize);
    const end = Math.min(count, Math.floor((bucket + 1) * bucketSize));
    if (start >= end) continue;

    let minIndex = -1;
    let maxIndex = -1;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

    for (let index = start; index < end; index += 1) {
      const value = y[index];
      if (!isFiniteNumber(value)) continue;
      if (value < minValue) {
        minValue = value;
        minIndex = index;
      }
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    }

    addIndex(keptIndexes, start, count);
    addIndex(keptIndexes, minIndex, count);
    addIndex(keptIndexes, maxIndex, count);
    addIndex(keptIndexes, end - 1, count);
  }

  const sortedIndexes = Array.from(keptIndexes).sort((a, b) => a - b);
  const outX: number[] = [];
  const outY: GraphSeriesValue[] = [];

  for (const index of sortedIndexes) {
    const nextX = x[index];
    if (!isFiniteNumber(nextX)) continue;
    outX.push(nextX);
    outY.push(normalizeGraphValue(y[index]));
  }

  return { x: outX, y: outY };
}

export function buildDisplaySeries(
  x: readonly number[],
  y: readonly (number | null | undefined)[],
  xMin: number | null | undefined,
  xMax: number | null | undefined,
  panelWidthPx: number,
): VisibleRangeSeries {
  const visible = selectVisibleRange(x, y, xMin, xMax);
  const maxPoints = computeMaxDisplayPoints(panelWidthPx);
  return downsampleM4(visible.x, visible.y, maxPoints);
}
