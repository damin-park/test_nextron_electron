/**
 * 연결 배너 (main_window_parts/top_banner_manager.py 재현).
 * 경고/성공/세이프스톱/연결 상태 메시지를 같은 영역에 표시한다.
 * kind 가 'idle' 이면 숨김 상태(is-hidden)로 렌더링한다.
 */
import type { ReactElement } from 'react';

export type BannerKind = 'idle' | 'warning' | 'success' | 'safe-stop' | 'connection';

export interface ConnectionBannerProps {
  kind?: BannerKind;
  message?: string;
}

const KIND_CLASS: Record<Exclude<BannerKind, 'idle'>, string> = {
  warning: 'connection-banner--warning',
  success: 'connection-banner--success',
  'safe-stop': 'connection-banner--safe-stop',
  connection: 'connection-banner--connection',
};

export function ConnectionBanner({
  kind = 'idle',
  message = '',
}: ConnectionBannerProps): ReactElement {
  const classNames = ['connection-banner'];
  if (kind === 'idle') {
    classNames.push('is-hidden');
  } else {
    classNames.push(KIND_CLASS[kind]);
  }

  return (
    <div className={classNames.join(' ')}>
      <span className="connection-banner__dot" />
      <span className="connection-banner__text">{kind === 'idle' ? '' : message}</span>
    </div>
  );
}
