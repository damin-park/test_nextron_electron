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

export function useGraphHistory(
  temperatureState: TemperatureDeviceState | null,
  recording = true,
) {
  const storeRef = useRef<GraphHistoryStore | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastAppendRef = useRef<LastAppendSignature | null>(null);
  const wasRecordingRef = useRef(false);
  const [version, setVersion] = useState(0);

  if (storeRef.current == null) {
    storeRef.current = new GraphHistoryStore();
  }
  if (startTimeRef.current == null) {
    startTimeRef.current = performance.now();
  }

  // 기록 시작 시점(recipe timer 시작)에 시간 원점을 재설정하여
  // 그래프 elapsed가 recipe elapsedSec(=0)와 정렬되도록 한다.
  useEffect(() => {
    if (recording && !wasRecordingRef.current) {
      startTimeRef.current = performance.now();
      lastAppendRef.current = null;
    }
    wasRecordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    // 기록 중이 아닐 때(예: recipe timer 시작 전 / 완료 후)는 누적하지 않는다.
    if (!recording) return;
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
  }, [temperatureState, recording]);

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
