/**
 * 사이드 메뉴 등에서 사용하는 Material Symbols 아이콘의 SVG 표현.
 * tkinter 는 Material Symbols 폰트를 사용하지만, Electron 에서는 의존성 없이
 * 인라인 SVG 로 동일한 아이콘을 재현한다.
 */
export type IconName =
  | 'description'
  | 'switches'
  | 'iv_measurement'
  | 'table'
  | 'settings';

const ICONS: Record<IconName, string> = {
  // 문서 아이콘 (Recipe)
  description:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 7V3.5L18.5 9H13ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z"/>',
  // 토글 스위치 (Manual)
  switches:
    '<path d="M7 6a5 5 0 0 0 0 10h10a5 5 0 0 0 0-10H7Zm0 2h10a3 3 0 0 1 0 6H7a3 3 0 0 1 0-6Zm10 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  // IV 측정 곡선 (IV)
  iv_measurement:
    '<path d="M4 3v16a2 2 0 0 0 2 2h16v-2H6V3H4Zm15.3 4.3-4.6 5.6-3-3-4 4.9 1.5 1.2 2.6-3.2 3 3 5.9-7.2-1.4-1.3Z"/>',
  // 표 (Results)
  table:
    '<path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 4v3h6V8H5Zm8 0v3h6V8h-6Zm-8 5v3h6v-3H5Zm8 0v3h6v-3h-6Z"/>',
  // 톱니바퀴 (Settings)
  settings:
    '<path d="M19.4 13a7.5 7.5 0 0 0 .1-1 7.5 7.5 0 0 0-.1-1l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.7-1l-.3-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.4 8.8a.5.5 0 0 0 .1.6L4.6 11a7.5 7.5 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.7 1l.3 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6l-2-1.6ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/>',
};

export function renderIcon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg>`;
}
