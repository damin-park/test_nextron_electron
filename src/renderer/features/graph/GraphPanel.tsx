import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import {
  DEFAULT_VISIBLE_GRAPH_SERIES,
  GRAPH_SERIES_BY_KEY,
  TEMPERATURE_GRAPH_SERIES,
} from './graphSeriesCatalog';
import type { GraphSeriesKey } from './graphTypes';
import { UPlotGraphTile } from './UPlotGraphTile';
import { useGraphHistory } from './useGraphHistory';

interface GraphPanelProps {
  temperatureState: TemperatureDeviceState | null;
}

interface XRange {
  min: number | null;
  max: number | null;
}

export function GraphPanel({ temperatureState }: GraphPanelProps): ReactElement {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(1000);
  const [visibleSeries, setVisibleSeries] = useState<GraphSeriesKey[]>(
    DEFAULT_VISIBLE_GRAPH_SERIES,
  );
  const [manualXRange, setManualXRange] = useState<XRange | null>(null);
  const graphHistory = useGraphHistory(temperatureState);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body == null) return undefined;

    const updateWidth = (): void => {
      const rect = body.getBoundingClientRect();
      setPanelWidth(Math.max(1, Math.floor(rect.width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(body);

    return () => observer.disconnect();
  }, []);

  const temperatureVisibleSeries = useMemo(
    () =>
      TEMPERATURE_GRAPH_SERIES.filter((series) =>
        visibleSeries.includes(series.key),
      ),
    [visibleSeries],
  );

  const displayRange = manualXRange ?? graphHistory.xRange;
  const displayData = useMemo(
    () =>
      graphHistory.getDisplayData(
        temperatureVisibleSeries.map((series) => series.key),
        displayRange.min,
        displayRange.max,
        panelWidth,
      ),
    [
      displayRange.max,
      displayRange.min,
      graphHistory,
      panelWidth,
      temperatureVisibleSeries,
    ],
  );

  const toggleSeries = (seriesKey: GraphSeriesKey): void => {
    setVisibleSeries((current) => {
      if (current.includes(seriesKey)) {
        return current.filter((key) => key !== seriesKey);
      }
      return [...current, seriesKey];
    });
  };

  const clearHistory = (): void => {
    graphHistory.clear();
    setManualXRange(null);
  };

  const handleXRangeChange = useCallback((min: number, max: number): void => {
    setManualXRange({ min, max });
  }, []);

  const resetXRange = (): void => {
    setManualXRange(null);
  };

  return (
    <div className="graph-panel">
      <header className="graph-panel__header">
        <div className="graph-panel__title">Graph Panel</div>
        <div className="graph-panel__meta">
          {graphHistory.pointCount.toLocaleString()} pts
        </div>
        <button
          type="button"
          className="graph-panel__button"
          onClick={resetXRange}
          disabled={manualXRange == null}
        >
          Reset Zoom
        </button>
        <button
          type="button"
          className="graph-panel__button graph-panel__button--danger"
          onClick={clearHistory}
          disabled={graphHistory.pointCount === 0}
        >
          Clear
        </button>
      </header>

      <div className="graph-panel__controls">
        {TEMPERATURE_GRAPH_SERIES.map((series) => (
          <label key={series.key} className="graph-panel__series-toggle">
            <input
              type="checkbox"
              checked={visibleSeries.includes(series.key)}
              onChange={() => toggleSeries(series.key)}
            />
            <span
              className="graph-panel__series-swatch"
              style={{ backgroundColor: series.color }}
            />
            <span>{GRAPH_SERIES_BY_KEY[series.key].label}</span>
          </label>
        ))}
      </div>

      <div className="graph-panel__body" ref={bodyRef}>
        <UPlotGraphTile
          title="Temperature"
          unitLabel="Temperature [°C]"
          series={temperatureVisibleSeries}
          data={displayData}
          onXRangeChange={handleXRangeChange}
        />
      </div>
    </div>
  );
}
