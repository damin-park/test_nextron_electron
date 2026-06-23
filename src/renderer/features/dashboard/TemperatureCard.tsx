/**
 * Temperature 대시보드 카드 (temperature_panel.py 정확 재현).
 *
 * 레이아웃 (260px × 84px):
 *   [🔗]  [⚡ Temp]                       [«/»]   ← 타이틀 행
 *   ──────────────────────┬────────────────────
 *   SV   1000.0 °C        │ Hot Power  -100.0 %
 *   PV     24.8 °C        │ Cool Power    0.0 %
 *
 * - 좌상단: 연결 link 아이콘 (색상=연결상태). 클릭 시 연결/해제 토글.
 * - 우상단: 접기/펼치기 아이콘 (연결됐을 때만 활성).
 * - 패널 내부에 Connect/Disconnect/Check 버튼은 없다 (원본과 동일).
 * - 좌측: SV(빨강)/PV(파랑), 우측: Hot Power/Cool Power.
 * - 미연결 시 카드 전체가 dim 처리되고 값은 '--' 로 표시.
 */
import { useState, type ReactElement } from 'react';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import {
  useTemperatureConnection,
  type ConnectionActionState,
} from '../temperature/useTemperatureConnection';

const DEFAULT_DEVICE_ID = 'temperature-1';

/** 연결 link 아이콘 색상 (dashboard_styles.py 기준) */
function connIconColor(
  connected: boolean | undefined,
  action: ConnectionActionState,
): string {
  if (action === 'connecting' || action === 'probing') return '#F1C40F'; // 노랑
  if (action === 'disconnecting') return '#F1C40F';
  if (connected === true) return '#34C759'; // 초록
  return '#3A3A3A'; // 어두운 회색 (미등록/미연결)
}

/** 측정값 표시 문자열 */
function formatValue(value: number | null | undefined): string {
  if (value == null) return '--';
  return value.toFixed(1);
}

export function TemperatureCard(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const { state, actionState, connect, disconnect } =
    useTemperatureConnection(DEFAULT_DEVICE_ID);

  const connected = state?.connected === true;
  const unit = state?.unit ?? '°C';
  const pv = formatValue(state?.currentTemperature);
  const iconColor = connIconColor(state?.connected, actionState);
  const isBusy = actionState !== 'idle';

  const dimClass = connected ? '' : ' is-dimmed';
  const collapseClass = collapsed ? ' is-collapsed' : '';

  const handleConnectionClick = (): void => {
    if (isBusy) return;
    if (connected) {
      void disconnect();
    } else {
      void connect();
    }
  };

  return (
    <div className={`temp-card${collapseClass}${dimClass}`}>
      {/* ─── 타이틀 행 ─── */}
      <div className="temp-card__header">
        <button
          type="button"
          className="temp-card__conn-link"
          style={{ color: iconColor }}
          onClick={handleConnectionClick}
          disabled={isBusy}
          title={connected ? '연결됨 — 클릭하여 해제' : '미연결 — 클릭하여 연결'}
          aria-label="연결 상태"
        >
          <span className="material-symbols-outlined">
            {getIconGlyph('link')}
          </span>
        </button>

        <div className="temp-card__title-group">
          <span className="material-symbols-outlined temp-card__title-icon">
            {getIconGlyph('thermostat')}
          </span>
          <span className="temp-card__title">Temp</span>
        </div>

        <button
          type="button"
          className="temp-card__collapse"
          onClick={() => setCollapsed((v) => !v)}
          disabled={!connected}
          aria-label={collapsed ? '펼치기' : '접기'}
        >
          <span className="material-symbols-outlined">
            {getIconGlyph(collapsed ? 'collapse_right' : 'collapse_left')}
          </span>
        </button>
      </div>

      {/* ─── 측정값 본문 ─── */}
      <div className="temp-card__body">
        {/* 좌측: SV / PV */}
        <div className="temp-card__left">
          <div className="temp-card__row">
            <span className="temp-card__label">SV</span>
            <span className="temp-card__value temp-card__value--sv">--</span>
            <span className="temp-card__unit">{unit}</span>
          </div>
          <div className="temp-card__row">
            <span className="temp-card__label">PV</span>
            <span className="temp-card__value temp-card__value--pv">{pv}</span>
            <span className="temp-card__unit">{unit}</span>
          </div>
        </div>

        {/* 우측: Hot Power / Cool Power (펼쳐진 상태에서만) */}
        {!collapsed && (
          <div className="temp-card__right">
            <div className="temp-card__row temp-card__row--right">
              <span className="temp-card__label-wide">Hot Power</span>
              <span className="temp-card__value-sm">--</span>
              <span className="temp-card__unit">%</span>
            </div>
            <div className="temp-card__row temp-card__row--right">
              <span className="temp-card__label-wide">Cool Power</span>
              <span className="temp-card__value-sm">--</span>
              <span className="temp-card__unit">%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
