import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import {
  setTemperatureStopMode,
  startTemperatureRecipeStep,
} from '../../services/temperatureClient';
import type { TemperatureRecipeStepStartResponseData } from '../../services/temperatureClient';
import type { UseTemperatureConnectionResult } from '../temperature/useTemperatureConnection';
import {
  MAX_RECIPE_ROWS,
  buildTemperatureRecipePlan,
  createInitialRecipeRows,
  createRecipeRow,
  formatDuration,
  normalizeRecipeRows,
} from './recipeProfile';
import {
  loadRecipeTableState,
  saveRecipeTableState,
  type RecipeTablePersistenceState,
} from './recipePersistence';
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
  onRecipeStart: () => void;
  onRecipeActiveChange: (active: boolean) => void;
}

type TemperatureRecipePlan = ReturnType<typeof buildTemperatureRecipePlan>;
let initialRecipeTableStateCache: RecipeTablePersistenceState | null = null;

const DEVICE_ID = 'temperature-1';
const COMMAND_VALUE_EPSILON = 1e-9;
const STALE_COMMAND_GUARD_SEC = 0.1;
const EMPTY_RUN_STATE: RecipeRunState = {
  running: false,
  status: 'idle',
  currentCycle: 0,
  currentStepIndex: -1,
  elapsedSec: 0,
  startedAt: null,
};

const PROFILE_TABS: RecipeProfileTabConfig[] = [
  {
    kind: 'temperature',
    label: 'Temperature',
    unitLabel: 'Temperature [°C]',
    enabled: true,
  },
  { kind: 'mfc', label: 'MFC', unitLabel: 'Flow [sccm]', enabled: false },
  { kind: 'humidity', label: 'Humidity', unitLabel: 'Humidity [%RH]', enabled: false },
  { kind: 'pressure', label: 'Pressure', unitLabel: 'Pressure [Torr]', enabled: false },
  { kind: 'chiller', label: 'Chiller', unitLabel: 'Temperature [°C]', enabled: false },
];

const PROFILE_PREVIEW_MIN_HEIGHT = 142;
const PROFILE_CHART_MIN_WIDTH = 240;
const PROFILE_CHART_MARGIN = {
  left: 42,
  right: 12,
  top: 12,
  bottom: 30,
};

interface ProfileChartSize {
  width: number;
  height: number;
}

interface ProfilePlotArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface ProfileViewRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface ProfileDragStart {
  clientX: number;
  clientY: number;
  range: ProfileViewRange;
}

interface ProfileResizeStart {
  clientY: number;
  height: number;
}

interface PendingStepReapply {
  token: number;
  stepIndex: number;
}

interface UpdatedRunPlanResult {
  plan: TemperatureRecipePlan;
  activeStepIndex: number;
  activeStep: TemperatureRecipePlanStep;
  shouldReapplyCurrentStep: boolean;
}

function getInitialRecipeTableState(): RecipeTablePersistenceState {
  if (initialRecipeTableStateCache == null) {
    initialRecipeTableStateCache = loadRecipeTableState();
  }
  return initialRecipeTableStateCache;
}

export function RecipePanel({
  temperatureConnection,
  onGraphStateChange,
  onRecipeStart,
  onRecipeActiveChange,
}: RecipePanelProps): ReactElement {
  const initialRecipeTableState = getInitialRecipeTableState();
  const [rows, setRows] = useState<TemperatureRecipeRow[]>(
    initialRecipeTableState.rows,
  );
  const [cycleCount, setCycleCount] = useState(
    initialRecipeTableState.cycleCount,
  );
  const [runState, setRunState] = useState<RecipeRunState>(EMPTY_RUN_STATE);
  const [runPlan, setRunPlan] = useState<TemperatureRecipePlan | null>(null);
  const [activeProfileKind, setActiveProfileKind] =
    useState<RecipeProfileKind>('temperature');
  const [profilePreviewHeight, setProfilePreviewHeight] = useState(
    PROFILE_PREVIEW_MIN_HEIGHT,
  );
  const [message, setMessage] = useState<string | null>(null);
  const cancelRunRef = useRef(false);
  const rowsRef = useRef<TemperatureRecipeRow[]>(rows);
  const runPlanRef = useRef<TemperatureRecipePlan | null>(null);
  const graphStateRef = useRef<RecipeGraphState>({
    profile: [],
    elapsedSec: null,
    running: false,
  });
  const updateTokenRef = useRef(0);
  const pendingStepReapplyRef = useRef<PendingStepReapply | null>(null);

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
  const starting = runState.status === 'starting';
  const busy = running || starting;

  useEffect(() => {
    onRecipeActiveChange(busy);
  }, [busy, onRecipeActiveChange]);

  useEffect(() => {
    if (running) {
      const nextGraphState: RecipeGraphState = {
        profile: displayPlan.profile,
        elapsedSec: runState.elapsedSec,
        running: true,
      };
      graphStateRef.current = nextGraphState;
      onGraphStateChange(nextGraphState);
      return;
    }

    const currentGraphState = graphStateRef.current;
    if (!currentGraphState.running && currentGraphState.elapsedSec == null) {
      return;
    }

    const nextGraphState: RecipeGraphState = {
      ...currentGraphState,
      elapsedSec: null,
      running: false,
    };
    graphStateRef.current = nextGraphState;
    onGraphStateChange(nextGraphState);
  }, [
    onGraphStateChange,
    displayPlan.profile,
    runState.elapsedSec,
    running,
  ]);

  useEffect(() => {
    if (!running || runState.startedAt == null) return undefined;

    const id = window.setInterval(() => {
      setRunState((current) => {
        if (!current.running || current.startedAt == null) return current;
        return {
          ...current,
          elapsedSec: (performance.now() - current.startedAt) / 1000,
        };
      });
    }, 250);

    return () => window.clearInterval(id);
  }, [running, runState.startedAt]);

  useEffect(() => {
    saveRecipeTableState({ rows, cycleCount });
  }, [cycleCount, rows]);

  const buildPlanFromRows = (
    sourceRows: readonly TemperatureRecipeRow[],
  ): TemperatureRecipePlan => {
    return buildTemperatureRecipePlan(
      normalizeRecipeRows(sourceRows),
      parsedCycleCount,
      initialPv,
    );
  };

  const updateRow = (
    rowId: string,
    key: keyof Omit<TemperatureRecipeRow, 'id'>,
    value: string,
  ): void => {
    const nextRows = rowsRef.current.map((row) =>
      row.id === rowId
        ? {
            ...row,
            [key]: value,
          }
        : row,
    );
    rowsRef.current = nextRows;
    setRows(nextRows);
  };

  const addRow = (): void => {
    const currentRows = rowsRef.current;
    if (currentRows.length >= MAX_RECIPE_ROWS) return;
    const nextRows = [...currentRows, createRecipeRow(currentRows.length)];
    rowsRef.current = nextRows;
    setRows(nextRows);
    if (running) updateRunningRecipe(nextRows);
  };

  const deleteRow = (rowId: string): void => {
    const currentRows = rowsRef.current;
    if (currentRows.length <= 1) return;
    const nextRows = currentRows.filter((row) => row.id !== rowId);
    rowsRef.current = nextRows;
    setRows(nextRows);
    if (running) updateRunningRecipe(nextRows);
  };

  const resetRows = (): void => {
    if (running) return;
    const nextRows = createInitialRecipeRows();
    rowsRef.current = nextRows;
    setRows(nextRows);
    setCycleCount('1');
    setMessage(null);
  };

  const runTemperatureStep = async (
    step: TemperatureRecipePlanStep,
  ): Promise<void> => {
    const response = await startTemperatureRecipeStep(DEVICE_ID, {
      recipeRunId: null,
      cycleIndex: step.cycleIndex + 1,
      stepIndex: step.stepIndex,
      setValue: step.tcSetValue,
      rampingRate: step.tcRampingRate,
    });
    const data = response.data as unknown as
      | TemperatureRecipeStepStartResponseData
      | undefined;
    const failed =
      response.status === 'error' ||
      (data?.failedStep != null && data.failedStep !== '');
    if (failed) {
      const failedStep = data?.failedStep;
      const baseMessage = response.error ?? 'Temperature recipe command failed';
      throw new Error(
        failedStep ? `${baseMessage} at ${failedStep}` : baseMessage,
      );
    }
  };

  const stopTemperature = async (): Promise<void> => {
    const response = await setTemperatureStopMode(DEVICE_ID);
    if (response.status === 'error') {
      throw new Error(response.error ?? 'Temperature stop failed');
    }
    await temperatureConnection.refreshState();
  };

  const updateRunningRecipe = (
    sourceRows: readonly TemperatureRecipeRow[] = rowsRef.current,
  ): void => {
    if (!running) return;
    const previousPlan = runPlanRef.current;
    if (previousPlan == null || previousPlan.planSteps.length === 0) return;
    const nextPlan = buildPlanFromRows(sourceRows);
    if (nextPlan.planSteps.length === 0) {
      setMessage('At least one valid temperature row is required');
      return;
    }
    const elapsedSec =
      runState.startedAt == null
        ? runState.elapsedSec
        : (performance.now() - runState.startedAt) / 1000;
    const updateResult = createUpdatedRunPlan(
      nextPlan,
      previousPlan,
      elapsedSec,
    );
    if (updateResult == null) {
      pendingStepReapplyRef.current = null;
      setMessage('Recipe update ignored after the current plan ended');
      return;
    }

    const nextToken = updateTokenRef.current + 1;
    const shouldReapply =
      updateResult.shouldReapplyCurrentStep &&
      elapsedSec + STALE_COMMAND_GUARD_SEC < updateResult.activeStep.endSec &&
      !cancelRunRef.current;
    pendingStepReapplyRef.current = shouldReapply
      ? { token: nextToken, stepIndex: updateResult.activeStepIndex }
      : null;
    runPlanRef.current = updateResult.plan;
    updateTokenRef.current = nextToken;
    setRunPlan(updateResult.plan);
    setMessage('Recipe updated');
  };

  const startRecipe = async (): Promise<void> => {
    if (busy) return;
    if (!connected) {
      setMessage('Temperature is not connected');
      return;
    }
    if (recipePlan.planSteps.length === 0) {
      setMessage('At least one valid temperature row is required');
      return;
    }

    const planSnapshot = recipePlan;
    const firstStep = planSnapshot.planSteps[0];
    cancelRunRef.current = false;
    updateTokenRef.current = 0;
    pendingStepReapplyRef.current = null;
    runPlanRef.current = planSnapshot;
    onRecipeStart();
    setRunPlan(planSnapshot);
    setMessage(null);

    // 첫 step command가 성공하기 전에는 timer를 시작하지 않는다.
    // status="starting", elapsedSec=0, startedAt=null (timer not running).
    setRunState({
      running: false,
      status: 'starting',
      currentCycle: firstStep.cycleIndex + 1,
      currentStepIndex: 0,
      elapsedSec: 0,
      startedAt: null,
    });

    // ── 첫 번째 step composite command (timer 시작 전) ────────────────────
    let firstStepResponse;
    try {
      firstStepResponse = await startTemperatureRecipeStep(DEVICE_ID, {
        recipeRunId: null,
        cycleIndex: firstStep.cycleIndex + 1,
        stepIndex: firstStep.stepIndex,
        setValue: firstStep.tcSetValue,
        rampingRate: firstStep.tcRampingRate,
      });
    } catch (error) {
      const errText = error instanceof Error ? error.message : String(error);
      setRunState({
        running: false,
        status: 'error',
        currentCycle: firstStep.cycleIndex + 1,
        currentStepIndex: 0,
        elapsedSec: 0,
        startedAt: null,
      });
      setMessage(
        `Recipe failed before timer start. Cycle ${firstStep.cycleIndex + 1} / Step ${
          firstStep.rowIndex + 1
        } failed: ${errText}.`,
      );
      return;
    }

    const firstStepData = firstStepResponse.data as unknown as
      | TemperatureRecipeStepStartResponseData
      | undefined;
    const firstStepFailed =
      firstStepResponse.status === 'error' ||
      (firstStepData?.failedStep != null && firstStepData.failedStep !== '');
    if (firstStepFailed) {
      const failedStep = firstStepData?.failedStep ?? null;
      const errText =
        firstStepResponse.error ?? 'Recipe step command failed';
      setRunState({
        running: false,
        status: 'error',
        currentCycle: firstStep.cycleIndex + 1,
        currentStepIndex: 0,
        elapsedSec: 0,
        startedAt: null,
      });
      setMessage(
        `Recipe failed before timer start. Cycle ${firstStep.cycleIndex + 1} / Step ${
          firstStep.rowIndex + 1
        }${failedStep ? ` failed at ${failedStep}` : ' failed'}: ${errText}.`,
      );
      return;
    }

    // ── 첫 step command 성공: 이 시점부터 elapsedSec=0으로 timer 시작 ─────
    const startedAt = performance.now();
    setRunState({
      running: true,
      status: 'running',
      currentCycle: firstStep.cycleIndex + 1,
      currentStepIndex: 0,
      elapsedSec: 0,
      startedAt,
    });

    try {
      let planIndex = 0;
      // 첫 step command는 timer 시작 전에 이미 실행했으므로 loop에서 재실행하지 않는다.
      let lastCommandedPlanIndex = 0;
      let observedUpdateToken = updateTokenRef.current;
      while (!cancelRunRef.current) {
        const activeRunPlan = runPlanRef.current;
        if (activeRunPlan == null || activeRunPlan.planSteps.length === 0) break;

        const elapsedSec = (performance.now() - startedAt) / 1000;
        if (observedUpdateToken !== updateTokenRef.current) {
          observedUpdateToken = updateTokenRef.current;
          planIndex = findPlanStepIndexForElapsed(
            activeRunPlan.planSteps,
            elapsedSec,
          );
        }

        if (planIndex >= activeRunPlan.planSteps.length) break;
        const step = activeRunPlan.planSteps[planIndex];
        if (elapsedSec >= step.endSec) {
          planIndex += 1;
          continue;
        }

        setRunState((current) => ({
          ...current,
          currentCycle: step.cycleIndex + 1,
          currentStepIndex: planIndex,
          elapsedSec,
        }));
        const pendingReapply = pendingStepReapplyRef.current;
        const shouldReapplyCurrentStep =
          pendingReapply?.token === observedUpdateToken &&
          pendingReapply.stepIndex === planIndex &&
          elapsedSec + STALE_COMMAND_GUARD_SEC < step.endSec;
        const shouldStartNewStep = planIndex !== lastCommandedPlanIndex;

        if (shouldReapplyCurrentStep || shouldStartNewStep) {
          await runTemperatureStep(step);
          if (cancelRunRef.current) break;
          lastCommandedPlanIndex = planIndex;
          if (
            shouldReapplyCurrentStep &&
            pendingStepReapplyRef.current?.token === observedUpdateToken
          ) {
            pendingStepReapplyRef.current = null;
          }
        }

        await waitUntilRecipeTime(step.endSec, startedAt, () => {
          if (cancelRunRef.current) return false;
          if (observedUpdateToken !== updateTokenRef.current) return false;
          return true;
        });

        if (cancelRunRef.current) break;
        if (observedUpdateToken !== updateTokenRef.current) continue;
        planIndex += 1;
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
      runPlanRef.current = null;
      pendingStepReapplyRef.current = null;
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
      runPlanRef.current = null;
      pendingStepReapplyRef.current = null;
    }
  };

  const commitRecipeTableEdit = (): void => {
    updateRunningRecipe();
  };

  return (
    <section className="recipe-panel">
      <div className="recipe-toolbar">
        <div className="recipe-toolbar__actions">
          <button
            type="button"
            className="recipe-icon-button recipe-icon-button--run"
            title="Start recipe"
            disabled={!connected || busy || recipePlan.planSteps.length === 0}
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
            disabled={busy}
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
            disabled={busy}
            inputMode="numeric"
          />
        </label>
      </div>

      <div className="recipe-run-summary">
        <div>
          <span className="recipe-run-summary__label">Status</span>
          <span
            className={
              runState.status === 'running'
                ? 'is-running'
                : runState.status === 'error'
                  ? 'is-error'
                  : ''
            }
          >
            {runState.status === 'running'
              ? 'Running'
              : runState.status === 'starting'
                ? 'Starting'
                : runState.status === 'error'
                  ? 'Error'
                  : connected
                    ? 'Ready'
                    : 'Disconnected'}
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
        elapsedSec={running ? runState.elapsedSec : null}
        previewHeight={profilePreviewHeight}
        onPreviewHeightChange={setProfilePreviewHeight}
      />

      <div className="recipe-table-wrap">
        <table className="recipe-table">
          <thead>
            <tr>
              <th className="recipe-table__idx-col">idx</th>
              {connected && (
                <>
                  <th className="recipe-table__target-col">
                    <span>Target</span>
                    <span>Temperature</span>
                    <span>(°C)</span>
                  </th>
                  <th className="recipe-table__ramping-col">
                    <span>Ramping</span>
                    <span>Rate</span>
                    <span>(°C/min)</span>
                  </th>
                </>
              )}
              <th className="recipe-table__time-col">
                <span>Hour</span>
                <span>(h)</span>
              </th>
              <th className="recipe-table__time-col">
                <span>Minute</span>
                <span>(min)</span>
              </th>
              <th className="recipe-table__time-col">
                <span>Second</span>
                <span>(s)</span>
              </th>
              <th className="recipe-table__action-col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <RecipeTableRow
                key={row.id}
                row={row}
                index={index}
                active={activePlanStep?.rowId === row.id}
                disabled={false}
                showTemperatureColumns={connected}
                onChange={updateRow}
                onCommit={commitRecipeTableEdit}
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
          disabled={rows.length >= MAX_RECIPE_ROWS}
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
            message === 'Recipe completed' ||
            message === 'Recipe stopped' ||
            message === 'Recipe updated'
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
  showTemperatureColumns,
  onChange,
  onCommit,
  onDelete,
}: {
  row: TemperatureRecipeRow;
  index: number;
  active: boolean;
  disabled: boolean;
  showTemperatureColumns: boolean;
  onChange: (
    rowId: string,
    key: keyof Omit<TemperatureRecipeRow, 'id'>,
    value: string,
  ) => void;
  onCommit: () => void;
  onDelete: (rowId: string) => void;
}): ReactElement {
  const suppressNextBlurCommitRef = useRef(false);
  const handleChange =
    (key: keyof Omit<TemperatureRecipeRow, 'id'>) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange(row.id, key, event.target.value);
    };
  const handleBlur = (): void => {
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    onCommit();
  };
  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    suppressNextBlurCommitRef.current = true;
    onCommit();
    event.currentTarget.blur();
  };

  return (
    <tr className={active ? 'is-active' : ''}>
      <td className="recipe-table__idx">{index + 1}</td>
      {showTemperatureColumns && (
        <>
          <td className="recipe-table__target-col">
            <input
              value={row.tcSetValue}
              onChange={handleChange('tcSetValue')}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              inputMode="decimal"
            />
          </td>
          <td className="recipe-table__ramping-col">
            <input
              value={row.tcRampingRate}
              onChange={handleChange('tcRampingRate')}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              inputMode="decimal"
            />
          </td>
        </>
      )}
      <td>
        <input
          value={row.hour}
          onChange={handleChange('hour')}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          inputMode="numeric"
        />
      </td>
      <td>
        <input
          value={row.minute}
          onChange={handleChange('minute')}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          inputMode="numeric"
        />
      </td>
      <td>
        <input
          value={row.second}
          onChange={handleChange('second')}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
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
  elapsedSec,
  previewHeight,
  onPreviewHeightChange,
}: {
  activeKind: RecipeProfileKind;
  onActiveKindChange: (kind: RecipeProfileKind) => void;
  temperatureProfile: readonly RecipeProfilePoint[];
  elapsedSec: number | null;
  previewHeight: number;
  onPreviewHeightChange: (height: number) => void;
}): ReactElement {
  const resizeStartRef = useRef<ProfileResizeStart | null>(null);
  const activeTab =
    PROFILE_TABS.find((tab) => tab.kind === activeKind) ?? PROFILE_TABS[0];
  const activeProfile =
    activeTab.kind === 'temperature' ? temperatureProfile : [];

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    resizeStartRef.current = {
      clientY: event.clientY,
      height: previewHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleResizePointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    const resizeStart = resizeStartRef.current;
    if (!resizeStart) return;
    const nextHeight = resizeStart.height + event.clientY - resizeStart.clientY;
    onPreviewHeightChange(Math.max(PROFILE_PREVIEW_MIN_HEIGHT, nextHeight));
  };

  const handleResizePointerEnd = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    resizeStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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
        elapsedSec={activeProfile.length > 0 ? elapsedSec : null}
        height={previewHeight}
      />
      <button
        type="button"
        className="recipe-profile-resize-handle"
        title="Resize profile graph"
        aria-label="Resize profile graph"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
      />
    </div>
  );
}

function RecipeProfilePreview({
  profile,
  label,
  unitLabel,
  emptyLabel,
  elapsedSec,
  height,
}: {
  profile: readonly RecipeProfilePoint[];
  label: string;
  unitLabel: string;
  emptyLabel: string;
  elapsedSec: number | null;
  height: number;
}): ReactElement {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<ProfileDragStart | null>(null);
  const [chartSize, setChartSize] = useState<ProfileChartSize>({
    width: PROFILE_CHART_MIN_WIDTH,
    height: PROFILE_PREVIEW_MIN_HEIGHT,
  });
  const plot = useMemo(() => buildProfilePlotArea(chartSize), [chartSize]);
  const profileRange = useMemo(() => buildProfileRange(profile), [profile]);
  const profileSignature = useMemo(() => buildProfileSignature(profile), [profile]);
  const [viewRange, setViewRange] = useState(profileRange);
  const path = useMemo(() => buildProfilePath(profile, viewRange, plot), [
    plot,
    profile,
    viewRange,
  ]);
  const xTicks = useMemo(
    () => buildProfileTicks(viewRange.xMin, viewRange.xMax, 3),
    [viewRange],
  );
  const yTicks = useMemo(
    () => buildProfileTicks(viewRange.yMin, viewRange.yMax, 3),
    [viewRange],
  );
  const timelineX =
    elapsedSec !== null && elapsedSec >= viewRange.xMin && elapsedSec <= viewRange.xMax
      ? scaleProfileX(elapsedSec, viewRange, plot)
      : null;

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (preview == null) return undefined;

    const updateSize = (): void => {
      const rect = preview.getBoundingClientRect();
      setChartSize({
        width: Math.max(PROFILE_CHART_MIN_WIDTH, Math.floor(rect.width)),
        height: Math.max(PROFILE_PREVIEW_MIN_HEIGHT, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setViewRange(profileRange);
  }, [label, profileRange, profileSignature]);

  const handlePointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    if (profile.length === 0) return;
    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      range: viewRange,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    const deltaX = event.clientX - dragStart.clientX;
    const deltaY = event.clientY - dragStart.clientY;
    setViewRange(
      clampProfileRange(
        panProfileRange(dragStart.range, deltaX, deltaY, plot),
        profileRange,
      ),
    );
  };

  const handlePointerEnd = (
    event: ReactPointerEvent<SVGSVGElement>,
  ): void => {
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>): void => {
    if (profile.length === 0) return;
    event.preventDefault();
    const chartPoint = getProfileChartPoint(event, chartSize);
    const zoomAnchor = getProfilePlotRatio(chartPoint, plot);
    const zoomFactor = event.deltaY < 0 ? 0.82 : 1.18;
    setViewRange((current) =>
      clampProfileRange(zoomProfileRange(current, zoomFactor, zoomAnchor), profileRange),
    );
  };

  return (
    <div
      className="recipe-profile-preview"
      ref={previewRef}
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
        role="img"
        aria-label={`${label} profile preview`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={() => setViewRange(profileRange)}
        onWheel={handleWheel}
      >
        <defs>
          <clipPath id={`recipe-profile-clip-${label.toLowerCase()}`}>
            <rect
              x={plot.left}
              y={plot.top}
              width={plot.width}
              height={plot.height}
            />
          </clipPath>
        </defs>
        {xTicks.map((tick) => {
          const x = scaleProfileX(tick, viewRange, plot);
          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={plot.top}
                x2={x}
                y2={plot.bottom}
                className="recipe-profile-grid"
              />
              <text
                x={x}
                y={plot.bottom + 11}
                textAnchor="middle"
                className="recipe-profile-tick"
              >
                {formatProfileTick(tick)}
              </text>
            </g>
          );
        })}
        {yTicks.map((tick) => {
          const y = scaleProfileY(tick, viewRange, plot);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={plot.left}
                y1={y}
                x2={plot.right}
                y2={y}
                className="recipe-profile-grid"
              />
              <text
                x={plot.left - 5}
                y={y + 3}
                textAnchor="end"
                className="recipe-profile-tick"
              >
                {formatProfileTick(tick)}
              </text>
            </g>
          );
        })}
        <line
          x1={plot.left}
          y1={plot.bottom}
          x2={plot.right}
          y2={plot.bottom}
          className="recipe-profile-axis"
        />
        <line
          x1={plot.left}
          y1={plot.top}
          x2={plot.left}
          y2={plot.bottom}
          className="recipe-profile-axis"
        />
        <text
          x={(plot.left + plot.right) / 2}
          y={chartSize.height - 6}
          textAnchor="middle"
          className="recipe-profile-axis-label"
        >
          Time [s]
        </text>
        <text
          x={10}
          y={(plot.top + plot.bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${(plot.top + plot.bottom) / 2})`}
          className="recipe-profile-axis-label"
        >
          {unitLabel}
        </text>
        {path ? (
          <g clipPath={`url(#recipe-profile-clip-${label.toLowerCase()})`}>
            <path d={path} className="recipe-profile-line" />
            {timelineX !== null && (
              <>
                <line
                  x1={timelineX}
                  y1={plot.top}
                  x2={timelineX}
                  y2={plot.bottom}
                  className="recipe-profile-time-line"
                />
                <text
                  x={Math.min(timelineX + 4, plot.right - 28)}
                  y={plot.top + 10}
                  className="recipe-profile-time-label"
                >
                  {formatProfileTick(elapsedSec ?? 0)}s
                </text>
              </>
            )}
          </g>
        ) : (
          <text
            x={chartSize.width / 2}
            y={chartSize.height / 2}
            textAnchor="middle"
            className="recipe-profile-empty"
          >
            {emptyLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

function buildProfilePlotArea(size: ProfileChartSize): ProfilePlotArea {
  const width = Math.max(size.width, PROFILE_CHART_MIN_WIDTH);
  const height = Math.max(size.height, PROFILE_PREVIEW_MIN_HEIGHT);
  const left = PROFILE_CHART_MARGIN.left;
  const right = Math.max(left + 24, width - PROFILE_CHART_MARGIN.right);
  const top = PROFILE_CHART_MARGIN.top;
  const bottom = Math.max(top + 24, height - PROFILE_CHART_MARGIN.bottom);
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function buildProfileRange(
  profile: readonly { timeSec: number; value: number }[],
): ProfileViewRange {
  if (profile.length === 0) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }
  const maxTime = Math.max(...profile.map((point) => point.timeSec), 1);
  const values = profile.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max((maxValue - minValue) * 0.1, 1);
  return {
    xMin: 0,
    xMax: maxTime,
    yMin: minValue - padding,
    yMax: maxValue + padding,
  };
}

function buildProfileSignature(
  profile: readonly { timeSec: number; value: number }[],
): string {
  if (profile.length === 0) return 'empty';
  const first = profile[0];
  const last = profile[profile.length - 1];
  return `${profile.length}:${first.timeSec}:${first.value}:${last.timeSec}:${last.value}`;
}

function buildProfilePath(
  profile: readonly { timeSec: number; value: number }[],
  range: ProfileViewRange,
  plot: ProfilePlotArea,
): string {
  if (profile.length === 0) return '';

  return profile
    .map((point, index) => {
      const x = scaleProfileX(point.timeSec, range, plot);
      const y = scaleProfileY(point.value, range, plot);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildProfileTicks(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function scaleProfileX(
  value: number,
  range: ProfileViewRange,
  plot: ProfilePlotArea,
): number {
  const span = Math.max(range.xMax - range.xMin, Number.EPSILON);
  return (
    plot.left +
    ((value - range.xMin) / span) * plot.width
  );
}

function scaleProfileY(
  value: number,
  range: ProfileViewRange,
  plot: ProfilePlotArea,
): number {
  const span = Math.max(range.yMax - range.yMin, Number.EPSILON);
  return (
    plot.bottom -
    ((value - range.yMin) / span) * plot.height
  );
}

function panProfileRange(
  range: ProfileViewRange,
  deltaX: number,
  deltaY: number,
  plot: ProfilePlotArea,
): ProfileViewRange {
  const xSpan = range.xMax - range.xMin;
  const ySpan = range.yMax - range.yMin;
  const xShift = (-deltaX / plot.width) * xSpan;
  const yShift = (deltaY / plot.height) * ySpan;
  return {
    xMin: range.xMin + xShift,
    xMax: range.xMax + xShift,
    yMin: range.yMin + yShift,
    yMax: range.yMax + yShift,
  };
}

function zoomProfileRange(
  range: ProfileViewRange,
  factor: number,
  anchor: { xRatio: number; yRatio: number },
): ProfileViewRange {
  const xSpan = range.xMax - range.xMin;
  const ySpan = range.yMax - range.yMin;
  const anchorX = range.xMin + xSpan * anchor.xRatio;
  const anchorY = range.yMax - ySpan * anchor.yRatio;
  const nextXSpan = xSpan * factor;
  const nextYSpan = ySpan * factor;
  return {
    xMin: anchorX - nextXSpan * anchor.xRatio,
    xMax: anchorX + nextXSpan * (1 - anchor.xRatio),
    yMin: anchorY - nextYSpan * (1 - anchor.yRatio),
    yMax: anchorY + nextYSpan * anchor.yRatio,
  };
}

function clampProfileRange(
  range: ProfileViewRange,
  bounds: ProfileViewRange,
): ProfileViewRange {
  const fullXSpan = bounds.xMax - bounds.xMin;
  const fullYSpan = bounds.yMax - bounds.yMin;
  const minXSpan = Math.max(fullXSpan * 0.02, 1);
  const minYSpan = Math.max(fullYSpan * 0.02, 0.5);
  const xSpan = Math.min(
    Math.max(range.xMax - range.xMin, minXSpan),
    fullXSpan,
  );
  const ySpan = Math.min(
    Math.max(range.yMax - range.yMin, minYSpan),
    fullYSpan,
  );
  let xMin = range.xMin;
  let yMin = range.yMin;

  if (xMin < bounds.xMin) xMin = bounds.xMin;
  if (xMin + xSpan > bounds.xMax) xMin = bounds.xMax - xSpan;
  if (yMin < bounds.yMin) yMin = bounds.yMin;
  if (yMin + ySpan > bounds.yMax) yMin = bounds.yMax - ySpan;

  return {
    xMin,
    xMax: xMin + xSpan,
    yMin,
    yMax: yMin + ySpan,
  };
}

function getProfileChartPoint(
  event: ReactWheelEvent<SVGSVGElement>,
  size: ProfileChartSize,
): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * size.width,
    y: ((event.clientY - rect.top) / rect.height) * size.height,
  };
}

function getProfilePlotRatio(
  point: { x: number; y: number },
  plot: ProfilePlotArea,
): {
  xRatio: number;
  yRatio: number;
} {
  return {
    xRatio: clamp01((point.x - plot.left) / plot.width),
    yRatio: clamp01((point.y - plot.top) / plot.height),
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function formatProfileTick(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function findPlanStepIndexForElapsed(
  planSteps: readonly TemperatureRecipePlanStep[],
  elapsedSec: number,
): number {
  const index = planSteps.findIndex((step) => elapsedSec < step.endSec);
  return index >= 0 ? index : planSteps.length;
}

function createUpdatedRunPlan(
  nextPlan: TemperatureRecipePlan,
  previousPlan: TemperatureRecipePlan,
  elapsedSec: number,
): UpdatedRunPlanResult | null {
  const elapsedNow = Math.max(0, elapsedSec);
  const activeStepIndex = findPlanStepIndexForElapsed(
    previousPlan.planSteps,
    elapsedNow,
  );
  if (activeStepIndex >= previousPlan.planSteps.length) {
    return null;
  }

  const oldActiveStep = previousPlan.planSteps[activeStepIndex];
  const nextActiveStepIndex = findMatchingPlanStepIndex(
    nextPlan.planSteps,
    oldActiveStep,
    activeStepIndex,
  );
  if (nextActiveStepIndex >= nextPlan.planSteps.length) {
    return null;
  }

  const nextActiveStep = nextPlan.planSteps[nextActiveStepIndex];
  const commandChanged = commandValuesChanged(oldActiveStep, nextActiveStep);
  const oldHoldSec = Math.max(0, oldActiveStep.endSec - oldActiveStep.rampEndSec);
  const newHoldSec = Math.max(0, nextActiveStep.endSec - nextActiveStep.rampEndSec);
  const holdChanged = Math.abs(oldHoldSec - newHoldSec) > COMMAND_VALUE_EPSILON;
  const inRamp =
    oldActiveStep.rampEndSec > oldActiveStep.startSec &&
    elapsedNow < oldActiveStep.rampEndSec;
  const anchorValue =
    profileValueAt(previousPlan.profile, elapsedNow) ?? oldActiveStep.tcSetValue;

  let activeRampEndSec = Math.max(elapsedNow, oldActiveStep.rampEndSec);
  let activeEndSec = Math.max(elapsedNow, oldActiveStep.endSec);

  if (commandChanged) {
    const rampSec =
      nextActiveStep.tcRampingRate > 0
        ? (Math.abs(nextActiveStep.tcSetValue - anchorValue) /
            nextActiveStep.tcRampingRate) *
          60
        : 0;
    activeRampEndSec = elapsedNow + rampSec;
    activeEndSec = activeRampEndSec + newHoldSec;
  } else if (holdChanged) {
    if (inRamp) {
      activeRampEndSec = Math.max(elapsedNow, oldActiveStep.rampEndSec);
      activeEndSec = Math.max(elapsedNow, activeRampEndSec + newHoldSec);
    } else {
      const holdElapsedSec = Math.max(0, elapsedNow - oldActiveStep.rampEndSec);
      activeRampEndSec = elapsedNow;
      activeEndSec = elapsedNow + Math.max(0, newHoldSec - holdElapsedSec);
    }
  }

  const activeStep: TemperatureRecipePlanStep = {
    ...nextActiveStep,
    startSec: oldActiveStep.startSec,
    rampEndSec: activeRampEndSec,
    endSec: activeEndSec,
  };
  const shiftDelta = activeStep.endSec - nextActiveStep.endSec;
  const pastSteps = previousPlan.planSteps.filter(
    (step) => step.endSec <= elapsedNow,
  );
  const futureSteps = nextPlan.planSteps
    .slice(nextActiveStepIndex + 1)
    .map((step) => shiftPlanStep(step, shiftDelta));

  const profilePrefix = freezeProfileUntil(previousPlan.profile, elapsedNow);
  const activeProfilePoints: RecipeProfilePoint[] = [];
  if (activeStep.rampEndSec >= elapsedNow) {
    activeProfilePoints.push({
      timeSec: activeStep.rampEndSec,
      value: activeStep.tcSetValue,
    });
  }
  activeProfilePoints.push({
    timeSec: activeStep.endSec,
    value: activeStep.tcSetValue,
  });
  const futureProfile = nextPlan.profile
    .filter(
      (point) =>
        point.timeSec >= nextActiveStep.endSec - COMMAND_VALUE_EPSILON,
    )
    .map((point) => ({
      timeSec: point.timeSec + shiftDelta,
      value: point.value,
    }));

  const planSteps = [...pastSteps, activeStep, ...futureSteps];
  const totalSec = planSteps[planSteps.length - 1]?.endSec ?? elapsedNow;

  return {
    plan: {
      planSteps,
      profile: coalesceRuntimeProfile([
        ...profilePrefix,
        ...activeProfilePoints,
        ...futureProfile,
      ]),
      totalSec,
    },
    activeStepIndex: pastSteps.length,
    activeStep,
    shouldReapplyCurrentStep: commandChanged,
  };
}

function findMatchingPlanStepIndex(
  planSteps: readonly TemperatureRecipePlanStep[],
  oldActiveStep: TemperatureRecipePlanStep,
  fallbackIndex: number,
): number {
  const rowMatch = planSteps.findIndex(
    (step) =>
      step.rowId === oldActiveStep.rowId &&
      step.cycleIndex === oldActiveStep.cycleIndex,
  );
  if (rowMatch >= 0) return rowMatch;

  const positionMatch = planSteps.findIndex(
    (step) =>
      step.stepIndex === oldActiveStep.stepIndex &&
      step.cycleIndex === oldActiveStep.cycleIndex,
  );
  if (positionMatch >= 0) return positionMatch;

  return Math.min(fallbackIndex, planSteps.length);
}

function shiftPlanStep(
  step: TemperatureRecipePlanStep,
  deltaSec: number,
): TemperatureRecipePlanStep {
  return {
    ...step,
    startSec: step.startSec + deltaSec,
    rampEndSec: step.rampEndSec + deltaSec,
    endSec: step.endSec + deltaSec,
  };
}

function commandValuesChanged(
  oldStep: TemperatureRecipePlanStep,
  newStep: TemperatureRecipePlanStep,
): boolean {
  return (
    Math.abs(oldStep.tcSetValue - newStep.tcSetValue) > COMMAND_VALUE_EPSILON ||
    Math.abs(oldStep.tcRampingRate - newStep.tcRampingRate) >
      COMMAND_VALUE_EPSILON
  );
}

function freezeProfileUntil(
  profile: readonly RecipeProfilePoint[],
  elapsedSec: number,
): RecipeProfilePoint[] {
  const frozen = profile
    .filter((point) => point.timeSec <= elapsedSec)
    .map((point) => ({ ...point }));
  const anchorValue = profileValueAt(profile, elapsedSec);
  const last = frozen[frozen.length - 1];
  if (
    anchorValue != null &&
    (last == null ||
      Math.abs(last.timeSec - elapsedSec) > COMMAND_VALUE_EPSILON ||
      Math.abs(last.value - anchorValue) > COMMAND_VALUE_EPSILON)
  ) {
    frozen.push({ timeSec: elapsedSec, value: anchorValue });
  }
  return frozen;
}

function profileValueAt(
  profile: readonly RecipeProfilePoint[],
  elapsedSec: number,
): number | null {
  if (profile.length === 0) return null;
  const ordered = [...profile].sort((left, right) => left.timeSec - right.timeSec);
  let previous = ordered[0];
  if (elapsedSec <= previous.timeSec) return previous.value;

  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (current.timeSec < elapsedSec) {
      previous = current;
      continue;
    }
    if (
      Math.abs(current.timeSec - elapsedSec) <= COMMAND_VALUE_EPSILON ||
      Math.abs(current.timeSec - previous.timeSec) <= COMMAND_VALUE_EPSILON
    ) {
      return current.value;
    }
    const ratio =
      (elapsedSec - previous.timeSec) / (current.timeSec - previous.timeSec);
    return previous.value + (current.value - previous.value) * ratio;
  }

  return ordered[ordered.length - 1].value;
}

function coalesceRuntimeProfile(
  points: readonly RecipeProfilePoint[],
): RecipeProfilePoint[] {
  const result: RecipeProfilePoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (
      previous &&
      Math.abs(previous.timeSec - point.timeSec) < 0.000001 &&
      Math.abs(previous.value - point.value) < 0.000001
    ) {
      continue;
    }
    result.push(point);
  }
  return result;
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
