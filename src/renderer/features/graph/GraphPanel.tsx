import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import type {
  RecipeGraphState,
  RecipeProfilePoint,
} from '../recipe/recipeTypes';
import {
  GRAPH_SERIES_BY_KEY,
} from './graphSeriesCatalog';
import type {
  GraphDisplayData,
  GraphLayoutConfig,
  GraphSeriesKey,
  GraphSeriesValue,
  GraphTileConfig,
} from './graphTypes';
import { DEFAULT_GRAPH_LAYOUT } from './graphTypes';
import { UPlotGraphTile } from './UPlotGraphTile';
import { useGraphHistory } from './useGraphHistory';
import { GraphSettingDialog } from './GraphSettingDialog';
import {
  loadGraphLayout,
  saveGraphLayout,
} from './graphLayoutPersistence';
import { getLayoutGridClass } from './graphUtils';
import { getIconGlyph } from '../../shared/icons/materialSymbols';

interface GraphPanelProps {
  temperatureState: TemperatureDeviceState | null;
  recipeGraphState: RecipeGraphState;
}

interface XRange {
  min: number | null;
  max: number | null;
}

type EditMode = 'none' | 'edit' | 'delete';
type DialogMode = 'closed' | 'add' | 'edit';

export function GraphPanel({
  temperatureState,
  recipeGraphState,
}: GraphPanelProps): ReactElement {
  const graphHistory = useGraphHistory(temperatureState);
  const [layout, setLayout] = useState<GraphLayoutConfig>(() => {
    const loaded = loadGraphLayout();
    return loaded ?? DEFAULT_GRAPH_LAYOUT;
  });
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(
    null,
  );
  const [manualXRange, setManualXRange] = useState<XRange | null>(null);

  // Save layout whenever it changes
  useLayoutEffect(() => {
    saveGraphLayout(layout);
  }, [layout]);

  const handleAddGraph = (): void => {
    if (layout.tiles.length >= 6) {
      alert('최대 6개까지만 추가할 수 있습니다.');
      return;
    }
    setSelectedTileIndex(null);
    setDialogMode('add');
  };

  const handleEditClick = (index: number): void => {
    if (editMode === 'edit') {
      setSelectedTileIndex(index);
      setDialogMode('edit');
      setEditMode('none');
    }
  };

  const handleDeleteClick = (index: number): void => {
    if (editMode === 'delete') {
      setLayout((current) => ({
        ...current,
        tiles: current.tiles.filter((_, i) => i !== index),
      }));
      setEditMode('none');
    }
  };

  const handleSaveGraphConfig = (config: GraphTileConfig): void => {
    setLayout((current) => {
      if (selectedTileIndex !== null) {
        // Edit mode
        const newTiles = [...current.tiles];
        newTiles[selectedTileIndex] = {
          ...newTiles[selectedTileIndex],
          ...config,
        };
        return { ...current, tiles: newTiles };
      } else {
        // Add mode
        return {
          ...current,
          tiles: [...current.tiles, config],
        };
      }
    });
    setDialogMode('closed');
    setSelectedTileIndex(null);
  };

  const handleDialogClose = (): void => {
    setDialogMode('closed');
    setSelectedTileIndex(null);
  };

  const clearHistory = (): void => {
    graphHistory.clear();
    setManualXRange(null);
  };

  const resetXRange = (): void => {
    setManualXRange(null);
  };

  const toggleEditMode = (): void => {
    setEditMode((current) => (current === 'edit' ? 'none' : 'edit'));
  };

  const toggleDeleteMode = (): void => {
    setEditMode((current) => (current === 'delete' ? 'none' : 'delete'));
  };

  return (
    <div className="graph-panel">
      <header className="graph-panel__header">
        {/* Left: icon buttons (Tkinter style: add, delete, edit, replay) */}
        <div className="graph-panel__icon-buttons">
          <button
            type="button"
            className="graph-panel__icon-btn"
            title="Add Graph"
            onClick={handleAddGraph}
            disabled={layout.tiles.length >= 6}
          >
            <span className="material-symbols-outlined graph-panel__icon-glyph">
              {getIconGlyph('add')}
            </span>
          </button>

          <button
            type="button"
            className={`graph-panel__icon-btn${editMode === 'delete' ? ' graph-panel__icon-btn--active' : ''}`}
            title="Delete Graph"
            onClick={toggleDeleteMode}
            disabled={layout.tiles.length === 0}
          >
            <span className="material-symbols-outlined graph-panel__icon-glyph">
              {getIconGlyph('delete')}
            </span>
          </button>

          <button
            type="button"
            className={`graph-panel__icon-btn${editMode === 'edit' ? ' graph-panel__icon-btn--active' : ''}`}
            title="Edit Graph"
            onClick={toggleEditMode}
            disabled={layout.tiles.length === 0}
          >
            <span className="material-symbols-outlined graph-panel__icon-glyph">
              {getIconGlyph('edit')}
            </span>
          </button>

          <button
            type="button"
            className="graph-panel__icon-btn"
            title="Clear History"
            onClick={clearHistory}
            disabled={graphHistory.pointCount === 0}
          >
            <span className="material-symbols-outlined graph-panel__icon-glyph">
              {getIconGlyph('replay')}
            </span>
          </button>
        </div>

        {/* Mode hint (Tkinter: FFC857 gold text, left-padded) */}
        {editMode !== 'none' && (
          <span className="graph-panel__mode-hint">
            {editMode === 'edit' ? 'Click a graph to edit' : 'Click a graph to delete'}
          </span>
        )}

        {/* Spacer */}
        <div className="graph-panel__header-spacer" />

        {/* Right: data info + zoom reset */}
        <span className="graph-panel__meta">
          {graphHistory.pointCount.toLocaleString()} pts
        </span>
        <button
          type="button"
          className="graph-panel__text-btn"
          onClick={resetXRange}
          disabled={manualXRange == null}
        >
          Reset Zoom
        </button>
      </header>

      <div className={`graph-panel__tiles ${getLayoutGridClass(layout.tiles.length)}`}>
        {layout.tiles.length === 0 ? (
          <div className="graph-panel__empty-state">
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#444' }}>
              {getIconGlyph('add')}
            </span>
            <p>그래프가 없습니다.</p>
            <p>+ 버튼을 클릭하여 그래프를 추가하세요.</p>
          </div>
        ) : (
          layout.tiles.map((tileConfig, index) => (
            <GraphTileWrapper
              key={tileConfig.id}
              config={tileConfig}
              graphHistory={graphHistory}
              recipeGraphState={recipeGraphState}
              manualXRange={manualXRange}
              onXRangeChange={(min, max) => setManualXRange({ min, max })}
              onEdit={() => handleEditClick(index)}
              onDelete={() => handleDeleteClick(index)}
              editMode={editMode}
            />
          ))
        )}
      </div>

      {dialogMode !== 'closed' && (
        <GraphSettingDialog
          initialConfig={
            selectedTileIndex !== null
              ? layout.tiles[selectedTileIndex]
              : undefined
          }
          onSave={handleSaveGraphConfig}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}

interface GraphTileWrapperProps {
  config: GraphTileConfig;
  graphHistory: ReturnType<typeof useGraphHistory>;
  recipeGraphState: RecipeGraphState;
  manualXRange: XRange | null;
  onXRangeChange: (min: number, max: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  editMode: EditMode;
}

function GraphTileWrapper({
  config,
  graphHistory,
  recipeGraphState,
  manualXRange,
  onXRangeChange,
  onEdit,
  onDelete,
  editMode,
}: GraphTileWrapperProps): ReactElement {
  const [panelWidth, setPanelWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container == null) return undefined;

    const updateWidth = (): void => {
      const rect = container.getBoundingClientRect();
      setPanelWidth(Math.max(1, Math.floor(rect.width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const displayRange = manualXRange ?? graphHistory.xRange;
  const displayData = useMemo(
    () => {
      const data = graphHistory.getDisplayData(
        config.selectedSeries,
        displayRange.min,
        displayRange.max,
        panelWidth,
      );
      return mergeRecipeProfileData(
        data,
        config.selectedSeries,
        recipeGraphState.profile,
        displayRange.min,
        displayRange.max,
      );
    },
    [
      config.selectedSeries,
      displayRange.max,
      displayRange.min,
      graphHistory,
      panelWidth,
      recipeGraphState.profile,
    ],
  );

  const seriesDefinitions = useMemo(
    () =>
      config.selectedSeries
        .map((key) => GRAPH_SERIES_BY_KEY[key])
        .filter((def) => def !== undefined),
    [config.selectedSeries],
  );

  const handleTileClick = (): void => {
    if (editMode === 'edit') {
      onEdit();
      return;
    }

    if (editMode === 'delete') {
      onDelete();
    }
  };

  const handleTileKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (editMode !== 'edit' && editMode !== 'delete') return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleTileClick();
  };

  return (
    <div
      className={`graph-tile ${editMode === 'edit' || editMode === 'delete' ? 'graph-tile--selectable' : ''}`}
      ref={containerRef}
      onClick={handleTileClick}
      onKeyDown={handleTileKeyDown}
      role={editMode === 'edit' || editMode === 'delete' ? 'button' : undefined}
      tabIndex={editMode === 'edit' || editMode === 'delete' ? 0 : undefined}
    >
      <UPlotGraphTile
        title={config.title}
        series={seriesDefinitions}
        data={displayData}
        seriesStyles={config.seriesStyles}
        verticalLineX={recipeGraphState.elapsedSec}
        onXRangeChange={onXRangeChange}
      />
    </div>
  );
}

function mergeRecipeProfileData(
  data: GraphDisplayData,
  seriesKeys: readonly GraphSeriesKey[],
  profile: readonly RecipeProfilePoint[],
  xMin: number | null | undefined,
  xMax: number | null | undefined,
): GraphDisplayData {
  const profileIndex = seriesKeys.indexOf('temperature_total_profile');
  if (profileIndex < 0 || profile.length === 0) return data;

  const existingX = data[0] ?? [];
  const profileX = sampleRecipeProfileX(profile, xMin, xMax);
  const xSet = new Set<number>(existingX);
  profileX.forEach((x) => xSet.add(x));

  const alignedX = Array.from(xSet).sort((a, b) => a - b);
  if (alignedX.length === 0) {
    return [[], ...seriesKeys.map(() => [])];
  }

  const existingMaps = seriesKeys.map((_, seriesIndex) => {
    const y = data[seriesIndex + 1] ?? [];
    const values = new Map<number, GraphSeriesValue>();
    existingX.forEach((x, index) => values.set(x, y[index] ?? null));
    return values;
  });

  const ySeries = seriesKeys.map((key, seriesIndex) => {
    if (key === 'temperature_total_profile') {
      return alignedX.map((x) => interpolateRecipeProfile(profile, x));
    }
    const existingMap = existingMaps[seriesIndex];
    return alignedX.map((x) => existingMap.get(x) ?? null);
  });

  return [alignedX, ...ySeries];
}

function sampleRecipeProfileX(
  profile: readonly RecipeProfilePoint[],
  xMin: number | null | undefined,
  xMax: number | null | undefined,
): number[] {
  if (profile.length === 0) return [];
  const first = profile[0].timeSec;
  const last = profile[profile.length - 1].timeSec;
  const min = xMin == null ? first : Math.max(first, xMin);
  const max = xMax == null ? last : Math.min(last, xMax);
  if (max < min) return [];

  const points = profile
    .map((point) => point.timeSec)
    .filter((time) => time >= min && time <= max);
  points.push(min, max);
  return Array.from(new Set(points)).sort((a, b) => a - b);
}

function interpolateRecipeProfile(
  profile: readonly RecipeProfilePoint[],
  x: number,
): GraphSeriesValue {
  if (profile.length === 0) return null;
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (x < first.timeSec || x > last.timeSec) return null;
  if (Math.abs(x - first.timeSec) < 0.000001) return first.value;

  for (let index = 1; index < profile.length; index += 1) {
    const prev = profile[index - 1];
    const next = profile[index];
    if (x > next.timeSec) continue;
    if (Math.abs(next.timeSec - prev.timeSec) < 0.000001) {
      return next.value;
    }
    const ratio = (x - prev.timeSec) / (next.timeSec - prev.timeSec);
    return prev.value + (next.value - prev.value) * ratio;
  }

  return last.value;
}
