/**
 * 컨트롤 패널과 그래프 패널 사이 스플리터 드래그 훅.
 * 기존 vanilla 구현(mainWindow.ts setupSplitter)의 동작을 그대로 재현한다.
 *
 * - window resize 에 대응 (maxWidth 를 workArea 실시간 폭으로 계산)
 * - 최소/최대 panel width 제한
 * - drag 중 text selection 방지 (is-dragging 클래스)
 * - 기존 시각적 스타일 유지
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

// main_window.py 의 폭 제약
const MIN_CONTROL_WIDTH = 325;
const MIN_GRAPH_WIDTH = 420;
const SPLITTER_WIDTH = 4;

export interface SplitterApi {
  controlPanelRef: RefObject<HTMLDivElement>;
  workAreaRef: RefObject<HTMLDivElement>;
  splitterRef: RefObject<HTMLDivElement>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function useSplitter(): SplitterApi {
  const controlPanelRef = useRef<HTMLDivElement>(null);
  const workAreaRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) {
      return;
    }
    const controlPanel = controlPanelRef.current;
    const workArea = workAreaRef.current;
    if (!controlPanel || !workArea) {
      return;
    }
    const delta = event.clientX - startXRef.current;
    const maxWidth = workArea.clientWidth - SPLITTER_WIDTH - MIN_GRAPH_WIDTH;
    const next = Math.max(
      MIN_CONTROL_WIDTH,
      Math.min(startWidthRef.current + delta, maxWidth),
    );
    controlPanel.style.flexBasis = `${next}px`;
    controlPanel.style.width = `${next}px`;
  }, []);

  const stopDrag = useCallback(() => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    splitterRef.current?.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const controlPanel = controlPanelRef.current;
      if (!controlPanel) {
        return;
      }
      draggingRef.current = true;
      startXRef.current = event.clientX;
      startWidthRef.current = controlPanel.getBoundingClientRect().width;
      splitterRef.current?.classList.add('is-dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDrag);
    },
    [onPointerMove, stopDrag],
  );

  // 드래그 도중 언마운트되더라도 window 리스너가 남지 않도록 정리한다.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
    };
  }, [onPointerMove, stopDrag]);

  return { controlPanelRef, workAreaRef, splitterRef, onPointerDown };
}
