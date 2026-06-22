/**
 * 상단 메뉴바 (component/menu.py 의 MenuBar 재현).
 * File / Settings / Help 메뉴와 우측 버전 라벨로 구성된다.
 */
import type { ReactElement } from 'react';

const MENU_ITEMS = ['File', 'Settings', 'Help'];

interface MenuBarProps {
  version: string;
}

export function MenuBar({ version }: MenuBarProps): ReactElement {
  return (
    <div className="menu-bar">
      <div className="menu-bar__items">
        {MENU_ITEMS.map((label) => (
          <div key={label} className="menu-bar__item">
            {label}
          </div>
        ))}
      </div>
      <div className="menu-bar__spacer" />
      <div className="menu-bar__version">{version}</div>
    </div>
  );
}
