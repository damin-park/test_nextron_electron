import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type {
  GraphSeriesKey,
  SeriesPlotStyle,
} from './graphTypes';
import { GRAPH_SERIES_BY_KEY } from './graphSeriesCatalog';
import { buildPreviewData, lineStyleToDash, resolveSeriesStyle } from './graphUtils';

interface GraphPreviewChartProps {
  /** Series currently plotted, in order */
  plottedSeries: GraphSeriesKey[];
  /** Per-series style overrides */
  seriesStyles: Partial<Record<GraphSeriesKey, SeriesPlotStyle>>;
}

interface PreviewSize {
  width: number;
  height: number;
}

/**
 * Lightweight uPlot preview chart for the Graph Setting dialog.
 * Renders synthetic curves so the user can preview the effect of the
 * configured colors, line widths and line styles before applying.
 */
export function GraphPreviewChart({
  plottedSeries,
  seriesStyles,
}: GraphPreviewChartProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [size, setSize] = useState<PreviewSize>({ width: 0, height: 0 });

  // Signature changes whenever the series list or any style changes.
  const signature = plottedSeries
    .map((key) => {
      const s = resolveSeriesStyle(key, seriesStyles);
      return `${key}:${s.color}:${s.width}:${s.style}`;
    })
    .join('|');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container == null) return undefined;

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (host == null || size.width <= 0 || size.height <= 0) return undefined;

    plotRef.current?.destroy();
    host.innerHTML = '';

    const data = buildPreviewData(plottedSeries.length);

    const options: uPlot.Options = {
      width: size.width,
      height: size.height,
      padding: [10, 12, 0, 0],
      legend: { show: plottedSeries.length > 0 },
      cursor: { show: false },
      scales: {
        x: { time: false },
      },
      axes: [
        {
          stroke: '#B8B8B8',
          grid: { stroke: '#2A2A2A', width: 1 },
          ticks: { stroke: '#555555', width: 1 },
          font: '10px Roboto, sans-serif',
        },
        {
          stroke: '#B8B8B8',
          grid: { stroke: '#2A2A2A', width: 1 },
          ticks: { stroke: '#555555', width: 1 },
          font: '10px Roboto, sans-serif',
        },
      ],
      series: [
        { label: 'X' },
        ...plottedSeries.map((key) => {
          const style = resolveSeriesStyle(key, seriesStyles);
          const def = GRAPH_SERIES_BY_KEY[key];
          return {
            label: def?.label ?? key,
            stroke: style.color,
            width: style.width,
            dash: lineStyleToDash(style.style),
            points: { show: false },
            spanGaps: false,
          };
        }),
      ],
    };

    const plot = new uPlot(options, data, host);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      if (plotRef.current === plot) plotRef.current = null;
    };
  }, [size.width, size.height, signature]);

  return (
    <div className="gs-preview" ref={containerRef}>
      {plottedSeries.length === 0 ? (
        <div className="gs-preview__empty">데이터를 추가하면 미리보기가 표시됩니다</div>
      ) : (
        <div className="gs-preview__host" ref={hostRef} />
      )}
    </div>
  );
}
