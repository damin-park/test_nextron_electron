/**
 * 좌측 사이드 메뉴 (component/side_menu 재현).
 *
 * 메뉴 항목은 sideMenuPreset 에서 주입받는다(items prop).
 * 각 항목은 자체 onClick 콜백을 가지므로, 항목 추가/제거 시
 * 이 컴포넌트를 수정할 필요가 없다.
 *
 * 상단 그룹: Recipe / Manual / IV (모드 전환)
 * 하단 그룹: Results / Settings (액션)
 * 최하단: 버전 라벨
 */
import type { ReactElement } from 'react';
import { getIconGlyph } from '../../shared/icons/materialSymbols';
import type { ControlMode } from '../../shared/types/ui';
import type { SideMenuItemConfig } from './sideMenuPreset';

export interface SideMenuProps {
  version: string;
  currentMode: ControlMode;
  /** 렌더링할 메뉴 항목 목록 (preset 에서 생성하여 주입) */
  items: SideMenuItemConfig[];
  onVersionClick?: () => void;
}

export function SideMenu({
  version,
  currentMode,
  items,
  onVersionClick,
}: SideMenuProps): ReactElement {
  const renderItem = (config: SideMenuItemConfig): ReactElement => {
    const disabled = config.disabled === true;
    const hidden = config.hidden === true;
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
      // 모드 항목: 이미 선택된 모드면 무시 (item.py _on_click 동작 재현)
      if (config.type === 'mode' && selected) {
        return;
      }
      config.onClick?.();
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
        {items.filter((item) => item.group === 'top').map(renderItem)}
      </div>
      <div className="side-menu__group side-menu__group--bottom">
        {items.filter((item) => item.group === 'bottom').map(renderItem)}
      </div>
      <button
        type="button"
        className="version-label"
        onClick={onVersionClick}
      >
        {version}
      </button>
    </div>
  );
}
