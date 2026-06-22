/**
 * 좌측 사이드 메뉴 (component/side_menu 재현).
 *
 * 상단 그룹: Recipe / Manual / IV (모드 전환)
 * 하단 그룹: Results / Settings (액션)
 * 최하단: 버전 라벨
 */
import type { ReactElement } from 'react';
import { getIconGlyph, type IconName } from '../../shared/icons/materialSymbols';
import type { ControlMode } from '../../shared/types/ui';

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

export interface SideMenuProps {
  version: string;
  currentMode: ControlMode;
  /** id 별 활성/비활성 상태. 값이 false 인 항목만 비활성 처리된다. */
  enabledById?: Record<string, boolean>;
  /** id 별 표시/숨김 상태. 값이 false 인 항목만 숨김 처리된다. */
  visibleById?: Record<string, boolean>;
  onModeSelected?: (mode: ControlMode) => void;
  onResults?: () => void;
  onSettings?: () => void;
}

export function SideMenu({
  version,
  currentMode,
  enabledById,
  visibleById,
  onModeSelected,
  onResults,
  onSettings,
}: SideMenuProps): ReactElement {
  const renderItem = (config: SideMenuItemConfig): ReactElement => {
    const disabled = enabledById?.[config.id] === false;
    const hidden = visibleById?.[config.id] === false;
    const selected = config.type === 'mode' && config.mode === currentMode;

    const classNames = ['side-menu__item'];
    if (config.hasBadge) {
      classNames.push('has-badge');
    }
    if (selected) {
      classNames.push('is-selected');
    }
    if (disabled) {
      classNames.push('is-disabled');
    }
    if (hidden) {
      classNames.push('is-hidden');
    }

    const handleClick = (): void => {
      if (disabled) {
        return;
      }
      if (config.type === 'mode' && config.mode) {
        onModeSelected?.(config.mode);
      } else if (config.id === 'results') {
        onResults?.();
      } else if (config.id === 'settings') {
        onSettings?.();
      }
    };

    return (
      <div
        key={config.id}
        className={classNames.join(' ')}
        data-id={config.id}
        onClick={handleClick}
      >
        <span className="side-menu__icon">
          <span className="material-symbols-outlined side-menu__icon-glyph">
            {getIconGlyph(config.icon)}
          </span>
        </span>
        <span className="side-menu__label">{config.label}</span>
        <span className="side-menu__badge" />
      </div>
    );
  };

  return (
    <div className="side-menu">
      <div className="side-menu__group side-menu__group--top">
        {ITEMS.filter((item) => item.group === 'top').map(renderItem)}
      </div>
      <div className="side-menu__group side-menu__group--bottom">
        {ITEMS.filter((item) => item.group === 'bottom').map(renderItem)}
      </div>
      <div className="version-label">{version}</div>
    </div>
  );
}
