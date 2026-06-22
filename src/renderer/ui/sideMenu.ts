/**
 * 좌측 사이드 메뉴 (component/side_menu 재현).
 *
 * 상단 그룹: Recipe / Manual / IV (모드 전환)
 * 하단 그룹: Results / Settings (액션)
 * 최하단: 버전 라벨
 */
import { renderIcon, type IconName } from './icons';
import type { ControlMode } from './types';

type ItemType = 'mode' | 'action';

interface SideMenuItemConfig {
  id: string;
  label: string;
  icon: IconName;
  type: ItemType;
  mode?: ControlMode;
  group: 'top' | 'bottom';
  hasBadge?: boolean;
}

const ITEMS: SideMenuItemConfig[] = [
  { id: 'recipe', label: 'Recipe', icon: 'description', type: 'mode', mode: 'recipe', group: 'top' },
  { id: 'manual', label: 'Manual', icon: 'switches', type: 'mode', mode: 'manual', group: 'top', hasBadge: true },
  { id: 'iv', label: 'IV', icon: 'iv_measurement', type: 'mode', mode: 'iv', group: 'top' },
  { id: 'results', label: 'Results', icon: 'table', type: 'action', group: 'bottom' },
  { id: 'settings', label: 'Settings', icon: 'settings', type: 'action', group: 'bottom' },
];

export interface SideMenuCallbacks {
  onModeSelected?: (mode: ControlMode) => void;
  onResults?: () => void;
  onSettings?: () => void;
}

export interface SideMenuHandle {
  element: HTMLElement;
  setMode: (mode: ControlMode) => void;
  setItemEnabled: (id: string, enabled: boolean) => void;
  setItemVisible: (id: string, visible: boolean) => void;
}

export function createSideMenu(
  version: string,
  initialMode: ControlMode,
  callbacks: SideMenuCallbacks = {},
): SideMenuHandle {
  const root = document.createElement('div');
  root.className = 'side-menu';

  const topGroup = document.createElement('div');
  topGroup.className = 'side-menu__group side-menu__group--top';

  const bottomGroup = document.createElement('div');
  bottomGroup.className = 'side-menu__group side-menu__group--bottom';

  const itemElements = new Map<string, HTMLElement>();

  for (const config of ITEMS) {
    const item = document.createElement('div');
    item.className = 'side-menu__item';
    item.dataset.id = config.id;
    if (config.hasBadge) {
      item.classList.add('has-badge');
    }
    item.innerHTML = `
      <span class="side-menu__icon">
        <span class="material-symbols-outlined side-menu__icon-glyph">${renderIcon(config.icon)}</span>
      </span>
      <span class="side-menu__label">${config.label}</span>
      <span class="side-menu__badge"></span>
    `;

    item.addEventListener('click', () => {
      if (item.classList.contains('is-disabled')) {
        return;
      }
      if (config.type === 'mode' && config.mode) {
        callbacks.onModeSelected?.(config.mode);
      } else if (config.id === 'results') {
        callbacks.onResults?.();
      } else if (config.id === 'settings') {
        callbacks.onSettings?.();
      }
    });

    itemElements.set(config.id, item);
    (config.group === 'top' ? topGroup : bottomGroup).appendChild(item);
  }

  const versionLabel = document.createElement('div');
  versionLabel.className = 'version-label';
  versionLabel.textContent = version;

  root.append(topGroup, bottomGroup, versionLabel);

  const setMode = (mode: ControlMode) => {
    for (const config of ITEMS) {
      if (config.type !== 'mode') {
        continue;
      }
      const el = itemElements.get(config.id);
      el?.classList.toggle('is-selected', config.mode === mode);
    }
  };

  setMode(initialMode);

  const setItemEnabled = (id: string, enabled: boolean) => {
    itemElements.get(id)?.classList.toggle('is-disabled', !enabled);
  };

  const setItemVisible = (id: string, visible: boolean) => {
    itemElements.get(id)?.classList.toggle('is-hidden', !visible);
  };

  return { element: root, setMode, setItemEnabled, setItemVisible };
}
