/**
 * 사이드 메뉴 프리셋 (component/side_menu/preset.py 재현).
 *
 * 메뉴 항목 목록을 컴포넌트와 분리해 선언적으로 구성한다.
 * 커스텀 소프트웨어/디바이스 빌드는 이 파일의 빌더만 교체(또는 별도 빌더 작성)하면
 * SideMenu 컴포넌트를 수정하지 않고 메뉴를 재구성할 수 있다.
 */
import type { IconName } from '../../shared/icons/materialSymbols';
import { IV, MANUAL, RECIPE, type ControlMode } from '../../shared/types/ui';

/** 항목 유형: 모드 전환 vs 단발 액션 (item_type) */
export type SideMenuItemType = 'mode' | 'action';

/** 항목 정렬 그룹: 상단 vs 하단 (anchor) */
export type SideMenuGroup = 'top' | 'bottom';

/** 메뉴 항목 선언 (SideMenuItemConfig 데이터클래스 대응) */
export interface SideMenuItemConfig {
  /** 고유 식별자 */
  id: string;
  /** 표시 라벨 */
  label: string;
  /** Material Symbols 아이콘 이름 */
  icon: IconName;
  /** 모드 전환 / 액션 구분 */
  type: SideMenuItemType;
  /** 상단 / 하단 그룹 */
  group: SideMenuGroup;
  /** type === 'mode' 일 때 연결되는 모드 값 */
  mode?: ControlMode;
  /** 배지 표시 여부 */
  hasBadge?: boolean;
  /** 비활성화 여부 (set_item_enabled 대응) */
  disabled?: boolean;
  /** 숨김 여부 (set_item_visible 대응) */
  hidden?: boolean;
  /** 클릭 콜백 (config.callback 대응) */
  onClick?: () => void;
}

/** 기본 프리셋 빌더 옵션 (register_default_items 인자 대응) */
export interface DefaultSideMenuOptions {
  /** IV 메뉴 활성화 여부 (SMU 연결 상태 기반) */
  ivEnabled?: boolean;
  onModeSelected?: (mode: ControlMode) => void;
  onResults?: () => void;
  onSettings?: () => void;
}

/**
 * 기본 사이드 메뉴 항목을 생성한다 (register_default_items 재현).
 *
 * 각 항목이 자체 onClick 콜백을 들고 있어, 항목을 추가/제거해도
 * SideMenu 컴포넌트의 디스패치 로직을 수정할 필요가 없다.
 */
export function createDefaultSideMenuItems(
  options: DefaultSideMenuOptions = {},
): SideMenuItemConfig[] {
  const { ivEnabled = false, onModeSelected, onResults, onSettings } = options;

  return [
    {
      id: 'recipe',
      label: 'Recipe',
      icon: 'description',
      type: 'mode',
      group: 'top',
      mode: RECIPE,
      onClick: () => onModeSelected?.(RECIPE),
    },
    {
      id: 'manual',
      label: 'Manual',
      icon: 'switches',
      type: 'mode',
      group: 'top',
      mode: MANUAL,
      hasBadge: true,
      onClick: () => onModeSelected?.(MANUAL),
    },
    {
      id: 'iv',
      label: 'IV',
      icon: 'iv_measurement',
      type: 'mode',
      group: 'top',
      mode: IV,
      disabled: !ivEnabled,
      onClick: () => onModeSelected?.(IV),
    },
    {
      id: 'results',
      label: 'Results',
      icon: 'table',
      type: 'action',
      group: 'bottom',
      onClick: onResults,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      type: 'action',
      group: 'bottom',
      onClick: onSettings,
    },
  ];
}
