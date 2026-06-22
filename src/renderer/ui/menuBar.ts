/**
 * 상단 메뉴바 (component/menu.py 의 MenuBar 재현).
 * File / Settings / Help 메뉴와 우측 버전 라벨로 구성된다.
 */

const MENU_ITEMS = ['File', 'Settings', 'Help'];

export function createMenuBar(version: string): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'menu-bar';

  const items = document.createElement('div');
  items.className = 'menu-bar__items';

  for (const label of MENU_ITEMS) {
    const item = document.createElement('div');
    item.className = 'menu-bar__item';
    item.textContent = label;
    items.appendChild(item);
  }

  const spacer = document.createElement('div');
  spacer.className = 'menu-bar__spacer';

  const versionLabel = document.createElement('div');
  versionLabel.className = 'menu-bar__version';
  versionLabel.textContent = version;

  bar.append(items, spacer, versionLabel);
  return bar;
}
