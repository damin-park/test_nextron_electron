/**
 * tkinter `material_theme.py`와 동일하게 Material Symbols 폰트의 유니코드 글리프를 사용한다.
 */
export type IconName =
  | 'description'
  | 'switches'
  | 'iv_measurement'
  | 'table'
  | 'settings';

const ICON_GLYPHS: Record<IconName, string> = {
  description: '\uE873',
  switches: '\uE429',
  iv_measurement: '\uE6E1',
  table: '\uF191',
  settings: '\uE8B8',
};

export function renderIcon(name: IconName): string {
  return ICON_GLYPHS[name];
}
