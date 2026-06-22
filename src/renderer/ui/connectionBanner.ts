/**
 * 연결 배너 (main_window_parts/top_banner_manager.py 재현).
 * 경고/성공/세이프스톱/연결 상태 메시지를 같은 영역에 표시한다.
 */
export type BannerKind = 'idle' | 'warning' | 'success' | 'safe-stop' | 'connection';

export interface ConnectionBannerHandle {
  element: HTMLElement;
  show: (kind: BannerKind, message: string) => void;
  hide: () => void;
}

export function createConnectionBanner(): ConnectionBannerHandle {
  const banner = document.createElement('div');
  banner.className = 'connection-banner is-hidden';

  const dot = document.createElement('span');
  dot.className = 'connection-banner__dot';

  const text = document.createElement('span');
  text.className = 'connection-banner__text';

  banner.append(dot, text);

  const kindClass: Record<Exclude<BannerKind, 'idle'>, string> = {
    warning: 'connection-banner--warning',
    success: 'connection-banner--success',
    'safe-stop': 'connection-banner--safe-stop',
    connection: 'connection-banner--connection',
  };

  const clearKinds = () => {
    Object.values(kindClass).forEach((cls) => banner.classList.remove(cls));
  };

  const show = (kind: BannerKind, message: string) => {
    clearKinds();
    if (kind === 'idle') {
      banner.classList.add('is-hidden');
      return;
    }
    banner.classList.remove('is-hidden');
    banner.classList.add(kindClass[kind]);
    text.textContent = message;
  };

  const hide = () => {
    clearKinds();
    banner.classList.add('is-hidden');
  };

  return { element: banner, show, hide };
}
