import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import {
  manualStartTemperature,
  setTemperatureRunMode,
  setTemperatureStopMode,
  writeTemperatureSetpoint,
} from '../../services/temperatureClient';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';
import {
  MAX_RECIPE_ROWS,
  buildTemperatureRecipePlan,
  createInitialRecipeRows,
  createRecipeRow,
  formatDuration,
  normalizeRecipeRows,
} from './recipeProfile';
import type {
  RecipeGraphState,
  RecipeProfileKind,
  RecipeProfilePoint,
  RecipeProfileTabConfig,
  RecipeRunState,
  TemperatureRecipePlanStep,
  TemperatureRecipeRow,
} from './recipeTypes';

interface RecipePanelProps {
  temperatureConnection: UseTemperatureConnectionResult;
  onGraphStateChange: (state: RecipeGraphState) => void;
}

const DEVICE_ID = 'temperature-1';
const EMPTY_RUN_STATE: RecipeRunState = {
  running: false,
  currentCycle: 0,
  currentStepIndex: -1,
  elapsedSec: 0,
  startedAt: null,
};

const PROFILE_TABS: RecipeProfileTabConfig[] = [
  {
    kind: 'temperature',
    label: 'Temperature',
    unitLabel: 'Temperature [C]',
    enabled: true,
  },
  { kind: 'mfc', label: 'MFC', unitLabel: 'Flow [sccm]', enabled: false },
  { kind: 'humidity', label: 'Humidity', unitLabel: 'Humidity [%RH]', enabled: false },
  { kind: 'pressure', label: 'Pressure', unitLabel: 'Pressure [Torr]', enabled: false },
  { kind: 'chiller', label: 'Chiller', unitLabel: 'Temperature [C]', enabled: false },
];

export function RecipePanel({
  temperatureConnection,
  onGraphStateChange,
}: RecipePanelProps): ReactElement {
  const [rows, setRows] = useState<TemperatureRecipeRow[]>(
    createInitialRecipeRows,
  );
  const [cycleCount, setCycleCount] = useState('1');
  const [runState, setRunState] = useState<RecipeRunState>(EMPTY_RUN_STATE);
  const [runPlan, setRunPlan] = useState<ReturnType<
    typeof buildTemperatureRecipePlan
  > | null>(null);
  const [activeProfileKind, setActiveProfileKind] =
    useState<RecipeProfileKind>('temperature');
  const [message, setMessage] = useState<string | null>(null);
  const cancelRunRef = useRef(false);

  const connected = temperatureConnection.state?.connected === true;
  const initialPv =
    temperatureConnection.state?.pv ??
    temperatureConnection.state?.currentTemperature ??
    null;
  const steps = useMemo(() => normalizeRecipeRows(rows), [rows]);
  const parsedCycleCount = Math.max(1, Number.parseInt(cycleCount, 10) || 1);
  const recipePlan = useMemo(
    () => buildTemperatureRecipePlan(steps, parsedCycleCount, initialPv),
    [initialPv, parsedCycleCount, steps],
  );
  const displayPlan = runPlan ?? recipePlan;
  const activePlanStep =
    runState.currentStepIndex >= 0
      ? displayPlan.planSteps[runState.currentStepIndex] ?? null
      : null;
  const running = runState.running;

  useEffect(() => {
    onGraphStateChange({
      profile: displayPlan.profile,
      elapsedSec: running ? runState.elapsedSec : null,
      running,
    });
  }, [
    onGraphStateChange,
    displayPlan.profile,
    runState.elapsedSec,
    running,
  ]);

  const updateRow = (
    rowId: string,
    key: keyof Omit<TemperatureRecipeRow, 'id'>,
    value: string,
  ): void => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  };

  const addRow = (): void => {
    if (running) return;
    setRows((current) =>
      current.length >= MAX_RECIPE_ROWS
        ? current
        : [...current, createRecipeRow(current.length)],
    );
  };

  const deleteRow = (rowId: string): void => {
    if (running) return;
    setRows((current) =>
      current.length <= 1 ? current : current.filter((row) => row.id !== rowId),
    );
  };

  const resetRows = (): void => {
    if (running) return;
    setRows(createInitialRecipeRows());
    setCycleCount('1');
    setMessage(null);
  };

  const runTemperatureStep = async (
    step: TemperatureRecipePlanStep,
  ): Promise<void> => {
    if (step.tcRampingRate > 0) {
      const response = await manualStartTemperature(DEVICE_ID, {
        setValue: step.tcSetValue,
        rampingRate: step.tcRampingRate,
      });
      if (response.status === 'error') {
        throw new Error(response.error ?? 'Temperature recipe command failed');
      }
      return;
    }

    const setpointResponse = await writeTemperatureSetpoint(
      DEVICE_ID,
      step.tcSetValue,
    );
    if (setpointResponse.status === 'error') {
      throw new Error(setpointResponse.error ?? 'Temperature setpoint failed');
    }
    const runResponse = await setTemperatureRunMode(DEVICE_ID);
    if (runResponse.status === 'error') {
      throw new Error(runResponse.error ?? 'Temperature run mode failed');
    }
  };

  const stopTemperature = async (): Promise<void> => {
    const response = await setTemperatureStopMode(DEVICE_ID);
    if (response.status === 'error') {
      throw new Error(response.error ?? 'Temperature stop failed');
    }
    await temperatureConnection.refreshState();
  };

  const startRecipe = async (): Promise<void> => {
    if (running) return;
    if (!connected) {
      setMessage('Temperature is not connected');
      return;
    }
    if (recipePlan.planSteps.length === 0) {
      setMessage('At least one valid temperature row is required');
      return;
    }

    const planSnapshot = recipePlan;
    cancelRunRef.current = false;
    setRunPlan(planSnapshot);
    const startedAt = performance.now();
    setMessage(null);
    setRunState({
      running: true,
      currentCycle: 1,
      currentStepIndex: 0,
      elapsedSec: 0,
      startedAt,
    });

    try {
      for (
        let planIndex = 0;
        planIndex < planSnapshot.planSteps.length;
        planIndex += 1
      ) {
        if (cancelRunRef.current) break;
        const step = planSnapshot.planSteps[planIndex];
        setRunState((current) => ({
          ...current,
          currentCycle: step.cycleIndex + 1,
          currentStepIndex: planIndex,
          elapsedSec: (performance.now() - startedAt) / 1000,
        }));
        await runTemperatureStep(step);
        await waitUntilRecipeTime(step.endSec, startedAt, () => {
          if (cancelRunRef.current) return false;
          setRunState((current) => ({
            ...current,
            elapsedSec: (performance.now() - startedAt) / 1000,
          }));
          return true;
        });
      }

      if (!cancelRunRef.current) {
        await stopTemperature();
        setMessage('Recipe completed');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      try {
        await stopTemperature();
      } catch {
        // Preserve the original command error in the UI.
      }
    } finally {
      setRunState(EMPTY_RUN_STATE);
      setRunPlan(null);
    }
  };

  const stopRecipe = async (): Promise<void> => {
    if (!running) return;
    cancelRunRef.current = true;
    try {
      await stopTemperature();
      setMessage('Recipe stopped');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunState(EMPTY_RUN_STATE);
      setRunPlan(null);
    }
  };

  return (
    <section className="recipe-panel">
      <div className="recipe-toolbar">
        <div className="recipe-toolbar__actions">
          <button
            type="button"
            className="recipe-icon-button recipe-icon-button--run"
            title="Start recipe"
            disabled={!connected || running || recipePlan.planSteps.length === 0}
            onClick={() => void startRecipe()}
          >
            <span className="material-symbols-outlined recipe-icon-button__glyph">
              {getIconGlyph('play_arrow')}
            </span>
          </button>
          <button
            type="button"
            className="recipe-icon-button recipe-icon-button--stop"
            title="Stop recipe"
            disabled={!running}
            onClick={() => void stopRecipe()}
          >
            <span className="material-symbols-outlined recipe-icon-button__glyph">
              {getIconGlyph('stop')}
            </span>
          </button>
          <button
            type="button"
            className="recipe-icon-button"
            title="New recipe"
            disabled={running}
            onClick={resetRows}
          >
            <span className="material-symbols-outlined recipe-icon-button__glyph">
              {getIconGlyph('replay')}
            </span>
          </button>
        </div>
        <label className="recipe-cycle">
          <span>Cycle</span>
          <input
            className="recipe-cycle__input"
            value={cycleCount}
            onChange={(event) => setCycleCount(event.target.value)}
            disabled={running}
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="recipe-run-summary">
        <div>
          <span className="recipe-run-summary__label">Status</span>
          <span className={running ? 'is-running' : ''}>
            {running ? 'Running' : connected ? 'Ready' : 'Disconnected'}
          </span>
        </div>
        <div>
          <span className="recipe-run-summary__label">Elapsed</span>
          {formatDuration(runState.elapsedSec)}
        </div>
        <div>
          <span className="recipe-run-summary__label">Total</span>
          {formatDuration(displayPlan.totalSec)}
        </div>
        <div>
          <span className="recipe-run-summary__label">Step</span>
          {activePlanStep
            ? `${activePlanStep.rowIndex + 1} / C${activePlanStep.cycleIndex + 1}`
            : '-'}
        </div>
      </div>

      <RecipeProfileViewer
        activeKind={activeProfileKind}
        onActiveKindChange={setActiveProfileKind}
        temperatureProfile={displayPlan.profile}
      />

      <div className="recipe-table-wrap">
        <table className="recipe-table">
          <thead>
            <tr>
              <th>idx</th>
              <th>
                <span>Target</span>
                <span>Temperature</span>
                <span>(C)</span>
              </th>
              <th>
                <span>Ramping</span>
                <span>Rate</span>
                <span>(C/min)</span>
              </th>
              <th>
                <span>Hour</span>
                <span>(h)</span>
              </th>
              <th>
                <span>Minute</span>
                <span>(min)</span>
              </th>
              <th>
                <span>Second</span>
                <span>(s)</span>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <RecipeTableRow
                key={row.id}
                row={row}
                index={index}
                active={activePlanStep?.rowId === row.id}
                disabled={running}
                onChange={updateRow}
                onDelete={deleteRow}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="recipe-table-actions">
        <button
          type="button"
          className="recipe-text-button"
          disabled={running || rows.length >= MAX_RECIPE_ROWS}
          onClick={addRow}
        >
          Add Row
        </button>
        <span className="recipe-table-actions__meta">
          {steps.length} valid rows
        </span>
      </div>

      {(message || !connected) && (
        <div
          className={`recipe-message${
            message === 'Recipe completed' || message === 'Recipe stopped'
              ? ' is-ok'
              : ''
          }`}
        >
          {message ?? 'Temperature is not connected'}
        </div>
      )}
    </section>
  );
}

function RecipeTableRow({
  row,
  index,
  active,
  disabled,
  onChange,
  onDelete,
}: {
  row: TemperatureRecipeRow;
  index: number;
  active: boolean;
  disabled: boolean;
  onChange: (
    rowId: string,
    key: keyof Omit<TemperatureRecipeRow, 'id'>,
    value: string,
  ) => void;
  onDelete: (rowId: string) => void;
}): ReactElement {
  const handleChange =
    (key: keyof Omit<TemperatureRecipeRow, 'id'>) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange(row.id, key, event.target.value);
    };

  return (
    <tr className={active ? 'is-active' : ''}>
      <td className="recipe-table__idx">{index + 1}</td>
      <td>
        <input
          value={row.tcSetValue}
          onChange={handleChange('tcSetValue')}
          disabled={disabled}
          inputMode="decimal"
        />
      </td>
      <td>
        <input
          value={row.tcRampingRate}
          onChange={handleChange('tcRampingRate')}
          disabled={disabled}
          inputMode="decimal"
        />
      </td>
      <td>
        <input
          value={row.hour}
          onChange={handleChange('hour')}
          disabled={disabled}
          inputMode="numeric"
        />
      </td>
      <td>
        <input
          value={row.minute}
          onChange={handleChange('minute')}
          disabled={disabled}
          inputMode="numeric"
        />
      </td>
      <td>
        <input
          value={row.second}
          onChange={handleChange('second')}
          disabled={disabled}
          inputMode="numeric"
        />
      </td>
      <td>
        <button
          type="button"
          className="recipe-row-delete"
          title="Delete row"
          disabled={disabled}
          onClick={() => onDelete(row.id)}
        >
          <span className="material-symbols-outlined">
            {getIconGlyph('delete')}
          </span>
        </button>
      </td>
    </tr>
  );
}

function RecipeProfileViewer({
  activeKind,
  onActiveKindChange,
  temperatureProfile,
}: {
  activeKind: RecipeProfileKind;
  onActiveKindChange: (kind: RecipeProfileKind) => void;
  temperatureProfile: readonly RecipeProfilePoint[];
}): ReactElement {
  const activeTab =
    PROFILE_TABS.find((tab) => tab.kind === activeKind) ?? PROFILE_TABS[0];
  const activeProfile =
    activeTab.kind === 'temperature' ? temperatureProfile : [];

  return (
    <div className="recipe-profile-viewer">
      <div className="recipe-profile-tabs" role="tablist" aria-label="Recipe profile">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={tab.kind === activeTab.kind}
            className={`recipe-profile-tab${
              tab.kind === activeTab.kind ? ' is-active' : ''
            }${tab.enabled ? '' : ' is-disabled'}`}
            onClick={() => onActiveKindChange(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <RecipeProfilePreview
        profile={activeProfile}
        label={activeTab.label}
        unitLabel={activeTab.unitLabel}
        emptyLabel={`${activeTab.label} profile pending`}
      />
    </div>
  );
}

function RecipeProfilePreview({
  profile,
  label,
  unitLabel,
  emptyLabel,
}: {
  profile: readonly RecipeProfilePoint[];
  label: string;
  unitLabel: string;
  emptyLabel: string;
}): ReactElement {
  const path = useMemo(() => buildProfilePath(profile, 280, 120), [profile]);
  return (
    <div className="recipe-profile-preview">
      <svg viewBox="0 0 280 120" role="img" aria-label={`${label} profile preview`}>
        <line x1="28" y1="94" x2="268" y2="94" className="recipe-profile-axis" />
        <line x1="28" y1="14" x2="28" y2="94" className="recipe-profile-axis" />
        <text x="36" y="22" className="recipe-profile-label">
          {label}
        </text>
        <text x="36" y="38" className="recipe-profile-unit">
          {unitLabel}
        </text>
        {path ? (
          <path d={path} className="recipe-profile-line" />
        ) : (
          <text x="140" y="68" textAnchor="middle" className="recipe-profile-empty">
            {emptyLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

function buildProfilePath(
  profile: readonly { timeSec: number; value: number }[],
  width: number,
  height: number,
): string {
  if (profile.length === 0) return '';
  const x0 = 28;
  const y0 = height - 26;
  const plotWidth = width - 40;
  const plotHeight = height - 42;
  const maxTime = Math.max(...profile.map((point) => point.timeSec), 1);
  const values = profile.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 1);

  return profile
    .map((point, index) => {
      const x = x0 + (point.timeSec / maxTime) * plotWidth;
      const y = y0 - ((point.value - minValue) / valueRange) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function waitUntilRecipeTime(
  targetElapsedSec: number,
  startedAt: number,
  onTick: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const tick = (): void => {
      if (!onTick()) {
        resolve();
        return;
      }
      const elapsedSec = (performance.now() - startedAt) / 1000;
      if (elapsedSec >= targetElapsedSec) {
        resolve();
        return;
      }
      window.setTimeout(tick, Math.min(250, (targetElapsedSec - elapsedSec) * 1000));
    };
    tick();
  });
}
