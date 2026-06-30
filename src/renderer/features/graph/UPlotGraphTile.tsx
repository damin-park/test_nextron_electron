import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
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
import { savePngImage } from '../../services/backendConnection';
import { getIconGlyph } from '../../shared/icons/materialSymbols';

export interface UPlotGraphTileProps {
  title: string;
  series: GraphSeriesDefinition[];
  data: GraphDisplayData;
  /** Optional per-series style overrides (color / width / line style) */
  seriesStyles?: Partial<Record<GraphSeriesKey, SeriesPlotStyle>>;
  /** Optional fixed plot height. When omitted, the tile uses its available height. */
  height?: number;
  verticalLineX?: number | null;
  onXRangeChange?: (min: number, max: number) => void;
  onXRangeReset?: () => void;
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

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .replace(/\s+/g, '_');
  return sanitized.length > 0 ? sanitized : 'graph';
}

function canvasToPngDataUrl(sourceCanvas: HTMLCanvasElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const context = canvas.getContext('2d');
  if (context == null) {
    throw new Error('Unable to create PNG canvas.');
  }

  context.fillStyle = '#151515';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0);
  return canvas.toDataURL('image/png');
}

export function UPlotGraphTile({
  title,
  series,
  data,
  seriesStyles,
  height,
  verticalLineX,
  onXRangeChange,
  onXRangeReset,
  onEdit,
  onDelete,
}: UPlotGraphTileProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotHostRef = useRef<HTMLDivElement | null>(null);
  const legendHostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const onXRangeChangeRef = useRef(onXRangeChange);
  const verticalLineXRef = useRef(verticalLineX);
  const seriesVisibilityRef = useRef<Partial<Record<GraphSeriesKey, boolean>>>({});
  const [size, setSize] = useState<PlotSize>({ width: 0, height: height ?? 0 });

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

  useEffect(() => {
    verticalLineXRef.current = verticalLineX;
    plotRef.current?.redraw(false, false);
  }, [verticalLineX]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const plotHost = plotHostRef.current;
    if (container == null) return undefined;

    const updateSize = (): void => {
      const rect = (plotHost ?? container).getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(height ?? rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    if (plotHost != null) observer.observe(plotHost);

    return () => observer.disconnect();
  }, [height]);

  useEffect(() => {
    const host = plotHostRef.current;
    const legendHost = legendHostRef.current;
    if (host == null || !canRender) return undefined;

    plotRef.current?.destroy();
    host.innerHTML = '';
    if (legendHost != null) legendHost.innerHTML = '';
    const initialData = data.length > 0 ? data : buildEmptyData(series.length);

    const options: uPlot.Options = {
      width: size.width,
      height: size.height,
      padding: [8, 8, 0, 0],
      legend: {
        show: true,
        mount: (_plot, element) => {
          if (legendHost == null) return;
          legendHost.innerHTML = '';
          legendHost.appendChild(element);
        },
      },
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
        draw: [
          (plot) => {
            const x = verticalLineXRef.current;
            if (x == null || !Number.isFinite(x)) return;
            const left = plot.valToPos(x, 'x', true);
            const bbox = plot.bbox;
            const ctx = plot.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = '#FFC857';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(left, bbox.top);
            ctx.lineTo(left, bbox.top + bbox.height);
            ctx.stroke();
            ctx.restore();
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

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    const plot = plotRef.current;
    const handleXRangeChange = onXRangeChangeRef.current;
    const host = plotHostRef.current;
    if (plot == null || handleXRangeChange == null || host == null) return;

    const min = plot.scales.x.min;
    const max = plot.scales.x.max;
    if (
      min == null ||
      max == null ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max
    ) {
      return;
    }

    event.preventDefault();

    const span = max - min;
    if (event.shiftKey) {
      const panDelta = (event.deltaX || event.deltaY) * span * 0.001;
      handleXRangeChange(min + panDelta, max + panDelta);
      return;
    }

    const rect = host.getBoundingClientRect();
    const ratio =
      rect.width > 0
        ? Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
        : 0.5;
    const anchor = min + span * ratio;
    const zoomFactor = event.deltaY < 0 ? 0.82 : 1.18;
    const nextMin = anchor - (anchor - min) * zoomFactor;
    const nextMax = anchor + (max - anchor) * zoomFactor;
    if (nextMax - nextMin <= 0.001) return;
    handleXRangeChange(nextMin, nextMax);
  };

  const handleSavePng = async (
    event: ReactMouseEvent<HTMLButtonElement>,
  ): Promise<void> => {
    event.stopPropagation();
    const canvas = plotHostRef.current?.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      alert('Graph image is not ready.');
      return;
    }

    try {
      await savePngImage({
        dataUrl: canvasToPngDataUrl(canvas),
        defaultFileName: `${sanitizeFileName(title)}.png`,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAutoscale = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onXRangeReset?.();
  };

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
      <div
        className="graph-tile__plot"
        onWheel={handleWheel}
        onDoubleClick={onXRangeReset}
      >
        <div className="graph-tile__axis-actions">
          <button
            type="button"
            className="graph-tile__axis-action"
            title="Save graph as PNG"
            onClick={(event) => void handleSavePng(event)}
          >
            <span className="material-symbols-outlined graph-tile__axis-action-icon">
              {getIconGlyph('image')}
            </span>
          </button>
          <button
            type="button"
            className="graph-tile__axis-action"
            title="Autoscale"
            onClick={handleAutoscale}
          >
            <span className="material-symbols-outlined graph-tile__axis-action-icon">
              {getIconGlyph('rotate_auto')}
            </span>
          </button>
        </div>
        <div className="graph-tile__canvas" ref={plotHostRef} />
        <div className="graph-tile__legend" ref={legendHostRef} />
      </div>
    </section>
  );
}
