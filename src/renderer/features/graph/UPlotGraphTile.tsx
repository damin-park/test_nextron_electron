import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type {
  GraphDisplayData,
  GraphSeriesDefinition,
  GraphSeriesKey,
  SeriesPlotStyle,
} from './graphTypes';
import { lineStyleToDash, resolveSeriesStyle } from './graphUtils';

export interface UPlotGraphTileProps {
  title: string;
  series: GraphSeriesDefinition[];
  data: GraphDisplayData;
  /** Optional per-series style overrides (color / width / line style) */
  seriesStyles?: Partial<Record<GraphSeriesKey, SeriesPlotStyle>>;
  height?: number;
  onXRangeChange?: (min: number, max: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface PlotSize {
  width: number;
  height: number;
}

function buildEmptyData(seriesCount: number): GraphDisplayData {
  return [[], ...Array.from({ length: seriesCount }, () => [])];
}

function formatElapsedSeconds(value: number): string {
  if (value >= 3600) return `${(value / 3600).toFixed(2)} h`;
  if (value >= 60) return `${(value / 60).toFixed(1)} min`;
  return `${value.toFixed(1)} s`;
}

export function UPlotGraphTile({
  title,
  series,
  data,
  seriesStyles,
  height = 320,
  onXRangeChange,
  onEdit,
  onDelete,
}: UPlotGraphTileProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotHostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [size, setSize] = useState<PlotSize>({ width: 0, height });

  const unitLabel = useMemo(
    () =>
      series.length > 0
        ? series[0].unitLabel
        : '',
    [series],
  );

  const seriesSignature = useMemo(
    () =>
      series
        .map((item) => {
          const s = resolveSeriesStyle(item.key, seriesStyles);
          return `${item.key}:${s.color}:${s.width}:${s.style}`;
        })
        .join('|'),
    [series, seriesStyles],
  );
  const canRender = size.width > 0 && size.height > 0;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container == null) return undefined;

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [height]);

  useEffect(() => {
    const host = plotHostRef.current;
    if (host == null || !canRender) return undefined;

    plotRef.current?.destroy();
    host.innerHTML = '';
    const initialData = data.length > 0 ? data : buildEmptyData(series.length);

    const options: uPlot.Options = {
      width: size.width,
      height: size.height,
      padding: [8, 8, 0, 0],
      legend: { show: true },
      cursor: {
        drag: {
          x: true,
          y: false,
          setScale: true,
        },
      },
      scales: {
        x: { time: false },
      },
      axes: [
        {
          label: 'Elapsed Time',
          stroke: '#B8B8B8',
          grid: { stroke: '#2A2A2A', width: 1 },
          ticks: { stroke: '#555555', width: 1 },
          values: (_self, splits) => splits.map(formatElapsedSeconds),
        },
        {
          label: unitLabel,
          stroke: '#B8B8B8',
          grid: { stroke: '#2A2A2A', width: 1 },
          ticks: { stroke: '#555555', width: 1 },
        },
      ],
      series: [
        {
          label: 'Time',
        },
        ...series.map((item) => {
          const style = resolveSeriesStyle(item.key, seriesStyles);
          return {
            label: item.label,
            stroke: style.color,
            width: style.width,
            dash: lineStyleToDash(style.style),
            points: { show: false },
            spanGaps: false,
          };
        }),
      ],
      hooks: {
        setSelect: [
          (plot) => {
            const selection = plot.select;
            if (
              onXRangeChange != null &&
              selection.width > 0 &&
              Number.isFinite(selection.left)
            ) {
              const min = plot.posToVal(selection.left, 'x');
              const max = plot.posToVal(selection.left + selection.width, 'x');
              if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
                onXRangeChange(min, max);
              }
            }
          },
        ],
      },
    };

    const plot = new uPlot(options, initialData, host);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      if (plotRef.current === plot) plotRef.current = null;
    };
  }, [
    canRender,
    onXRangeChange,
    series,
    seriesSignature,
    unitLabel,
  ]);

  useEffect(() => {
    const plot = plotRef.current;
    if (plot == null) return;
    plot.setSize({ width: size.width, height: size.height });
  }, [size.height, size.width]);

  useEffect(() => {
    plotRef.current?.setData(
      data.length > 0 ? data : buildEmptyData(series.length),
      true,
    );
  }, [data, series.length]);

  return (
    <section className="graph-tile" ref={containerRef}>
      <div className="graph-tile__header">
        <div className="graph-tile__title-row">
          <div className="graph-tile__title">{title}</div>
          <div className="graph-tile__buttons">
            {onEdit && (
              <button
                className="graph-tile__button graph-tile__button--edit"
                onClick={onEdit}
                title="Edit this graph"
                type="button"
              >
                ✏️
              </button>
            )}
            {onDelete && (
              <button
                className="graph-tile__button graph-tile__button--delete"
                onClick={onDelete}
                title="Delete this graph"
                type="button"
              >
                ❌
              </button>
            )}
          </div>
        </div>
        <div className="graph-tile__unit">{unitLabel}</div>
      </div>
      <div className="graph-tile__plot" ref={plotHostRef} />
    </section>
  );
}


