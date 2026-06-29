/**
 * tkinter `material_theme.py`와 동일하게 Material Symbols 폰트의 유니코드 글리프를 사용한다.
 * SVG 가 아니라 Material Symbols 폰트 글리프 방식을 유지한다.
 */
export type IconName =
  | 'description'
  | 'switches'
  | 'iv_measurement'
  | 'table'
  | 'settings'
  | 'thermostat'
  | 'cool'
  | 'humidity'
  | 'mfc'
  | 'pressure'
  | 'measurement'
  | 'link'
  | 'collapse_left'
  | 'collapse_right'
  | 'arrow_back'
  | 'add'
  | 'delete'
  | 'edit'
  | 'replay'
  | 'close'
  | 'play_arrow'
  | 'stop';

const ICON_GLYPHS: Record<IconName, string> = {
  description: '\uE873',
  switches: '\uE429',
  iv_measurement: '\uE6E1',
  table: '\uF191',
  settings: '\uE8B8',
  thermostat: '\uF076',
  cool: '\uF166',
  humidity: '\uF87E',
  mfc: '\uEFD8',
  pressure: '\uE94D',
  measurement: '\uEC1B',
  link: '\uE250',
  collapse_left: '\uEAC3', // keyboard_double_arrow_left
  collapse_right: '\uEAC9', // keyboard_double_arrow_right
  arrow_back: '\uE5C4',
  add: '\uE145',
  delete: '\uE872',
  edit: '\uE3C9',
  replay: '\uE042',
  close: '\uE5CD',
  play_arrow: '\uE037',
  stop: '\uE047',
};

export function getIconGlyph(name: IconName): string {
  return ICON_GLYPHS[name];
}
