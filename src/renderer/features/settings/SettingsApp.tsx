/**
 * Settings 팝업 윈도우 루트 (settings.py 재현).
 *
 * 좌측: 설정 메뉴 목록 (Connection 만 활성, 나머지는 컨트롤러 연결 시 활성화 예정)
 * 우측: 선택된 메뉴의 상세 설정 패널 (현재 Connection 만 구현)
 *
 * hash(`#/settings`)로 진입하며 별도 BrowserWindow 에서 렌더링된다.
 */
import { useState, type ReactElement } from 'react';
import { ConnectionSettings } from './ConnectionSettings';
import { IntervalSettings } from './IntervalSettings';
import { TemperatureSettings } from './TemperatureSettings';

interface SettingsMenuItem {
  id: string;
  label: string;
  /** 항상 활성 여부 (false 면 컨트롤러 연결 시 활성화 — 현재는 비활성 표시) */
  alwaysEnabled: boolean;
}

const MENU_ITEMS: SettingsMenuItem[] = [
  { id: 'interval', label: 'Interval Setting', alwaysEnabled: true },
  { id: 'connection', label: 'Connection', alwaysEnabled: true },
  { id: 'temperature', label: 'Temperature Controller', alwaysEnabled: true },
  { id: 'mfc', label: 'MFC Controller', alwaysEnabled: false },
  { id: 'humidity', label: 'Humidity Controller', alwaysEnabled: false },
  { id: 'pressure', label: 'Pressure Controller', alwaysEnabled: false },
];

export function SettingsApp(): ReactElement {
  const [selected, setSelected] = useState<string>('connection');

  return (
    <div className="settings-window">
      {/* ─── 좌측 메뉴 ─── */}
      <aside className="settings-window__sidebar">
        <div className="settings-window__title">Settings</div>
        <nav className="settings-window__menu">
          {MENU_ITEMS.map((item) => {
            const disabled = !item.alwaysEnabled;
            const isActive = item.id === selected;
            const classNames = ['settings-window__menu-item'];
            if (isActive) classNames.push('is-active');
            if (disabled) classNames.push('is-disabled');
            return (
              <button
                key={item.id}
                type="button"
                className={classNames.join(' ')}
                disabled={disabled}
                onClick={() => setSelected(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── 우측 상세 ─── */}
      <section className="settings-window__detail">
        {selected === 'interval' ? (
          <IntervalSettings />
        ) : selected === 'connection' ? (
          <ConnectionSettings />
        ) : selected === 'temperature' ? (
          <TemperatureSettings />
        ) : (
          <div className="settings-window__placeholder">
            준비 중입니다.
          </div>
        )}
      </section>
    </div>
  );
}
