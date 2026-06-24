import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import { GraphHistoryStore } from './graphHistoryStore';
import type { GraphDisplayData, GraphSeriesKey, GraphSampleInput } from './graphTypes';

interface LastAppendSignature {
  elapsedSec: number;
  signature: string;
}

function valueSignature(state: TemperatureDeviceState): string {
  return [
    state.pv ?? state.currentTemperature ?? '',
    state.sv ?? state.targetSetpoint ?? '',
    state.hotPower ?? '',
    state.coolPower ?? '',
    state.lastUpdated ?? '',
  ].join('|');
}

function mapTemperatureStateToSample(
  state: TemperatureDeviceState,
  elapsedSec: number,
): GraphSampleInput {
  return {
    elapsedSec,
    temperaturePv: state.pv ?? state.currentTemperature,
    temperatureSv: state.sv ?? state.targetSetpoint,
    temperatureHotPower: state.hotPower,
    temperatureCoolPower: state.coolPower,
  };
}

export function useGraphHistory(temperatureState: TemperatureDeviceState | null) {
  const storeRef = useRef<GraphHistoryStore | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastAppendRef = useRef<LastAppendSignature | null>(null);
  const [version, setVersion] = useState(0);

  if (storeRef.current == null) {
    storeRef.current = new GraphHistoryStore();
  }
  if (startTimeRef.current == null) {
    startTimeRef.current = performance.now();
  }

  useEffect(() => {
    if (temperatureState == null) return;

    const now = performance.now();
    const elapsedSec = (now - (startTimeRef.current ?? now)) / 1000;
    const signature = valueSignature(temperatureState);
    const lastAppend = lastAppendRef.current;

    if (
      lastAppend != null &&
      lastAppend.signature === signature &&
      elapsedSec - lastAppend.elapsedSec < 0.05
    ) {
      return;
    }

    const appended = storeRef.current?.appendSample(
      mapTemperatureStateToSample(temperatureState, elapsedSec),
    );

    if (appended === true) {
      lastAppendRef.current = { elapsedSec, signature };
      setVersion((current) => current + 1);
    }
  }, [temperatureState]);

  const clear = useCallback(() => {
    storeRef.current?.clear();
    startTimeRef.current = performance.now();
    lastAppendRef.current = null;
    setVersion((current) => current + 1);
  }, []);

  const getDisplayData = useCallback(
    (
      seriesKeys: readonly GraphSeriesKey[],
      xMin: number | null | undefined,
      xMax: number | null | undefined,
      panelWidthPx: number,
    ): GraphDisplayData => {
      return storeRef.current?.getDisplayData(seriesKeys, xMin, xMax, panelWidthPx) ?? [[]];
    },
    [],
  );

  return useMemo(
    () => ({
      store: storeRef.current as GraphHistoryStore,
      pointCount: storeRef.current?.getPointCount() ?? 0,
      xRange: storeRef.current?.getFullXRange() ?? { min: null, max: null },
      clear,
      getDisplayData,
    }),
    [clear, getDisplayData, version],
  );
}
