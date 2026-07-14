/**
 * 커스텀 타이틀 바 창 컨트롤(최소화/최대화/닫기)을 감싸는 서비스.
 * preload(`window.nextron`)가 없는 환경에서도 crash 하지 않도록 방어한다.
 */
const hasBridge = (): boolean =>
  typeof window !== 'undefined' && typeof window.nextron !== 'undefined';

export async function minimizeWindow(): Promise<void> {
  if (!hasBridge()) {
    return;
  }
  return window.nextron.minimizeWindow();
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  if (!hasBridge()) {
    return false;
  }
  return window.nextron.toggleMaximizeWindow();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!hasBridge()) {
    return false;
  }
  return window.nextron.isWindowMaximized();
}

export async function closeWindow(): Promise<void> {
  if (!hasBridge()) {
    return;
  }
  return window.nextron.closeWindow();
}

export function onWindowMaximizeChange(
  callback: (maximized: boolean) => void,
): () => void {
  if (!hasBridge()) {
    return () => undefined;
  }
  return window.nextron.onWindowMaximizeChange(callback);
}
