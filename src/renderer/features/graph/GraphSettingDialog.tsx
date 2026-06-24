import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';
import { GRAPH_SERIES_CATALOG, GRAPH_SERIES_BY_KEY } from './graphSeriesCatalog';
import {
  LINE_STYLE_OPTIONS,
  LINE_WIDTH_OPTIONS,
  PLOT_COLOR_PALETTE,
  type GraphLineStyle,
  type GraphSeriesGroup,
  type GraphSeriesKey,
  type GraphTileConfig,
  type SeriesPlotStyle,
} from './graphTypes';
import { generateTileId, resolveSeriesStyle } from './graphUtils';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import { GraphPreviewChart } from './GraphPreviewChart';

interface GraphSettingDialogProps {
  initialConfig?: GraphTileConfig;
  onSave: (config: GraphTileConfig) => void;
  onClose: () => void;
}

const GROUPS: GraphSeriesGroup[] = [
  'Temperature',
  'Power',
  // TODO: 'Flow Rate', 'Pressure', 'Humidity', 'Electrical', 'Vacuum'
];

export function GraphSettingDialog({
  initialConfig,
  onSave,
  onClose,
}: GraphSettingDialogProps): ReactElement {
  const [selectedGroup, setSelectedGroup] = useState<GraphSeriesGroup>(
    initialConfig && initialConfig.selectedSeries.length > 0
      ? GRAPH_SERIES_BY_KEY[initialConfig.selectedSeries[0]].group
      : 'Temperature',
  );

  // plotted: series that are in the "Plots" (right) list
  const [plottedSeries, setPlottedSeries] = useState<GraphSeriesKey[]>(
    initialConfig?.selectedSeries ?? ['temperature_pv', 'temperature_sv'],
  );

  // per-series style overrides (color / width / line style)
  const [seriesStyles, setSeriesStyles] = useState<
    Partial<Record<GraphSeriesKey, SeriesPlotStyle>>
  >(() => {
    const initial: Partial<Record<GraphSeriesKey, SeriesPlotStyle>> = {};
    const base = initialConfig?.selectedSeries ?? [
      'temperature_pv',
      'temperature_sv',
    ];
    base.forEach((key) => {
      initial[key] = resolveSeriesStyle(key, initialConfig?.seriesStyles);
    });
    return initial;
  });

  // selected index in the left listbox (available series)
  const [leftSelected, setLeftSelected] = useState<number | null>(null);
  // selected index in the right listbox (plots)
  const [rightSelected, setRightSelected] = useState<number | null>(null);
  // whether the color palette popup is open
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // series available on the left panel (group filtered, not yet plotted)
  const availableSeries = useMemo(
    () =>
      GRAPH_SERIES_CATALOG.filter(
        (s) => s.group === selectedGroup,
      ),
    [selectedGroup],
  );

  // When group changes, filter out series that don't belong to the new group
  useEffect(() => {
    setPlottedSeries((current) =>
      current.filter(
        (key) => GRAPH_SERIES_BY_KEY[key].group === selectedGroup,
      ),
    );
    setLeftSelected(null);
    setRightSelected(null);
    setColorPickerOpen(false);
  }, [selectedGroup]);

  const selectedKey =
    rightSelected !== null ? plottedSeries[rightSelected] ?? null : null;
  const selectedStyle =
    selectedKey !== null ? resolveSeriesStyle(selectedKey, seriesStyles) : null;

  const handleAdd = (): void => {
    if (leftSelected === null) return;
    const series = availableSeries[leftSelected];
    if (series && !plottedSeries.includes(series.key)) {
      setPlottedSeries((prev) => [...prev, series.key]);
      setSeriesStyles((prev) => ({
        ...prev,
        [series.key]: resolveSeriesStyle(series.key, prev),
      }));
    }
    setLeftSelected(null);
  };

  const handleRemove = (): void => {
    if (rightSelected === null) return;
    setPlottedSeries((prev) => prev.filter((_, i) => i !== rightSelected));
    setRightSelected(null);
    setColorPickerOpen(false);
  };

  const handleClear = (): void => {
    setPlottedSeries([]);
    setRightSelected(null);
    setColorPickerOpen(false);
  };

  const updateSelectedStyle = (patch: Partial<SeriesPlotStyle>): void => {
    if (selectedKey === null) return;
    setSeriesStyles((prev) => ({
      ...prev,
      [selectedKey]: {
        ...resolveSeriesStyle(selectedKey, prev),
        ...patch,
      },
    }));
  };

  const handleApply = (): void => {
    if (plottedSeries.length === 0) {
      alert('최소 하나의 데이터를 선택해야 합니다.');
      return;
    }

    // keep only styles for currently plotted series
    const styles: Partial<Record<GraphSeriesKey, SeriesPlotStyle>> = {};
    plottedSeries.forEach((key) => {
      styles[key] = resolveSeriesStyle(key, seriesStyles);
    });

    const config: GraphTileConfig = {
      id: initialConfig?.id ?? generateTileId(),
      title: initialConfig?.title ?? `Graph ${selectedGroup}`,
      xAxis: 'time',
      selectedSeries: plottedSeries,
      seriesStyles: styles,
    };

    onSave(config);
  };

  return (
    <div
      className="gs-overlay"
      onClick={onClose}
    >
      <div
        className="gs-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className="gs-dialog__header">
          <span className="gs-dialog__title">Graph Setting</span>
          <button
            className="gs-dialog__close-btn"
            onClick={onClose}
            type="button"
            title="Close"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {getIconGlyph('close')}
            </span>
          </button>
        </header>

        {/* ── Body: preview (left) | settings (right) ── */}
        <div className="gs-dialog__body">

          {/* ── Preview column ── */}
          <div className="gs-preview-col">
            <div className="gs-section-title">Preview</div>
            <GraphPreviewChart
              plottedSeries={plottedSeries}
              seriesStyles={seriesStyles}
            />
          </div>

          {/* ── Settings column ── */}
          <div className="gs-settings-col">

          {/* ── Top row: axis settings ── */}
          <div className="gs-dialog__top-row">
            {/* X-Axis */}
            <div className="gs-axis-panel">
              <div className="gs-axis-panel__title">X Axis</div>
              <div className="gs-axis-panel__row">
                <span className="gs-label">Data</span>
                <div className="gs-readonly-value">Time [s]</div>
              </div>
            </div>

            {/* Y-Axis */}
            <div className="gs-axis-panel">
              <div className="gs-axis-panel__title">Y Axis</div>
              <div className="gs-axis-panel__row">
                <span className="gs-label">Data Group</span>
                <select
                  className="gs-select"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value as GraphSeriesGroup)}
                >
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Mid row: data list | plots ── */}
          <div className="gs-dialog__mid-row">

            {/* Left panel: Data List */}
            <div className="gs-panel">
              <div className="gs-panel__title">Data List</div>
              <div className="gs-panel__main">
                <div className="gs-listbox-wrap">
                  <ul className="gs-listbox">
                    {availableSeries.map((series, i) => (
                      <li
                        key={series.key}
                        className={`gs-listbox__item${leftSelected === i ? ' gs-listbox__item--selected' : ''}`}
                        onClick={() => setLeftSelected(i === leftSelected ? null : i)}
                      >
                        <span
                          className="gs-series-dot"
                          style={{ backgroundColor: series.color }}
                        />
                        {series.label}
                      </li>
                    ))}
                    {availableSeries.length === 0 && (
                      <li className="gs-listbox__empty">선택 가능한 데이터 없음</li>
                    )}
                  </ul>
                </div>

                <div className="gs-panel__buttons">
                  <button
                    type="button"
                    className="gs-btn"
                    onClick={handleAdd}
                    disabled={
                      leftSelected === null ||
                      plottedSeries.includes(availableSeries[leftSelected]?.key ?? '')
                    }
                  >
                    Add →
                  </button>
                  <button
                    type="button"
                    className="gs-btn"
                    onClick={handleRemove}
                    disabled={rightSelected === null}
                  >
                    ← Remove
                  </button>
                  <button
                    type="button"
                    className="gs-btn"
                    onClick={handleClear}
                    disabled={plottedSeries.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Right panel: Plots */}
            <div className="gs-panel">
              <div className="gs-panel__title">Plots</div>
              <div className="gs-panel__main">
                <div className="gs-listbox-wrap">
                  <ul className="gs-listbox">
                    {plottedSeries.map((key, i) => {
                      const def = GRAPH_SERIES_BY_KEY[key];
                      const style = resolveSeriesStyle(key, seriesStyles);
                      return (
                        <li
                          key={key}
                          className={`gs-listbox__item${rightSelected === i ? ' gs-listbox__item--selected' : ''}`}
                          onClick={() => {
                            setRightSelected(i === rightSelected ? null : i);
                            setColorPickerOpen(false);
                          }}
                        >
                          <span
                            className="gs-series-dot"
                            style={{ backgroundColor: style.color }}
                          />
                          {def?.label ?? key}
                        </li>
                      );
                    })}
                    {plottedSeries.length === 0 && (
                      <li className="gs-listbox__empty">추가된 데이터 없음</li>
                    )}
                  </ul>
                </div>

                {/* Line style controls */}
                <div className="gs-style-section">
                  <div className="gs-style-section__title">Line Style</div>
                  {selectedKey !== null && selectedStyle !== null ? (
                    <div className="gs-style-controls">
                      <span className="gs-style-controls__name">
                        {GRAPH_SERIES_BY_KEY[selectedKey]?.label ?? selectedKey}
                      </span>

                      {/* Style */}
                      <label className="gs-style-field">
                        <span className="gs-style-field__label">Style</span>
                        <select
                          className="gs-style-select"
                          value={selectedStyle.style}
                          onChange={(e) =>
                            updateSelectedStyle({
                              style: e.target.value as GraphLineStyle,
                            })
                          }
                        >
                          {LINE_STYLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Width */}
                      <label className="gs-style-field">
                        <span className="gs-style-field__label">Width</span>
                        <select
                          className="gs-style-select"
                          value={String(selectedStyle.width)}
                          onChange={(e) =>
                            updateSelectedStyle({ width: Number(e.target.value) })
                          }
                        >
                          {LINE_WIDTH_OPTIONS.map((w) => (
                            <option key={w} value={String(w)}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Color */}
                      <div className="gs-style-field">
                        <span className="gs-style-field__label">Color</span>
                        <div className="gs-color-wrap">
                          <button
                            type="button"
                            className="gs-color-swatch"
                            style={{ backgroundColor: selectedStyle.color }}
                            onClick={() => setColorPickerOpen((v) => !v)}
                            title="Pick color"
                          />
                          {colorPickerOpen && (
                            <div className="gs-color-palette">
                              {PLOT_COLOR_PALETTE.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`gs-color-cell${selectedStyle.color.toLowerCase() === color.toLowerCase() ? ' gs-color-cell--active' : ''}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => {
                                    updateSelectedStyle({ color });
                                    setColorPickerOpen(false);
                                  }}
                                  title={color}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="gs-style-hint">Plots에서 항목을 선택하세요</p>
                  )}
                </div>
              </div>
            </div>

          </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="gs-dialog__footer">
          {plottedSeries.length === 0 && (
            <span className="gs-dialog__error">
              최소 하나의 데이터를 추가하세요
            </span>
          )}
          <div className="gs-dialog__footer-buttons">
            <button
              type="button"
              className="gs-footer-btn gs-footer-btn--cancel"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="gs-footer-btn gs-footer-btn--apply"
              onClick={handleApply}
              disabled={plottedSeries.length === 0}
            >
              Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

