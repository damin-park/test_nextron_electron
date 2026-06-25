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

function formatSeconds(value: number): string {
  return value.toFixed(1);
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
  const onXRangeChangeRef = useRef(onXRangeChange);
  const seriesVisibilityRef = useRef<Partial<Record<GraphSeriesKey, boolean>>>({});
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

  useEffect(() => {
    onXRangeChangeRef.current = onXRangeChange;
  }, [onXRangeChange]);

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
        points: { show: false },
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
          label: 'Time [s]',
          stroke: '#B8B8B8',
          grid: { stroke: '#2A2A2A', width: 1 },
          ticks: { stroke: '#555555', width: 1 },
          values: (_self, splits) => splits.map(formatSeconds),
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
            const handleXRangeChange = onXRangeChangeRef.current;
            if (
              handleXRangeChange != null &&
              selection.width > 0 &&
              Number.isFinite(selection.left)
            ) {
              const min = plot.posToVal(selection.left, 'x');
              const max = plot.posToVal(selection.left + selection.width, 'x');
              if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
                handleXRangeChange(min, max);
              }
            }
          },
        ],
        setSeries: [
          (_plot, seriesIdx, opts) => {
            if (seriesIdx == null || seriesIdx <= 0 || opts.show == null) return;

            const seriesDef = series[seriesIdx - 1];
            if (seriesDef == null) return;

            seriesVisibilityRef.current[seriesDef.key] = opts.show;
          },
        ],
      },
    };

    const plot = new uPlot(options, initialData, host);
    series.forEach((item, index) => {
      const visible = seriesVisibilityRef.current[item.key];
      if (visible != null) {
        plot.setSeries(index + 1, { show: visible }, false);
      }
    });
    plotRef.current = plot;

    return () => {
      plot.destroy();
      if (plotRef.current === plot) plotRef.current = null;
    };
  }, [
    canRender,
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
      </div>
      <div className="graph-tile__plot" ref={plotHostRef} />
    </section>
  );
}
