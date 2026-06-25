import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import type { TemperatureDeviceState } from '../../services/deviceTypes';
import {
  GRAPH_SERIES_BY_KEY,
} from './graphSeriesCatalog';
import type {
  GraphLayoutConfig,
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
}

interface XRange {
  min: number | null;
  max: number | null;
}

type EditMode = 'none' | 'edit' | 'delete';
type DialogMode = 'closed' | 'add' | 'edit';

export function GraphPanel({ temperatureState }: GraphPanelProps): ReactElement {
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
  manualXRange: XRange | null;
  onXRangeChange: (min: number, max: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  editMode: EditMode;
}

function GraphTileWrapper({
  config,
  graphHistory,
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
    () =>
      graphHistory.getDisplayData(
        config.selectedSeries,
        displayRange.min,
        displayRange.max,
        panelWidth,
      ),
    [
      config.selectedSeries,
      displayRange.max,
      displayRange.min,
      graphHistory,
      panelWidth,
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
        onXRangeChange={onXRangeChange}
      />
    </div>
  );
}
