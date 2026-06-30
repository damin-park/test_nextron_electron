/**
 * 상단 메뉴바 (component/menu.py 의 MenuBar 재현).
 * File / Settings / Help 메뉴와 우측 버전 라벨로 구성된다.
 */
import type { ReactElement } from 'react';

const MENU_ITEMS = ['File', 'Settings', 'Help'];

interface MenuBarProps {
  onSettings?: () => void;
}

export function MenuBar({ onSettings }: MenuBarProps): ReactElement {
  return (
    <div className="menu-bar">
      <div className="menu-bar__items">
        {MENU_ITEMS.map((label) => {
          const isSettings = label === 'Settings';
          return (
            <button
              key={label}
              type="button"
              className="menu-bar__item"
              onClick={isSettings ? onSettings : undefined}
              disabled={isSettings ? !onSettings : true}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="menu-bar__spacer" />
    </div>
  );
}
